# Plan técnico: pagos programados, recurrencias y presupuestos

## 1. Propósito

Este documento define el siguiente incremento funcional de Finance Tracker v2 una
vez terminados:

- autenticación con Better Auth;
- CRUD de cuentas financieras;
- categorías de ingreso y gasto;
- ciclo de vida de transacciones;
- transferencias atómicas;
- dashboard conectado a datos reales.

El incremento se divide en dos módulos relacionados, pero desplegables por separado:

1. pagos programados y recurrentes;
2. presupuestos por categoría.

El orden recomendado es implementar primero recurrencias. El dashboard ya obtiene
`upcomingPayments` desde transacciones con estado `scheduled`, pero actualmente no
existe un flujo completo que cree y administre esas transacciones. Los presupuestos
pueden construirse después sobre gastos completados y categorías ya confiables.

## 2. Fuentes y estado actual

La propuesta parte de tres fuentes:

- el DBML original, que incluía `recurring_payments`,
  `recurring_payment_occurrences`, `budgets`, `budget_allocations` y
  `budget_periods`;
- la especificación funcional del dashboard;
- el esquema Drizzle que está implementado actualmente.

El esquema real usa `financial_accounts`, no `accounts`, y los identificadores de
Better Auth son `text`. Las nuevas referencias a `users.id` deben conservar ese
tipo. No se modificará la tabla `users` de Better Auth para agregar moneda, locale o
zona horaria.

La tabla `transactions` ya proporciona la base necesaria:

- `status` admite `pending`, `completed`, `scheduled` y `cancelled`;
- `date` puede representar la fecha prevista o efectiva según el estado;
- el ledger sólo debe alterar saldos con transacciones `completed`;
- las transferencias quedan excluidas de ingresos, gastos y presupuestos.

## 3. Decisiones principales

### 3.1 Separar regla, ocurrencia y movimiento

Son tres conceptos diferentes:

```text
Regla recurrente
  Netflix, cada mes, día 12, $299
        ↓ genera
Ocurrencia
  Netflix, 12 de septiembre, programada
        ↓ al confirmarse
Transacción
  Gasto completado que modifica el saldo
```

- `recurring_payments` describe cómo se repite un pago.
- `recurring_payment_occurrences` representa cada vencimiento concreto.
- `transactions` conserva el movimiento contable y su efecto en el saldo.

Una transacción programada de una sola ocasión no necesita una regla recurrente;
puede existir como una ocurrencia independiente. Para mantener una única fuente de
“Próximos pagos”, se recomienda que tanto los pagos únicos como los recurrentes
tengan una ocurrencia.

### 3.2 No afectar saldos antes de completar el pago

Crear una regla, generar una ocurrencia o programar un pago no altera
`currentBalance`, `owedAmount` ni `availableCredit`.

El saldo cambia únicamente cuando el usuario confirma una ocurrencia o cuando una
automatización autorizada la ejecuta. Esa operación debe:

1. comprobar que la ocurrencia sigue `scheduled`;
2. crear o completar la transacción;
3. aplicar el delta al saldo mediante el ledger existente;
4. enlazar la transacción con la ocurrencia;
5. marcar la ocurrencia como `completed`;
6. ejecutarse en una sola transacción SQL.

La condición sobre el estado evita cobrar dos veces por doble clic, reintento del
cliente o ejecución repetida de un job.

### 3.3 Generación idempotente

Debe existir una restricción única sobre:

```text
(recurring_payment_id, scheduled_date)
```

Así, ejecutar dos veces el generador para la misma fecha no crea dos ocurrencias.
La idempotencia debe estar garantizada por PostgreSQL, no sólo por una comprobación
en TypeScript.

### 3.4 Presupuestos calculados desde el ledger

El gasto de un presupuesto se calcula desde `transactions`; no se incrementa desde
el cliente ni desde el formulario del presupuesto. Sólo participan movimientos que:

- pertenecen al usuario;
- tienen `type = expense`;
- tienen `status = completed`;
- caen dentro del periodo;
- pertenecen a alguna categoría asignada al presupuesto.

Las transferencias, pagos de tarjetas y movimientos cancelados no cuentan como
gasto nuevo. La compra hecha con la tarjeta ya fue el gasto; pagar la tarjeta es una
transferencia.

