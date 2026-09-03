# Plan técnico: movimientos programados, recurrencias, financiamientos y presupuestos

## 1. Propósito

Este documento define los incrementos siguientes de Finance Tracker v2 después de
cuentas, categorías, transacciones, transferencias y dashboard real.

El diseño separa cuatro conceptos:

1. movimientos programados y reglas recurrentes;
2. planes de financiamiento y cuotas;
3. presupuestos;
4. previsión financiera.

```text
Regla recurrente
  Define qué, cuánto y cuándo se espera un ingreso o gasto
        ↓ genera
Ocurrencia
  Evento concreto con fecha y monto editables
        ↓ al completarse
Transacción
  Movimiento real que modifica el saldo

Plan de financiamiento → obligación completa y calendario de cuotas
Presupuesto            → cuánto se permite gastar
Previsión              → cuánto dinero probablemente habrá en el futuro
```

## 2. Estado actual y compatibilidad

El DBML original incluía `recurring_payments`,
`recurring_payment_occurrences`, `budgets`, `budget_allocations` y
`budget_periods`. Este plan conserva sus objetivos, pero ajusta el modelo a los
casos de salarios, fechas variables y financiamientos con pago final.

- El esquema real usa `financial_accounts`, no `accounts`.
- Los IDs de Better Auth son `text`; las referencias a `users.id` deben coincidir.
- No se agregarán preferencias financieras directamente a `users`.
- `transactions.type` ya admite `income`, `expense` y `transfer`.
- El ledger existente seguirá siendo el único responsable de modificar saldos.
- La zona central es `America/Mexico_City`.

El dashboard actualmente obtiene próximos pagos desde transacciones `scheduled`.
Esa lectura migrará a ocurrencias programadas de ingresos, gastos y cuotas.

### Estado de implementación

La fase de ocurrencias manuales está implementada mediante la migración
`drizzle/0004_cultured_sentinels.sql`:

- tabla `scheduled_occurrences` e índices por usuario, estado y fecha;
- FK única `transactions.scheduled_occurrence_id`;
- creación manual de ingresos y gastos programados;
- acciones atómicas para completar, omitir y cancelar;
- actualización de saldos mediante el ledger existente;
- sincronización al cancelar posteriormente la transacción generada;
- pantalla `/scheduled`, filtros, resumen, modal y estados animados;
- integración de próximos movimientos con el dashboard;
- aviso no bloqueante al programar un gasto que hoy excedería el crédito;
- confirmación explícita y validación de servidor al completar o registrar un
  gasto por encima del límite, conservando el exceso visible en la tarjeta.
- reglas recurrentes simples de ingreso y gasto, con frecuencia semanal, cada
  14 días, mensual o anual;
- creación idempotente de ocurrencias mediante `recurring_rule_id + sequence`,
  una ventana de 60 días y controles para editar, pausar, reanudar, archivar y
  actualizar las próximas fechas desde `/scheduled`.
- estrategias de salario: monto fijo, total mensual distribuido y quinta fecha
  semanal con importe personalizado;
- frecuencia semimensual con dos días configurables, excepciones por fecha y
  calendario personalizado con fechas y montos individuales.

Continúan pendientes los financiamientos, presupuestos y previsión.

## 3. Límites del dominio

### Movimiento recurrente

Un ingreso o gasto que sigue una regla: salario, renta, suscripción o servicio.

### Ocurrencia

Una ejecución concreta. Conserva snapshots de fecha, monto, cuenta, categoría y
descripción. Puede editarse, omitirse, cancelarse o completarse sin reescribir la
regla completa.

### Plan de financiamiento

Una obligación con principal y calendario de cuotas, posiblemente con un pago final
diferente. No es una recurrencia ordinaria.

### Presupuesto

Un límite de gasto comparado contra transacciones reales completadas.

### Previsión financiera

Una proyección construida con saldos, movimientos futuros, cuotas y estimaciones. No
es equivalente a un presupuesto.

## 4. Decisiones principales

### 4.1 Reglas de ingreso y gasto

Se reemplaza `recurring_payments` por `recurring_rules`, porque una regla puede
generar `income` o `expense`. Su categoría debe coincidir con ese tipo.

Las transferencias recurrentes se posponen: necesitan dos cuentas, dos movimientos
y una operación atómica propia.

### 4.2 Separar calendario, terminación y monto

