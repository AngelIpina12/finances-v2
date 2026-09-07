# Plan técnico: ciclos de tarjeta y previsión de liquidez

## 1. Propósito

Esta ampliación cierra la fase 7 de previsión financiera. Su objetivo es responder,
para una fecha futura concreta, cuánto dinero líquido probablemente tendrá el usuario
después de considerar:

- ingresos programados y recurrentes;
- gastos futuros en efectivo, débito y wallets;
- compras y suscripciones previstas en tarjetas de crédito;
- fechas de corte y plazos de pago expresados en días naturales;
- mensualidades de financiamientos ya registrados;
- pagos de tarjeta desde una cuenta líquida elegida;
- recibos y otros compromisos programados.

La previsión seguirá siendo un modelo de lectura. Nunca completará ocurrencias, creará
transacciones reales ni modificará saldos automáticamente.

```text
Saldo líquido actual
  + ingresos previstos
  - gastos directos previstos
  - pagos previstos de tarjetas
  - cuotas de financiamiento
  = liquidez proyectada en una fecha
```

## 2. Estado actual

El proyecto ya dispone de:

- cuentas financieras con saldo actual, moneda, límite, deuda, día de corte y día de
  pago;
- transacciones completadas como fuente real del ledger;
- ocurrencias manuales y reglas recurrentes;
- financiamientos con cuotas y cuenta prevista de pago opcional;
- previsión de 30, 60 y 90 días por cuenta;
- alertas de saldo insuficiente y exceso del límite de crédito;
- flujo semanal o mensual de una cuenta seleccionada.

La implementación actual puede aumentar la deuda prevista de una tarjeta cuando se
programa una compra y puede proyectar una cuota MSI cuando el financiamiento tiene una
cuenta prevista de pago. Todavía no convierte automáticamente los gastos ordinarios
de tarjeta en pagos futuros según su ciclo de facturación.

## 3. Diferencia entre gasto, deuda y liquidez

Un gasto hecho con tarjeta tiene dos momentos financieros diferentes:

```text
Fecha de compra
  → aumenta la deuda de la tarjeta
  → todavía no reduce el dinero líquido

Fecha de pago
  → reduce la cuenta bancaria elegida
  → reduce la deuda de la tarjeta
```

Por lo tanto, una suscripción de $299 cargada a BBVA Platinum el 20 de septiembre no
debe reducir la cuenta de débito el día 20. Primero debe asignarse al ciclo correcto y
después proyectarse como parte del pago de la tarjeta en su fecha límite.

Los presupuestos tampoco representan por sí solos un gasto futuro. Para que un gasto
afecte la previsión debe existir como ocurrencia programada, recurrencia, cuota o
estimación explícitamente habilitada.

## 4. Alcance funcional

### 4.1 Configuración de pago por tarjeta

Cada tarjeta podrá configurar:

- cuenta líquida prevista para pagarla;
- estrategia de pago;
- día de corte;
- número de días naturales disponibles después del corte;
- saldo del estado de cuenta vigente;
- pago mínimo vigente;
- inclusión o exclusión de la tarjeta en la previsión.

Estrategias iniciales:

```text
full_statement   Pagar el saldo completo proyectado del estado de cuenta
minimum_payment  Pagar el mínimo informado por el usuario
fixed_amount     Pagar una cantidad fija configurada
manual           Mostrar el compromiso sin descontar una cuenta automáticamente
```

La estrategia recomendada por defecto será `full_statement`, pero una tarjeta sin
configuración conservará el comportamiento actual: mostrará deuda y compromisos sin
inventar un pago líquido.

### 4.2 Ciclos proyectados de tarjeta

Para cada gasto futuro asociado a una tarjeta:

1. localizar el siguiente corte aplicable en `America/Mexico_City`;
2. asignar el gasto al periodo que termina en ese corte;
3. sumar al corte el plazo configurado en días naturales para obtener la fecha límite;
4. acumular los cargos del mismo ciclo;
5. generar un pago virtual según la estrategia configurada;
6. aplicar el pago virtual a la cuenta líquida y a la deuda proyectada.