## 4. Modelo de datos propuesto

### 4.1 Enums

```text
recurring_payment_type
  indefinite
  by_term
  subscription

recurrence_frequency
  daily
  weekly
  monthly
  yearly

occurrence_status
  scheduled
  completed
  skipped
  cancelled

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
```

Se cambia `cycle_type.custom` del DBML original por una combinación de
`frequency + interval`. Por ejemplo, “cada 2 semanas” se guarda como `weekly` con
`interval = 2`. Una regla arbitraria estilo cron queda fuera del MVP porque complica
validación, edición y fechas límite.

Se recomienda un enum propio para las ocurrencias. Reutilizar
`transaction_status` haría que `pending` tuviera un significado ambiguo y no
permitiría distinguir una ocurrencia omitida de una cancelada.

### 4.2 `recurring_payments`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK, generado por defecto |
| `user_id` | `text` | FK a Better Auth, `not null`, cascade |
| `account_id` | `uuid` | FK a `financial_accounts`, restrict |
| `category_id` | `uuid` | FK a `categories`, set null |
| `payment_type` | enum | Indefinido, plazo o suscripción |
| `frequency` | enum | Frecuencia base |
| `interval` | `integer` | Mayor o igual a 1 |
| `name` | `text` | Nombre visible |
| `description` | `text` | Opcional |
| `amount` | `numeric(15,2)` | Mayor que cero |
| `currency` | `currency_code` | Debe coincidir con la cuenta en el MVP |
| `starts_at` | `timestamptz` | Primera fecha de vigencia |
| `ends_at` | `timestamptz` | Requerida para `by_term`, opcional en otros casos |
| `next_occurrence_at` | `timestamptz` | Próxima fecha pendiente de generar |
| `last_generated_at` | `timestamptz` | Auditoría del generador |
| `remaining_balance` | `numeric(15,2)` | Sólo si existe deuda/plazo conocido |
| `auto_post` | `boolean` | Si la ocurrencia se completa automáticamente |
| `is_active` | `boolean` | Permite pausar sin perder historial |
| `deleted_at` | `timestamptz` | Archivado lógico |
| `created_at` | `timestamptz` | Auditoría |
| `updated_at` | `timestamptz` | Auditoría |

Índices recomendados:

```text
(user_id, is_active, next_occurrence_at)
(account_id)
(category_id)
```

Reglas de integridad:

- la cuenta y categoría deben pertenecer al mismo usuario;
- la categoría debe ser de tipo `expense`;
- la categoría puede ser nula, pero la UI debe advertir que el gasto no participará
  en presupuestos por categoría;
- `ends_at >= starts_at`;
- `next_occurrence_at` debe estar dentro de la vigencia;
- archivar una cuenta con reglas activas debe pedir primero reasignarlas o pausarlas.

### 4.3 `recurring_payment_occurrences`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `text` | Facilita aislamiento e índices por usuario |
| `recurring_payment_id` | `uuid` | Nullable para un pago único |
| `account_id` | `uuid` | Snapshot del destino |
| `category_id` | `uuid` | Snapshot opcional |
| `name` | `text` | Snapshot visible |
| `amount` | `numeric(15,2)` | Snapshot del monto |
| `currency` | `currency_code` | Snapshot de moneda |
| `scheduled_at` | `timestamptz` | Fecha de vencimiento |
| `executed_at` | `timestamptz` | Fecha real de ejecución |
| `status` | enum | Programada, completada, omitida o cancelada |
| `transaction_id` | `uuid` | FK única y nullable a `transactions` |
| `created_at` | `timestamptz` | Auditoría |
| `updated_at` | `timestamptz` | Auditoría |

Guardar snapshots permite que una ocurrencia ya generada conserve su importe,
cuenta y nombre aunque después cambie la regla. Editar la regla afecta sólo las
ocurrencias futuras que todavía no se hayan generado. La edición masiva de
ocurrencias existentes debe ser una acción separada y explícita.

Restricciones e índices:

```text
UNIQUE (recurring_payment_id, scheduled_at)
UNIQUE (transaction_id) WHERE transaction_id IS NOT NULL
INDEX  (user_id, status, scheduled_at)
INDEX  (recurring_payment_id, scheduled_at)
```