```text
frequency        Cuándo ocurre
end_mode         Cuándo termina
amount_strategy  Cómo se calcula el importe
```

Esto evita que un único enum mezcle suscripción, plazo, frecuencia y cálculo.

### 4.3 El futuro no afecta el saldo

Crear una regla, ocurrencia o cuota no altera `currentBalance`, `owedAmount` ni
`availableCredit`.

Completar una ocurrencia debe, dentro de una transacción SQL:

1. comprobar que continúa programada;
2. crear la transacción real;
3. aplicar el ledger existente;
4. enlazar transacción y ocurrencia;
5. marcar la ocurrencia como completada.

### 4.4 Idempotencia

Las ocurrencias generadas usan:

```text
UNIQUE (recurring_rule_id, sequence)
```

`sequence` no cambia si se mueve la fecha. Es una identidad más estable que
`scheduled_at` y evita duplicados durante reintentos.

## 5. Enums propuestos

```text
schedule_frequency
  daily
  weekly
  biweekly
  semimonthly
  monthly
  yearly
  custom

recurrence_end_mode
  never
  on_date
  after_occurrences

recurrence_amount_strategy
  fixed
  period_total
  custom_per_occurrence

occurrence_status
  scheduled
  completed
  skipped
  cancelled

occurrence_source
  manual
  recurring_rule
  financing_installment

budget_period
  weekly
  monthly
  quarterly
  yearly
  custom

rollover_type
  disabled
  carry_remaining
  carry_deficit

financing_status
  active
  completed
  cancelled
```

`biweekly` significa cada 14 días y normalmente produce 26 pagos al año.
`semimonthly` significa dos veces por mes y produce 24. La UI debe llamarlos “Cada
14 días” y “Dos veces al mes” para evitar la ambigüedad de “quincenal”.

## 6. `recurring_rules`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `text` | FK a Better Auth |
| `account_id` | `uuid` | FK a `financial_accounts` |
| `category_id` | `uuid` | FK a `categories`, nullable |
| `transaction_type` | enum existente | Sólo ingreso o gasto |
| `frequency` | `schedule_frequency` | Frecuencia o custom |
| `interval` | `integer` | Mayor o igual a 1 |
| `end_mode` | `recurrence_end_mode` | Modo de terminación |
| `occurrence_limit` | `integer` | Para `after_occurrences` |
| `amount_strategy` | enum | Estrategia de importe |
| `default_amount` | `numeric(15,2)` | Monto normal |
| `period_total` | `numeric(15,2)` | Total mensual distribuible |
| `fifth_occurrence_amount` | `numeric(15,2)` | Quinto monto opcional |
| `name` | `text` | Nombre visible |
| `description` | `text` | Opcional |
| `currency` | enum existente | Igual a la cuenta en el MVP |
| `starts_at` | `timestamptz` | Inicio |
| `ends_at` | `timestamptz` | Requerido para `on_date` |
| `next_occurrence_at` | `timestamptz` | Próxima por generar |
| `last_generated_at` | `timestamptz` | Auditoría |
| `auto_post` | `boolean` | Ejecución automática |
| `is_active` | `boolean` | Permite pausar |
| `deleted_at` | `timestamptz` | Archivado lógico |
| `created_at` | `timestamptz` | Auditoría |
| `updated_at` | `timestamptz` | Auditoría |

Índices:

```text
(user_id, is_active, next_occurrence_at)
(account_id)
(category_id)
```

Reglas de integridad:

- cuenta y categoría pertenecen al usuario;
- la categoría coincide con `transaction_type`;
- `ends_at >= starts_at`;
- `interval >= 1`;
- `occurrence_limit > 0` cuando corresponde;
- una regla custom no calcula `next_occurrence_at`;
- archivar una cuenta exige pausar o reasignar sus reglas activas.

## 7. Salarios y estrategias de monto

### `fixed`

Cada ocurrencia usa el mismo importe:

```text
Salario semanal: $5,000
Mes con 4 pagos: $20,000
Mes con 5 pagos: $25,000
```

### `period_total`

Un total mensual se distribuye entre los pagos del mes:

```text
Total mensual: $20,000
4 viernes → $5,000 por pago
5 viernes → $4,000 por pago
```

El residuo de centavos se agrega a la última ocurrencia para conservar exactamente
el total. En el primer alcance se habilita para reglas semanales y cada 14 días con
distribución mensual.

### `custom_per_occurrence`