La regla será determinista:

```text
fecha límite = fecha de corte real + payment_term_days
```

El día de corte se considera el día cero. Por ejemplo, con corte el día 24 y un plazo
de 20 días naturales:

```text
Compra del 20 de septiembre → corte 24 de septiembre → pago 14 de octubre
Compra del 26 de septiembre → corte 24 de octubre    → pago 13 de noviembre
```

Los días son naturales: sábados, domingos y días festivos cuentan y no desplazan el
resultado. Los cortes configurados para el día 29, 30 o 31 se ajustan al último día
válido del mes y después se suman los días del plazo. Todos los rangos usan inicio
inclusivo y fin exclusivo.

La fecha límite es un valor derivado y no se captura con un date picker. Si el
vencimiento derivado del estado vigente ya quedó en el pasado y continúa existiendo
`statement_balance`, la previsión lo mostrará como vencido y lo considerará exigible
desde `now`.

### 4.3 Dinero líquido consolidado

La aplicación distinguirá cuentas líquidas de deuda e inversión. Inicialmente serán
líquidas:

- `cash`;
- `debit`;
- `wallet`.

Se propone agregar `include_in_liquidity` a `financial_accounts` para permitir que el
usuario cambie esta clasificación. `credit`, `loan`, `investment` y `fixed_income`
iniciarán fuera de la liquidez, salvo elección explícita compatible con sus reglas.

El consolidado siempre se calcula por moneda. MXN, USD, EUR y GBP nunca se sumarán sin
una política explícita de conversión.

### 4.4 Navegación temporal

La vista `/forecast` permitirá:

- seleccionar una fecha inicial y final dentro de un máximo razonable;
- usar presets de 30, 60 y 90 días;
- agrupar por día, semana o mes;
- filtrar por moneda;
- ver todas las cuentas líquidas o una cuenta concreta;
- inspeccionar el saldo inmediatamente posterior a cada evento;
- distinguir valores reales, programados y calculados.

## 5. Modelo de datos propuesto

### 5.1 `credit_card_payment_settings`

Se recomienda una tabla separada para no seguir ampliando `financial_accounts` con
preferencias que sólo corresponden a tarjetas.

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `user_id` | `text` | FK a Better Auth, cascade |
| `credit_account_id` | `uuid` | FK a `financial_accounts`, unique |
| `source_account_id` | `uuid` | FK a cuenta líquida, restrict |
| `strategy` | enum | Estrategia de pago |
| `fixed_amount` | `numeric(15,2)` | Requerido sólo para `fixed_amount` |
| `payment_term_days` | `integer` | Días naturales después del corte, entre 1 y 90 |
| `include_in_forecast` | `boolean` | `true` por defecto |
| `created_at` | `timestamptz` | Auditoría |
| `updated_at` | `timestamptz` | Auditoría |

Restricciones:

- una configuración activa por tarjeta;
- tarjeta y cuenta de pago pertenecen al mismo usuario;
- ambas cuentas usan la misma moneda;
- la cuenta de origen no puede ser la misma tarjeta ni otra cuenta de crédito;
- `payment_term_days` debe ser un entero entre 1 y 90;
- `fixed_amount > 0` cuando la estrategia sea `fixed_amount`;
- nunca aceptar `user_id` desde el cliente.

### 5.2 Cambios en `financial_accounts`

Agregar:

```text
include_in_liquidity boolean not null
```

Los campos actuales continúan teniendo estas responsabilidades:

```text
billing_date      día habitual de corte
due_date          campo legado; dejará de alimentar la previsión
statement_balance saldo vigente informado por la institución
minimum_payment   mínimo vigente informado por la institución
owed_amount       deuda total actual
```