### 4.4 Cambios en `transactions`

Agregar:

```text
recurring_payment_id uuid null
recurring_occurrence_id uuid null
```

La referencia directa a la regla facilita reportes como “costo mensual de
suscripciones”. La referencia a la ocurrencia aporta trazabilidad e idempotencia.
`recurring_occurrence_id` debe ser único cuando no sea nulo.

El campo `date` mantiene esta semántica:

- en una transacción `scheduled`, es la fecha prevista;
- en una transacción `completed`, es la fecha financiera efectiva elegida al
  confirmar.

No se recomienda llenar meses o años de filas `transactions` por adelantado. Las
ocurrencias futuras pertenecen a `recurring_payment_occurrences`; el movimiento se
crea al completar la ocurrencia.

### 4.5 `budgets`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `text` | FK a Better Auth |
| `name` | `text` | Nombre visible |
| `amount` | `numeric(15,2)` | Límite total mayor que cero |
| `currency` | `currency_code` | Moneda del presupuesto |
| `period` | enum | Periodicidad |
| `rollover` | enum | Tratamiento del remanente |
| `is_reusable` | `boolean` | Genera periodos siguientes |
| `color` | `text` | Color de presentación validado |
| `warning_threshold` | `integer` | Porcentaje, valor inicial 80 |
| `starts_at` | `timestamptz` | Inicio de vigencia |
| `ends_at` | `timestamptz` | Opcional salvo periodo custom |
| `is_active` | `boolean` | Pausa o finalización |
| `deleted_at` | `timestamptz` | Archivado lógico |
| `created_at` | `timestamptz` | Auditoría |
| `updated_at` | `timestamptz` | Auditoría |

Para el MVP, todos los presupuestos son de gasto. Se elimina `type` porque permitir
presupuestos de ingreso mezcla este módulo con metas o previsiones. También se
elimina `is_global`: un presupuesto sin asignaciones puede representar el gasto
global, evitando dos fuentes de verdad.

### 4.6 `budget_allocations`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `budget_id` | `uuid` | FK a `budgets`, cascade |
| `category_id` | `uuid` | FK a `categories`, restrict |
| `amount` | `numeric(15,2)` | Monto asignado, `not null` y mayor que cero |
| `created_at` | `timestamptz` | Auditoría |
| `updated_at` | `timestamptz` | Auditoría |

Debe existir `UNIQUE (budget_id, category_id)`. La suma de asignaciones no puede
superar `budgets.amount`. Si todas las asignaciones tienen monto, la UI debe mostrar
también cuánto queda sin asignar.

Una categoría archivada conserva su relación para reportes históricos. No debe
borrarse físicamente ni cambiarse automáticamente por otra.

### 4.7 `budget_periods`

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `budget_id` | `uuid` | FK a `budgets`, cascade |
| `period_start` | `timestamptz` | Inicio inclusivo |
| `period_end` | `timestamptz` | Fin exclusivo |
| `allocated_amount` | `numeric(15,2)` | Snapshot del límite |
| `rollover_amount` | `numeric(15,2)` | Ajuste proveniente del periodo anterior |
| `created_at` | `timestamptz` | Auditoría |

Debe existir `UNIQUE (budget_id, period_start, period_end)`.

No se recomienda persistir `spent_amount`, `remaining_amount` ni
`total_available`, como proponía el DBML original. Son valores derivados y pueden
quedar desincronizados al editar o cancelar transacciones. Deben calcularse en una
query:

```text
available = allocated_amount + rollover_amount
spent     = SUM(gastos completados del periodo)
remaining = available - spent
usage     = spent / available * 100
```

### 4.8 Tablas pospuestas

No crear todavía:

- `budget_credit_cards`;
- `budget_category_credit_allocations`;
- `notifications`.

Los gastos con tarjeta ya pueden atribuirse a categorías desde `transactions`. Las
tablas específicas de tarjetas duplicarían asignaciones sin resolver un caso de uso
del MVP. Las notificaciones deben añadirse cuando exista un canal real de entrega y
preferencias del usuario; primero basta con alertas dentro de la interfaz.

## 5. Zona horaria y fechas