Existe un monto normal, pero cada ocurrencia puede reemplazarlo. También permite:

```text
Pagos 1 a 4 → $5,000
Pago 5      → $2,500
```

El preset de salario debe preguntar:

```text
Mes con quinta fecha semanal
  Mantener monto normal
  Distribuir total mensual
  Usar un monto diferente
```

Una ocurrencia completada conserva su monto histórico y no se recalcula.

## 8. Calendarios variables

Una regla `semimonthly` guarda dos días, por ejemplo el día 15 y el último día del
mes. “Último día” se conserva como regla semántica, no como 28, 30 o 31 fijo.

Para fechas mensuales variables existen dos modalidades.

### Regla con excepciones

```text
Enero   → día 20
Febrero → día 22, excepción
Marzo   → día 21, excepción
Abril   → día 20
```

Mover febrero no desplaza marzo.

### Calendario completamente custom

El usuario proporciona todas las fechas conocidas. La regla usa
`frequency = custom`, crea esas ocurrencias y no calcula fechas adicionales. Cada
ocurrencia puede tener su propio monto.

## 9. `scheduled_occurrences`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `text` | Aislamiento por usuario |
| `source` | `occurrence_source` | Origen |
| `recurring_rule_id` | `uuid` | Nullable |
| `financing_installment_id` | `uuid` | Nullable y único |
| `sequence` | `integer` | Posición dentro de la fuente |
| `account_id` | `uuid` | Snapshot de cuenta |
| `category_id` | `uuid` | Snapshot opcional |
| `transaction_type` | enum existente | Tipo previsto |
| `name` | `text` | Snapshot visible |
| `amount` | `numeric(15,2)` | Snapshot de monto |
| `currency` | enum existente | Snapshot de moneda |
| `original_scheduled_at` | `timestamptz` | Fecha originalmente calculada |
| `scheduled_at` | `timestamptz` | Fecha efectiva editable |
| `executed_at` | `timestamptz` | Ejecución real |
| `status` | `occurrence_status` | Estado |
| `created_at` | `timestamptz` | Auditoría |
| `updated_at` | `timestamptz` | Auditoría |

Restricciones:

```text
UNIQUE (recurring_rule_id, sequence)
UNIQUE (financing_installment_id)
INDEX  (user_id, status, scheduled_at)
INDEX  (recurring_rule_id, scheduled_at)
```

Para `source = manual`, las referencias de origen son nulas. Para las demás fuentes
debe existir exactamente la referencia correspondiente.

Al editar una regla se pregunta:

```text
Sólo esta ocurrencia
Esta y las siguientes no completadas
Sólo la regla para ocurrencias aún no generadas
```

Las ocurrencias completadas nunca cambian indirectamente.

## 10. Cambios en `transactions`

Agregar:

```text
recurring_rule_id uuid null
scheduled_occurrence_id uuid null
financing_plan_id uuid null
```

`scheduled_occurrence_id` debe ser único cuando no sea nulo. Estas referencias dan
trazabilidad, reportes e idempotencia.

La relación se guarda únicamente desde `transactions` hacia
`scheduled_occurrences`; la ocurrencia no mantiene una FK inversa. Así se evita una
referencia circular y una segunda fuente de verdad.

No se crean años de transacciones anticipadamente. El futuro vive en
`scheduled_occurrences`; la transacción aparece al completar el evento.

## 11. Planes de financiamiento

Una compra con 20 pagos de $760 y uno final de $9,800 representa:

```text
20 × $760 = $15,200
Pago final = $9,800
Total      = $25,000
```

Si la tarjeta reconoce o retiene la obligación completa desde la compra:

1. se registra un gasto de $25,000 una sola vez;
2. la deuda aumenta $25,000;
3. el crédito disponible disminuye $25,000;
4. las cuotas no vuelven a registrarse como gastos;
5. cada pago es una transferencia hacia la tarjeta;
6. cada transferencia reduce deuda y restaura crédito disponible.

### `financing_plans`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `text` | FK a Better Auth |
| `credit_account_id` | `uuid` | Cuenta de crédito |
| `purchase_transaction_id` | `uuid` | Gasto original, único |
| `name` | `text` | Nombre visible |
| `total_amount` | `numeric(15,2)` | Obligación total |
| `regular_installment_count` | `integer` | Cantidad de pagos normales |
| `regular_installment_amount` | `numeric(15,2)` | Monto normal |
| `balloon_amount` | `numeric(15,2)` | Pago final, puede ser cero |
| `currency` | enum existente | Moneda de la cuenta |
| `starts_at` | `timestamptz` | Inicio |
| `status` | `financing_status` | Estado |
| `created_at` | `timestamptz` | Auditoría |
| `updated_at` | `timestamptz` | Auditoría |