La implementación conservará inicialmente `due_date` para no romper datos ni
migraciones anteriores, pero la nueva previsión usará `billing_date` junto con
`credit_card_payment_settings.payment_term_days`. No se intentará convertir
automáticamente un día fijo de pago en un plazo, porque esa conversión cambia según
el mes.

`statement_balance` y `minimum_payment` son snapshots editables; no se derivarán de
todo el historial, porque pueden incluir intereses, promociones, comisiones y ajustes
externos que la aplicación todavía no conoce.

### 5.3 Proyecciones no persistidas

No se crearán inicialmente tablas para ciclos o saldos proyectados. Se usarán tipos de
dominio calculados en memoria:

```ts
type ProjectedCardCycle = {
    creditAccountId: string;
    closesAt: Date;
    dueAt: Date;
    projectedCharges: number;
    trackedInstallments: number;
    expectedPayment: number | null;
};

type LiquidityPoint = {
    occurredAt: Date;
    accountId: string;
    source: "income" | "direct_expense" | "card_payment" | "financing";
    delta: number;
    accountBalanceAfter: number;
    totalLiquidityAfter: number;
};
```

Esto evita guardar datos derivados que pueden quedar obsoletos cuando una ocurrencia,
cuota o saldo cambia.

## 6. Regla para no duplicar MSI

La compra original a MSI ya incrementó la deuda completa de la tarjeta. Sus cuotas
representan pagos de esa deuda, no gastos nuevos.

Por ello:

- una cuota de `financing_installments` genera un pago proyectado;
- nunca vuelve a generar un gasto;
- el pago reduce la cuenta líquida prevista y la deuda de la tarjeta;
- el motor de estado de cuenta no debe volver a sumar la compra original futura;
- si el `statement_balance` informado ya incluye una cuota rastreada, el sistema debe
  restar esa cuota del componente no rastreado antes de generar el pago del estado.

La composición propuesta para el próximo pago es:

```text
componente no rastreado
  = max(0, statement_balance - cuotas rastreadas incluidas en el vencimiento)

pago total previsto
  = componente no rastreado
  + cuotas MSI rastreadas
  + cargos futuros asignados al ciclo
```

La interfaz debe mostrar este desglose para que el usuario pueda detectar una
configuración incorrecta.

## 7. Fuentes y precedencia

El motor debe procesar información en este orden:

1. saldos actuales de cuentas;
2. estado de cuenta vigente informado por el usuario;
3. ocurrencias programadas no completadas ni canceladas;
4. recurrencias calculadas que aún no tengan ocurrencia materializada;
5. cuotas de financiamiento pendientes;
6. pagos virtuales de tarjeta calculados por ciclo;
7. estimación opcional de presupuesto, inicialmente deshabilitada.

Una ocurrencia materializada siempre tiene precedencia sobre la regla recurrente que
la originó. Así se respetan cambios manuales, omisiones y cancelaciones sin duplicar
fechas o montos.

## 8. Arquitectura propuesta

```text
src/features/forecast/
├── components/
│   ├── forecast-client.tsx
│   ├── forecast-controls.tsx
│   ├── liquidity-summary.tsx
│   ├── liquidity-timeline.tsx
│   ├── cash-flow-table.tsx
│   └── credit-card-cycle-list.tsx
├── domain/
│   ├── forecast-calculator.ts
│   ├── credit-card-cycle.ts
│   ├── liquidity-calculator.ts
│   └── forecast.types.ts
├── queries/
│   └── get-forecast-data.ts
└── utils/
    └── forecast-filters.ts

src/features/accounts/
├── application/use-cases/
│   └── save-credit-card-payment-settings.ts
├── domain/
│   └── credit-card-payment-settings-repository.ts
├── infrastructure/
│   └── drizzle-credit-card-payment-settings-repository.ts
├── schemas/
│   └── credit-card-payment-settings.schema.ts
├── utils/
│   └── credit-card-payment-settings-draft.ts
└── components/
    └── credit-card-payment-settings-form.tsx
```