Todos los instantes se guardan como `timestamptz` y PostgreSQL los normaliza. Como
la tabla `users` de Better Auth no contiene zona horaria, el MVP debe usar una
constante de aplicación, inicialmente `America/Mexico_City`, para interpretar reglas
como “el día 1 a las 09:00”.

Más adelante puede crearse `user_preferences` con `timezone`, `locale` y moneda de
reporte. Esa configuración no debe agregarse a la tabla administrada por Better
Auth.

Reglas de calendario:

- un pago mensual solicitado para el día 29, 30 o 31 cae en el último día válido de
  los meses más cortos;
- los rangos presupuestarios usan inicio inclusivo y fin exclusivo;
- las fechas de UI se convierten desde/hacia la zona horaria de la aplicación;
- el motor debe calcular la siguiente fecha desde la fecha programada anterior, no
  desde la hora en que se ejecutó el job, para evitar desplazamientos acumulativos.

## 6. Casos de uso

### 6.1 Pagos programados y recurrentes

```text
createOneTimeScheduledPayment
createRecurringPayment
updateRecurringPayment
pauseRecurringPayment
resumeRecurringPayment
archiveRecurringPayment
generateDueOccurrences
completeOccurrence
skipOccurrence
cancelOccurrence
```

`generateDueOccurrences` debe recibir una ventana temporal y generar sólo lo
necesario. Una ventana sugerida es desde hoy hasta 45 días, compatible con el widget
actual del dashboard.

`completeOccurrence` es una operación financiera y debe reutilizar las reglas del
ledger, no duplicar fórmulas de cuentas de crédito.

### 6.2 Presupuestos

```text
createBudget
updateBudget
archiveBudget
ensureCurrentBudgetPeriod
getBudgetOverview
getBudgetDetail
```

Crear o editar un presupuesto debe validar propiedad de todas las categorías dentro
de la misma transacción SQL.

## 7. Automatización

La generación recurrente no debe ejecutarse durante el render de una página. Debe
existir un adaptador invocable por un scheduler externo:

```text
Scheduler
  → endpoint interno protegido
    → generateDueOccurrences(now, horizon)
      → caso de uso
        → repositorio Drizzle
          → PostgreSQL + restricciones únicas
```

Para el primer incremento puede existir un botón de desarrollo o una acción manual
“Generar próximos pagos”. Después se conecta el mismo caso de uso a un cron. El
endpoint debe validar un secreto propio del scheduler; no debe depender de una
sesión de navegador.

`auto_post = false` será el valor inicial recomendado. Con `true`, un proceso
separado completa ocurrencias vencidas usando exactamente el mismo caso de uso
idempotente que la confirmación manual.

## 8. Arquitectura de frontend y backend

Mantener la organización actual por feature:

```text
src/features/recurring-payments/
├── actions/
│   └── recurring-payment-actions.ts
├── application/
│   ├── recurring-payment-error.ts
│   └── use-cases/
│       ├── create-recurring-payment.ts
│       ├── generate-due-occurrences.ts
│       └── complete-occurrence.ts
├── components/
│   ├── recurring-payments-client.tsx
│   ├── recurring-payment-form.tsx
│   ├── recurring-payment-card.tsx
│   ├── occurrence-list.tsx
│   └── occurrence-actions.tsx
├── domain/
│   ├── recurrence-calculator.ts
│   └── recurring-payment-repository.ts
├── infrastructure/
│   └── drizzle-recurring-payment-repository.ts
├── queries/
│   └── get-recurring-payment-data.ts
├── schemas/
│   └── recurring-payment.schema.ts
└── utils/
    └── recurring-payment-draft.ts

src/features/budgets/
├── actions/
│   └── budget-actions.ts
├── application/
│   ├── budget-error.ts
│   └── use-cases/
│       ├── create-budget.ts
│       ├── update-budget.ts
│       └── archive-budget.ts
├── components/
│   ├── budgets-client.tsx
│   ├── budget-form.tsx
│   ├── budget-card.tsx
│   ├── budget-progress.tsx
│   └── budget-status-badge.tsx
├── domain/
│   ├── budget-rules.ts
│   └── budget-repository.ts
├── infrastructure/
│   └── drizzle-budget-repository.ts
├── queries/
│   └── get-budget-data.ts
├── schemas/
│   └── budget.schema.ts
└── utils/
    └── budget-draft.ts
```