Debe cumplirse:

```text
regular_installment_count × regular_installment_amount + balloon_amount
= total_amount
```

Intereses, seguros y comisiones se modelan explícitamente; no se altera el principal
silenciosamente para hacer coincidir la suma.

### `financing_installments`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `financing_plan_id` | `uuid` | FK, cascade |
| `sequence` | `integer` | 1 a N |
| `scheduled_at` | `timestamptz` | Fecha esperada |
| `amount` | `numeric(15,2)` | Monto de cuota |
| `is_balloon` | `boolean` | Identifica pago final |
| `paid_at` | `timestamptz` | Fecha real |
| `created_at` | `timestamptz` | Auditoría |

Debe existir `UNIQUE (financing_plan_id, sequence)`.

La relación con la agenda se conserva únicamente mediante
`scheduled_occurrences.financing_installment_id`. No se agrega una FK inversa para
evitar referencias circulares y dos fuentes de verdad.

Al completar una cuota, el usuario selecciona la cuenta de origen y se crea una
transferencia atómica hacia la tarjeta.

Si una institución diferencia deuda contabilizada y crédito solamente retenido,
posteriormente pueden agregarse `pending_balance` y `reserved_credit`. No deben
mezclarse con `owed_amount` sin definir su semántica.

## 12. Presupuestos

### `budgets`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `text` | FK a Better Auth |
| `name` | `text` | Nombre visible |
| `amount` | `numeric(15,2)` | Límite mayor que cero |
| `currency` | enum existente | Moneda |
| `period` | `budget_period` | Periodicidad |
| `rollover` | `rollover_type` | Tratamiento del remanente |
| `is_reusable` | `boolean` | Genera periodos siguientes |
| `color` | `text` | Color validado |
| `warning_threshold` | `integer` | Inicialmente 80% |
| `starts_at` | `timestamptz` | Inicio |
| `ends_at` | `timestamptz` | Opcional salvo custom |
| `is_active` | `boolean` | Estado |
| `deleted_at` | `timestamptz` | Archivado lógico |
| `created_at` | `timestamptz` | Auditoría |
| `updated_at` | `timestamptz` | Auditoría |

Los presupuestos del MVP son exclusivamente de gasto. Sin asignaciones representan
gasto global; con asignaciones representan categorías seleccionadas.

### `budget_allocations`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `budget_id` | `uuid` | FK, cascade |
| `category_id` | `uuid` | FK, restrict |
| `amount` | `numeric(15,2)` | Asignación mayor que cero |
| `created_at` | `timestamptz` | Auditoría |
| `updated_at` | `timestamptz` | Auditoría |

Debe existir `UNIQUE (budget_id, category_id)` y la suma de asignaciones no puede
superar el presupuesto. Las categorías archivadas conservan su historia.

### `budget_periods`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `budget_id` | `uuid` | FK, cascade |
| `period_start` | `timestamptz` | Inicio inclusivo |
| `period_end` | `timestamptz` | Fin exclusivo |
| `allocated_amount` | `numeric(15,2)` | Snapshot del límite |
| `rollover_amount` | `numeric(15,2)` | Ajuste anterior |
| `created_at` | `timestamptz` | Auditoría |

Debe existir `UNIQUE (budget_id, period_start, period_end)`.

No se persisten valores derivados:

```text
available = allocated_amount + rollover_amount
spent     = SUM(gastos completados del periodo)
remaining = available - spent
usage     = spent / available × 100
```

Sólo cuentan gastos completados del periodo, moneda y categorías correspondientes.
Transferencias, pagos de tarjeta y cancelados no crean gasto nuevo.

## 13. Presupuesto frente a previsión

El presupuesto responde “¿cuánto me permito gastar?”. La previsión responde “¿cuánto
dinero probablemente tendré?”.

```text
Saldo actual             $30,000
Ingresos programados    +$40,000
Gastos programados      -$18,000
Cuotas futuras           -$3,040
Gasto variable estimado  -$9,000
Saldo proyectado          $39,960
```

La primera previsión será un read model sin tabla propia:

```text
saldo actual
+ ingresos programados
- gastos programados
- transferencias futuras
- estimación opcional basada en presupuestos
= saldo proyectado
```

Después pueden persistirse escenarios conservador, base y optimista. Nunca se
presentará una previsión como saldo garantizado.

## 14. Fechas y monedas

Todos los instantes usan `timestamptz` y `America/Mexico_City`.

- Los días 29, 30 o 31 caen en el último día válido de meses cortos.
- “Último día” se conserva como regla semántica.
- Los rangos usan inicio inclusivo y fin exclusivo.
- La fecha siguiente parte de la programada anterior, no de la hora del job.
- Mover una ocurrencia no desplaza las demás sin petición explícita.

Reglas y financiamientos usan la moneda de su cuenta. Un presupuesto sólo suma su
moneda durante el MVP. La previsión multimoneda espera una política estable de tasas
y moneda de reporte.

## 15. Casos de uso

```text
Programación
  createOneTimeScheduledMovement
  createRecurringRule
  updateRecurringRule
  pauseRecurringRule
  resumeRecurringRule
  archiveRecurringRule
  generateDueOccurrences
  updateOccurrence
  completeOccurrence
  skipOccurrence
  cancelOccurrence

Financiamientos
  createFinancingPlan
  updateFinancingPlan
  cancelFinancingPlan
  generateFinancingInstallments
  completeFinancingInstallment

Presupuestos y previsión
  createBudget
  updateBudget
  archiveBudget
  ensureCurrentBudgetPeriod
  getBudgetOverview
  getBudgetDetail
  getCashFlowForecast
  getProjectedAccountBalances
```

Toda operación que crea transacciones o toca saldos reutiliza el ledger.

## 16. Automatización

La generación no se ejecuta durante el render:

```text
Scheduler
  → endpoint interno protegido
    → generateDueOccurrences(now, horizon)
      → caso de uso
        → PostgreSQL + restricciones únicas
```

La ventana inicial es de 45 días. Primero puede existir una acción manual y después
conectar el mismo caso de uso a un cron. `auto_post` inicia en `false` y sólo se
habilita después de probar concurrencia, reintentos e idempotencia.

## 17. Arquitectura y rutas

```text
src/features/recurring-movements/
├── actions/
├── application/use-cases/
├── components/
├── domain/
│   ├── recurrence-calculator.ts
│   ├── amount-strategy.ts
│   └── recurring-rule-repository.ts
├── infrastructure/
├── queries/
├── schemas/
└── utils/

src/features/financing/
src/features/budgets/
src/features/forecast/
```

```text
app/(private)/scheduled/
app/(private)/financing/
app/(private)/budgets/
app/(private)/forecast/
```

Los `page.tsx` son Server Components. Formularios, filtros, modales y animaciones
son Client Components. El cliente nunca persiste saldos.

## 18. Experiencia de usuario

### Programados

- resumen de ingresos y gastos próximos;
- timeline agrupada por fecha;
- filtros por tipo y estado;
- cards de reglas activas;
- presets de salario, suscripción y servicio;
- editor de ocurrencias;
- selector de monto fijo, total mensual o personalizado;
- calendario custom con múltiples fechas y montos.

### Financiamientos

- obligación original y saldo restante;
- progreso, siguiente cuota y pago final;
- calendario completo;
- acción “Registrar pago” con cuenta de origen;
- advertencia para no duplicar el gasto.

### Presupuestos y previsión

- progreso por presupuesto y categoría;
- estados `healthy`, `warning` y `exceeded`;
- selector de periodo y rollover;
- saldo proyectado por semana o mes;
- desglose de datos reales, programados y estimados.

Framer Motion se limita a modales, filtros, cards y detalles. Debe respetar
`prefers-reduced-motion` y no retrasar operaciones financieras.

## 19. Dashboard

El widget consulta `scheduled_occurrences` dentro de los siguientes 45 días:

```ts
interface UpcomingMovement {
    id: string;
    name: string;
    transactionType: "income" | "expense" | "transfer";
    amount: number;
    currency: string;
    scheduledDate: Date;
    source: "manual" | "recurring_rule" | "financing_installment";
    autoPost: boolean;
    accountName: string | null;
}
```

Presupuestos muestra el total y los tres que requieren atención. La previsión puede
añadir después “Saldo estimado al cierre del mes” con enlace a su desglose.

## 20. Seguridad