Las queries de previsión pueden leer directamente con Drizzle. Guardar preferencias
de pago pasa por Server Action, Zod, caso de uso y repositorio porque relaciona dos
cuentas financieras y requiere validar propiedad y moneda.

## 9. Experiencia de usuario

### Configuración de tarjeta

En el formulario o detalle de cada tarjeta se agregará una sección “Plan de pago”:

```text
Cuenta de pago prevista   [BBVA Débito]
Estrategia                [Pagar saldo completo]
Fecha de corte            [24]
Días naturales para pagar [20]
Saldo del estado vigente  [$8,450]
Pago mínimo               [$620]
Próximo vencimiento       14/10/2026 (calculado)
Incluir en previsión      [Sí]
```

El formulario mostrará el próximo vencimiento como vista previa de solo lectura y lo
recalculará al cambiar el día de corte o el plazo. No habrá un date picker para la
fecha límite.

Se mantendrán los patrones actuales:

- React Hook Form con `Controller` para selects;
- Zod con validación inmediata;
- draft para `defaultValues`;
- Server Action autenticada;
- botones con `cursor-pointer`;
- animaciones discretas con Framer Motion;
- errores mediante toast;
- confirmación sólo para acciones que puedan cambiar información sensible.

### `/forecast`

La cabecera mostrará:

- moneda;
- rango de fechas;
- agrupación diaria, semanal o mensual;
- filtro de cuenta.

El resumen mostrará:

```text
Liquidez hoy
Ingresos previstos
Salidas previstas
Liquidez mínima del periodo
Liquidez al final del periodo
```

La línea de tiempo combinará eventos y permitirá expandir cada pago de tarjeta para
ver sus cargos, cuotas y estado de cuenta. Los eventos calculados deben llevar la
etiqueta “Proyectado”; nunca deben parecer transacciones confirmadas.

## 10. Casos de uso y funciones de dominio

```text
saveCreditCardPaymentSettings
getCardCycleForCharge
getDueDateAfterClosing
buildProjectedCardCycles
getExpectedCardPayment
buildLiquidityTimeline
getLiquidityAt
aggregateCashFlow
```

Las funciones de fechas y dinero serán puras y recibirán `now` explícitamente para
que las pruebas no dependan del reloj del sistema.

## 11. Plan de implementación

### Incremento 1 — Semántica y dominio

- definir tipos de ciclos, pagos y liquidez;
- implementar corte y suma de días naturales en zona local;
- implementar estrategias de pago;
- documentar y probar la deduplicación de MSI;
- probar meses cortos y cambio de año.

### Incremento 2 — Configuración persistente

- agregar enum y `credit_card_payment_settings`;
- agregar `include_in_liquidity` con backfill seguro;
- crear migración Drizzle;
- implementar schema Zod, draft, caso de uso y repositorio;
- integrar el formulario respetando el patrón visual de cuentas.

### Incremento 3 — Read model completo

- ampliar `getForecastData`;
- calcular ciclos de compras previstas;
- generar pagos virtuales de tarjeta;
- combinar ingresos, gastos directos, pagos y cuotas;
- mantener separación estricta por moneda y usuario.

### Incremento 4 — Interfaz de liquidez

- controles de rango y agrupación;
- resumen consolidado;
- línea de tiempo con saldo acumulado;
- detalle expandible de pagos de tarjeta;
- warnings de liquidez negativa, vencimiento y límite de crédito;
- loading equivalente a la pantalla real.

### Incremento 5 — Pruebas y cierre

- pruebas unitarias de fechas, pagos, deduplicación y liquidez;
- pruebas de integración con PostgreSQL aislado;
- prueba manual de escenarios completos;
- lint, TypeScript y build de producción;
- aplicar migración a desarrollo sólo después de revisar el SQL.

## 12. Pruebas esenciales

### Fechas de tarjeta