Rutas:

```text
app/(private)/scheduled-payments/page.tsx
app/(private)/scheduled-payments/loading.tsx
app/(private)/budgets/page.tsx
app/(private)/budgets/loading.tsx
```

Los `page.tsx` deben seguir siendo Server Components: autentican, consultan y pasan
DTOs serializables. Los componentes `*-client.tsx`, formularios, modales, filtros y
animaciones sí serán Client Components.

## 9. Diseño e interacción

### 9.1 Pagos programados

La pantalla se divide en:

- resumen: monto próximo, pagos en 7 días y suscripciones activas;
- timeline de ocurrencias agrupadas por fecha;
- cuadrícula de reglas recurrentes;
- filtros por próximas, vencidas, completadas y pausadas;
- modal para crear o editar;
- menú contextual para completar, omitir, pausar o cancelar.

El formulario debe usar React Hook Form y Zod, como los módulos existentes. Campos
condicionales:

- cuenta y categoría;
- nombre, descripción, monto y moneda;
- pago único o recurrente;
- frecuencia e intervalo;
- fecha inicial y final;
- pago automático.

Las animaciones con Framer Motion deben limitarse a entrada/salida de modal, cambio
de filtros, inserción de tarjetas y expansión de detalles. Deben respetar
`prefers-reduced-motion` y no retrasar la confirmación de una operación financiera.

### 9.2 Presupuestos

La pantalla debe mostrar:

- gasto total contra monto disponible del periodo;
- saldo restante;
- tarjetas por presupuesto con barras de progreso;
- categorías incluidas y gasto por categoría;
- estados `healthy`, `warning` y `exceeded`;
- selector de periodo;
- modal de creación y edición.

Estados sugeridos:

```text
healthy   usage < warning_threshold
warning   usage >= warning_threshold y usage <= 100
exceeded  usage > 100
```

El dashboard no duplica esta pantalla. Sólo muestra el resumen global y los tres
presupuestos que requieren más atención: excedidos primero, después advertencias y
finalmente los más cercanos al límite.

## 10. Monedas

El proyecto aún no tiene una moneda preferida global. Para evitar sumas inválidas:

- una regla recurrente debe usar la moneda de su cuenta;
- un presupuesto tiene una moneda explícita;
- en el MVP, sólo cuenta transacciones cuya `currency` coincide con la del
  presupuesto;
- la UI debe informar cuando se excluyen gastos de otra moneda.

La agregación multimoneda debe esperar a una política estable de tasas de cambio y
moneda de reporte. No se debe sumar MXN, USD y EUR directamente.

## 11. Integración con el dashboard

### Próximos pagos

`getUpcomingPayments()` debe migrar de consultar `transactions.status = scheduled`
a consultar ocurrencias `scheduled` dentro de los siguientes 45 días. El DTO puede
ampliarse a:

```ts
interface UpcomingPayment {
    id: string;
    name: string;
    amount: number;
    currency: string;
    scheduledDate: Date;
    type: "one_time" | "recurring" | "subscription";
    autoPay: boolean;
    accountName: string | null;
}
```

### Presupuestos

`getBudgetOverview()` debe calcular:

```ts
interface BudgetSummary {
    budgetId: string;
    name: string;
    allocated: number;
    spent: number;
    remaining: number;
    usagePercentage: number;
    status: "healthy" | "warning" | "exceeded";
}
```

El dashboard conserva un estado vacío hasta que exista al menos un presupuesto
activo para el periodo seleccionado.

## 12. Seguridad e integridad

Todas las mutaciones deben:

- obtener `userId` desde la sesión en el servidor;
- ignorar cualquier `userId` enviado por el cliente;
- verificar que cuentas, categorías, reglas y presupuestos pertenezcan al usuario;
- limitar consultas y actualizaciones por `userId`;
- validar el payload con Zod;
- usar `numeric`/strings decimales en persistencia y redondeo explícito;
- revalidar únicamente las rutas afectadas;
- retornar errores de dominio aptos para la UI, sin filtrar errores internos de BD.

Completar una ocurrencia y aplicar su saldo debe ser atómico. Los componentes cliente
nunca calculan ni persisten el nuevo saldo.

## 13. Plan de implementación

### Fase 1 — Esquema y dominio de recurrencias