Todas las mutaciones deben:

- obtener `userId` desde la sesión;
- ignorar cualquier `userId` del cliente;
- verificar propiedad de todas las entidades;
- validar con Zod;
- limitar consultas por usuario;
- usar `numeric` y redondeo explícito;
- devolver errores de dominio sin detalles internos.

Completar una ocurrencia o cuota debe ser atómico e idempotente.

## 21. Plan de implementación

### Fase 1 — Ocurrencias manuales

Crear `scheduled_occurrences`, completar/omitir/cancelar, aplicar el saldo una vez y
conectar el dashboard.

### Fase 2 — Recurrencias simples

Implementada: reglas de ingreso y gasto con monto fijo, frecuencias semanales,
cada 14 días, mensuales y anuales, CRUD, pausa, reanudación e idempotencia.
La ventana se genera al crear, editar o reanudar una regla, y también puede
actualizarse manualmente desde la interfaz.

### Fase 3 — Salarios y calendarios avanzados

Implementada mediante `drizzle/0006_same_vivisector.sql`: total mensual distribuido
con residuo en la última fecha, quinta ocurrencia semanal configurable, frecuencia
semimensual, excepciones y calendarios custom con montos individuales. Las
ocurrencias ya generadas permanecen como snapshots; los nuevos parámetros aplican
a las fechas que se generen posteriormente.

### Fase 4 — Automatización

Implementada la pieza de aplicación: `GET` y `POST`
`/api/internal/recurring/generate`, protegida por `CRON_SECRET`, ejecuta el mismo
generador idempotente para todas las reglas activas. La configuración concreta del
scheduler pertenece al proveedor de despliegue y está documentada en
`docs/recurring-automation.md`. No existe autopost: el cron nunca modifica saldos
ni completa movimientos.

### Fase 5 — Financiamientos

Crear planes y cuotas, relacionar compra y tarjeta, generar pago final y completar
cuotas como transferencias.

### Fase 6 — Presupuestos

Crear tablas, CRUD, asignaciones, cálculo desde ledger, rollover e integración con
dashboard.

### Fase 7 — Previsión

Proyectar desde cuentas y ocurrencias, incorporar financiamientos, usar presupuestos
como estimación opcional y mostrar el desglose.

## 22. Pruebas esenciales

### Recurrencias

- todas las frecuencias y límites;
- días 29, 30, 31 y años bisiestos;
- meses con cuatro y cinco pagos;
- distribución exacta con centavos;
- excepciones aisladas;
- calendario custom sin fechas adicionales;
- doble generación y doble confirmación sin duplicados.

### Financiamientos

- cuotas más pago final igual al total;
- obligación creada una vez;
- cuotas reducen deuda y restauran crédito;
- pagos no duplican gasto;
- cancelación conserva consistencia.

### Presupuesto y previsión

- sólo suma gastos completados;
- excluye transferencias y cancelados;
- editar o cancelar actualiza progreso;
- rollover no se duplica;
- rangos respetan CDMX;
- monedas no se suman silenciosamente;
- cuotas completadas no vuelven a proyectarse.

## 23. Criterios de aceptación

- Se programan ingresos y gastos.
- Se distingue cada 14 días de dos veces al mes.
- Existen monto fijo, total mensual y monto personalizado.
- Puede configurarse el quinto pago semanal.
- Se editan fechas y montos específicos y calendarios custom.
- Los reintentos no duplican ocurrencias ni saldos.
- Un financiamiento admite cuotas y pago final sin duplicar el gasto.
- Los presupuestos se calculan desde el ledger.
- La previsión diferencia información confirmada, programada y estimada.

## 24. Elementos pospuestos

- `budget_credit_cards` y `budget_category_credit_allocations`;
- notificaciones persistidas;
- escenarios persistidos de previsión;
- transferencias recurrentes automáticas;
- balances retenidos específicos por institución.

## 25. Recomendación final

El primer PR implementa ocurrencias manuales y su integración atómica con el ledger.
El segundo agrega reglas simples de ingreso y gasto. El tercero incorpora salarios,
montos variables y calendarios custom.

Financiamientos se implementa después como subdominio propio. Los presupuestos se
construyen sobre el ledger y la previsión se agrega al final como read model de los
módulos anteriores.

Esta separación cubre los casos avanzados sin convertir una sola tabla de “pagos
recurrentes” en una colección de excepciones difíciles de validar.