- compra antes, durante y después del corte;
- corte en día 29, 30 o 31 y ajuste antes de sumar el plazo;
- plazo que cruza un fin de semana o día festivo sin desplazar el resultado;
- vencimiento que cruza de diciembre a enero;
- año bisiesto y febrero;
- fecha en `America/Mexico_City` cercana a medianoche;
- rango con inicio inclusivo y fin exclusivo.

### Estrategias

- pago completo;
- pago mínimo;
- monto fijo menor y mayor que la deuda;
- estrategia manual sin afectar liquidez;
- cuenta de pago archivada o en moneda diferente.

### MSI

- compra original no vuelve a contarse como gasto;
- cada cuota aparece una sola vez;
- cuota cancelada no afecta la previsión;
- cuota pagada deja de ser futura;
- pago reduce débito y deuda de tarjeta por el mismo monto;
- estado de cuenta con una cuota incluida no duplica la salida.

### Liquidez

- nómina semanal y pago mensual recibidos antes de un vencimiento;
- recibos y mandado recurrente;
- múltiples tarjetas pagadas desde la misma cuenta;
- cuentas líquidas distintas en la misma moneda;
- monedas diferentes nunca se suman;
- saldo negativo intermedio aunque el cierre del mes termine positivo;
- filtros de día, semana, mes y fecha arbitraria.

### Integración

- aislamiento por `user_id`;
- sólo ocurrencias `scheduled`;
- recurrencias futuras sin duplicar las materializadas;
- exclusión de cuentas archivadas;
- configuración y cuenta de pago pertenecen al mismo usuario;
- migración aplicable desde una base vacía.

## 13. Escenario de aceptación principal

Configurar:

- mandado mensual de $3,200 en BBVA Platinum;
- nómina semanal cada jueves en BBVA Débito;
- ingreso mensual de otra persona;
- recibos recurrentes;
- suscripciones en distintas tarjetas;
- MSI en BBVA Oro, BBVA Platinum y Mercado Pago;
- cuenta de pago y estrategia para cada tarjeta.

El usuario selecciona una semana, mes o fecha futura y la aplicación debe mostrar:

1. ingresos que ya deberían haber ocurrido para ese instante;
2. gastos directos que ya deberían haberse pagado;
3. deuda esperada de cada tarjeta;
4. estados de cuenta y cuotas que deberían haberse cubierto;
5. cuentas líquidas utilizadas para cada pago;
6. saldo líquido por cuenta y total por moneda;
7. primer momento en que faltaría dinero, si ocurre;
8. desglose completo que explique cada cifra.

## 14. Fuera de alcance

- convertir monedas automáticamente;
- descargar estados de cuenta desde bancos;
- calcular intereses reales por saldo insoluto;
- recomendar endeudamiento o inversiones;
- completar pagos automáticamente;
- escenarios probabilísticos avanzados;
- reportes e insights históricos.

Los reportes históricos serán una fase separada y consumirán transacciones reales;
esta ampliación se concentra exclusivamente en eventos futuros y liquidez probable.

## 15. Decisiones que deben aprobarse antes de implementar

1. Usar `full_statement` como estrategia inicial recomendada.
2. Tratar `statement_balance` como el saldo próximo a vencer informado por el banco.
3. Calcular la fecha límite sumando `payment_term_days` a la fecha real de corte, con
   el corte como día cero y sin ajustes por fines de semana o festivos.
4. Restar cuotas MSI rastreadas del estado informado antes de calcular el componente
   no rastreado.
5. Considerar líquidas por defecto sólo efectivo, débito y wallets.
6. Mantener desactivada la estimación por presupuestos hasta que el usuario la habilite
   explícitamente en una ampliación posterior.
7. Mantener todas las proyecciones separadas por moneda.

## 16. Criterio de cierre

Esta ampliación estará terminada cuando el usuario pueda elegir una fecha futura y
obtener una cifra de liquidez explicable, reproducible y separada por moneda, donde
cada variación pueda rastrearse hasta un ingreso, gasto directo, cuota o pago de
tarjeta proyectado, sin crear movimientos reales ni contabilizar dos veces una deuda.