1. Agregar enums y tablas al esquema Drizzle.
2. Agregar referencias opcionales a `transactions`.
3. Generar y revisar la migración.
4. Implementar y probar el cálculo de próximas fechas.
5. Implementar restricciones e índices de idempotencia.

### Fase 2 — Pagos únicos y ocurrencias

1. Crear la pantalla y formulario de pago programado único.
2. Listar próximas ocurrencias.
3. Completar, omitir y cancelar una ocurrencia.
4. Reutilizar el ledger para aplicar saldos.
5. Conectar el widget “Próximos pagos” del dashboard.

Esta fase valida el ciclo de vida sin introducir todavía un scheduler.

### Fase 3 — Reglas recurrentes

1. Crear, editar, pausar, reanudar y archivar reglas.
2. Generar ocurrencias idempotentes hasta un horizonte de 45 días.
3. Agregar el endpoint interno para scheduler.
4. Habilitar `auto_post` sólo después de probar la confirmación manual.

### Fase 4 — Presupuestos

1. Agregar tablas y migración de presupuestos.
2. Implementar CRUD y asignación de categorías.
3. Crear periodos idempotentes.
4. Calcular progreso desde el ledger.
5. Crear pantalla, estados visuales y filtros.
6. Conectar `getBudgetOverview()` al dashboard.

### Fase 5 — Alertas internas

1. Avisar pagos vencidos o próximos.
2. Avisar presupuestos en umbral o excedidos.
3. Diseñar después persistencia y canales para notificaciones reales.

## 14. Estrategia de pruebas

### Unitarias

- próxima fecha diaria, semanal, mensual y anual;
- intervalo mayor que uno;
- día 29, 30 o 31 en meses cortos y año bisiesto;
- fin de vigencia;
- cálculo de rollover;
- estados healthy, warning y exceeded;
- suma precisa y redondeo monetario.

### Integración

- dos ejecuciones del generador producen una sola ocurrencia;
- completar dos veces una ocurrencia sólo afecta el saldo una vez;
- una ocurrencia cancelada u omitida no altera saldos;
- una regla de otro usuario no puede verse ni modificarse;
- una categoría de otro usuario no puede asignarse;
- editar o cancelar un gasto actualiza inmediatamente el progreso del presupuesto;
- una transferencia y un pago de tarjeta no aumentan el gasto presupuestado;
- una categoría archivada sigue apareciendo en datos históricos;
- los límites de periodo no duplican transacciones a medianoche.

### Interfaz

- formularios muestran errores Zod junto al campo;
- el modal conserva fluidez en desktop y mobile;
- los estados vacíos ofrecen un CTA claro;
- completar una ocurrencia actualiza lista, dashboard y saldo;
- el foco vuelve al disparador al cerrar el modal;
- las animaciones respetan reducción de movimiento.

### Comprobaciones técnicas

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Cuando se agregue una herramienta de pruebas, conviene incorporar scripts separados
para unitarias e integración antes de activar el cron en producción.

## 15. Criterios de aceptación

El módulo de recurrencias está terminado cuando:

- un usuario puede programar un pago único y una regla recurrente;
- el generador no duplica ocurrencias al reintentarse;
- completar un pago modifica el saldo exactamente una vez;
- pausar una regla no elimina su historial;
- los próximos 45 días aparecen correctamente en el dashboard;
- ninguna operación permite acceder a datos de otro usuario.

El módulo de presupuestos está terminado cuando:

- un usuario puede crear, editar y archivar presupuestos;
- puede asignar una o más categorías de gasto;
- el progreso se calcula desde gastos completados del periodo;
- editar o cancelar movimientos se refleja sin reconciliación manual;
- el rollover genera el siguiente periodo una sola vez;
- el dashboard muestra el resumen y los presupuestos que requieren atención.

## 16. Recomendación final

El primer PR debe cubrir únicamente esquema, cálculo de recurrencia e idempotencia.
El segundo debe entregar pagos programados manuales y su integración con el ledger.
El tercero agrega automatización recurrente. Presupuestos comienza después de que ese
ciclo esté probado.

Esta separación reduce el riesgo principal: automatizar un movimiento antes de
garantizar que un reintento no pueda alterar el saldo dos veces.
