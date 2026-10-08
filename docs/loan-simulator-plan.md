# Plan técnico: simulador de créditos y tabla de amortización

## 1. Propósito

Agregar una sección para **cotizar créditos de forma simulada** (auto, personal, etc.)
a partir de los datos de una cotización bancaria, generar su tabla de amortización,
guardarla, comparar escenarios (MSI vs. tasa con bono, abonos a capital) y ver su
impacto en la previsión financiera existente.

Igual que la previsión, el simulador es un **modelo de lectura**: nunca crea
transacciones reales ni modifica saldos. Solo la fase 4 (opcional) convierte una
simulación en un financiamiento real, y siempre por acción explícita del usuario.

```text
Datos de la cotización ──► calculadora pura ──► tabla de amortización
                                                   │
                         escenarios (abonos) ◄─────┤
                                                   ▼
                         previsión (saldo diario / semanal / mensual)
```

## 2. Estado actual que se reutiliza

- `financingPlans` / `financingInstallments` + `buildInstallmentSchedule`
  (`src/features/financing/domain/installment-schedule.ts`): cuotas reales que ya
  alimentan la previsión vía `scheduledOccurrences`.
- `forecastSavingsSimulations` + `forecastViews.savingsSimulationId`: patrón de
  "simulación guardada que la previsión aplica si la eliges". El simulador de crédito
  seguirá el mismo patrón.
- `forecast/domain/*`: funciones puras con tests; la calculadora vivirá igual.

## 3. Caso de referencia (test de aceptación)

Cotización KIA K3 2027 (plan 7.90% 06-26 PF 60). El dominio debe reproducir la tabla
**al centavo**:

| Dato | Valor |
|---|---|
| Precio de venta | 372,600.00 |
| Enganche | 50% = 186,300.00 |
| Seguro de auto año 1 (financiado) | 17,523.96 |
| Monto a financiar | 203,823.96 |
| Comisión por apertura (con IVA) | 2.32% = 4,728.72 (pago inicial) |
| Tasa | 7.90% anual simple sin IVA → 9.164% con IVA |
| Plazo | 12 meses, primer vencimiento 29-08-2026 |
| Seguro de vida | 798.32 fijo mensual |
| Mensualidad total | 18,638.16 |

Comprobaciones clave:

- Tasa mensual = 7.90% × 1.16 / 12 = 0.76367%.
- Intereses + IVA mes 1 = 203,823.96 × 0.76367% = 1,555.86.
- Pago capital + intereses (anualidad francesa) = 17,839.84; + vida 798.32 = 18,638.16.
- El capital amortizado se reparte proporcionalmente entre vehículo y seguro
  (17,523.96 / 203,823.96 ≈ 8.6%): mes 1 → 14,883.95 / 1,400.03.
- Fecha de pago se recorre al siguiente día hábil (29-08-2026 sáb → 31-08-2026).

---

## Fase 1 — Calculadora, formulario y guardado

### 1.1 Dominio (`src/features/loan-simulations/domain/`)

`amortization-calculator.ts` — funciones puras, todo en centavos para evitar errores
de redondeo:

- **Entrada** (`LoanSimulationInput`):
  - `price`, `downPayment` (monto o %), `bonus` (descuento al precio, opcional).
  - `financedExtras`: seguro de auto financiado, accesorios, GAP (cada uno con su
    monto; se amortizan proporcionalmente).
  - `rateType`: `interest` | `msi`.
  - `annualRate`, `rateIncludesVat` (bool), `vatRate` (default 16%).
  - `termMonths`, `firstDueDate`, `shiftToBusinessDay` (bool).
  - `openingFee`: `{ mode: "percent" | "amount", value, includesVat, financed: bool }`.
  - `lifeInsurance`:
    - `{ mode: "fixed", monthlyAmount }` — cuota igual cada mes (caso de referencia).
    - `{ mode: "balance", ratePerThousand }` — % sobre saldo insoluto al inicio de
      cada periodo; la cuota baja mes a mes.
    - `{ mode: "none" }`.
  - `carInsuranceAfterYearOne` (opcional): importe anual del resto del plazo,
    financiado o pagado aparte.
- **Salida** (`AmortizationSchedule`):
  - Filas: `sequence`, `dueDate`, `paymentDate`, `openingBalance`,
    `principalVehicle`, `principalExtras`, `interestWithVat`, `lifeInsurance`,
    `totalPayment`, `closingBalance`.
  - Resumen: pago inicial total, total de intereses, total de seguros, costo total
    del crédito, CAT aproximado (TIR de flujos), fecha de liquidación.
- **Reglas**:
  - `interest`: anualidad francesa sobre tasa mensual (con IVA sobre intereses).
  - `msi`: cuota = saldo / meses, intereses 0; el seguro de vida igual aplica si se
    configura.
  - Ajuste del último pago para que el saldo cierre exactamente en 0.
  - Día hábil: fines de semana; días festivos de México como lista configurable
    (empezar con fines de semana y validar contra la tabla de referencia).

Tests (`amortization-calculator.test.ts`):
- Caso de referencia al centavo (las 12 filas).
- MSI 36 meses (caso $260,960 → ~7,248.89).
- Seguro de vida sobre saldo (cuota decreciente, total menor que fijo a igual tasa).
- Comisión financiada vs. de contado.
- Tasa con y sin IVA incluido.

### 1.2 Persistencia

Tabla `loan_simulations`:

| Columna | Tipo | Nota |
|---|---|---|
| `id`, `userId` | uuid / text | FK a `users`, cascade |
| `name` | text | "KIA K3 – MSI 36" |
| `currency` | enum | MXN por ahora |
| `input` | jsonb | `LoanSimulationInput` validado con zod |
| `notes` | text | opcional |
| `createdAt`, `updatedAt` | timestamp | |

Se guardan **solo las entradas**; la tabla se calcula al vuelo. Así, corregir una
tasa recalcula todo y no hay filas desactualizadas.

### 1.3 UI (`app/(private)/loan-simulator/`)

- Lista de simulaciones guardadas (nombre, mensualidad, plazo, costo total).
- Formulario por secciones: Vehículo / Enganche y bono / Crédito / Comisión /
  Seguros. Vista previa en vivo de la mensualidad mientras se captura.
- Detalle: tarjetas de resumen + tabla de amortización con columnas como la
  cotización del banco; export CSV.
- Server actions: crear, editar, duplicar, eliminar.

**Entregable:** capturar la cotización de referencia y obtener la misma tabla.

---

## Fase 2 — Escenarios: comparador y abonos a capital

### 2.1 Abonos a capital

Extender el dominio con `prepayments`:

- `{ type: "once", date, amount }` y `{ type: "recurring", startDate, everyMonths, amount, endDate? }`.
- Estrategia por escenario: **reducir plazo** (misma cuota, termina antes) o
  **reducir cuota** (mismo plazo, se recalcula la anualidad tras cada abono).
- Con seguro de vida sobre saldo, el abono también reduce la prima; con fijo, solo
  se ahorra en los meses eliminados (reducir plazo).

### 2.2 Escenarios

Tabla `loan_simulation_scenarios` (`simulationId`, `name`, `prepayments` jsonb,
`strategy`) o bien escenarios embebidos en `input`; decidir al implementar según
cuántos se usen.

### 2.3 Comparador

Vista lado a lado de 2–4 simulaciones/escenarios:

- Pago inicial, mensualidad, total pagado, intereses, mes de liquidación, CAT.
- Diferencia contra la opción base (ej. "Bono + abono $1,500/mes ahorra $X vs. MSI").
- Punto de equilibrio: abono mensual mínimo para que la opción con bono iguale o
  supere a MSI (búsqueda numérica sobre el dominio).
- Gráfica de saldo insoluto en el tiempo por escenario.

**Entregable:** reproducir la conclusión del caso MSI vs. bono ($40k, 11.84%) con
números del sistema.

---

## Fase 3 — Integración con la previsión

- `forecastViews.loanSimulationIds` (jsonb) o columna `loanScenarioId`, análogo a
  `savingsSimulationId`.
- Selector en `forecast-adjust-sheet` / toolbar: "Incluir crédito simulado:
  [ninguno / KIA – MSI 36 / KIA – Bono + abonos]" y cuenta de pago.
- `get-forecast-data` convierte la simulación en movimientos virtuales:
  - Pago inicial (enganche + comisión + seguro de contado) como salida única.
  - Mensualidades (y abonos a capital del escenario) en sus fechas de pago.
  - Marcados como `source: "loan_simulation"` para distinguirlos visualmente
    (línea punteada / badge "Simulado").
- Compatible con el barrido a cajitas: si el enganche o los abonos bajan una cuenta
  del mínimo, la simulación de ahorro retira de la cajita y se ve el efecto en el
  saldo y los rendimientos.
- Cifras clave: saldo mínimo con y sin el crédito, y fecha del mínimo.

**Entregable:** en la previsión, alternar entre "sin crédito", "MSI" y "Bono +
abonos" y ver el saldo diario/semanal/mensual de cada uno.

---

## Fase 4 (opcional) — Convertir simulación en financiamiento real

- Acción "Contratar" en el detalle: crea un `financingPlan` con sus
  `financingInstallments` (montos variables si el seguro es sobre saldo; hoy
  `buildInstallmentSchedule` asume cuota regular + balloon, habría que admitir un
  calendario explícito).
- Requiere: cuenta de crédito, cuenta de pago, transacción de compra/enganche.
- La simulación queda vinculada (`financingPlanId`) y en solo lectura.

---

## 4. Decisiones

| Tema | Decisión |
|---|---|
| Seguro de vida | Ambas modalidades: fijo (default) y sobre saldo |
| Cálculo | Dominio puro en centavos; tabla calculada al vuelo |
| Moneda | MXN; el modelo admite `currency` para ampliar después |
| Abonos | Únicos y recurrentes (fase 2) — *por confirmar* |
| Fase 4 | Opcional — *por confirmar* |
| Días festivos | Solo fines de semana al inicio — *por confirmar* |

## 5. Limitaciones

- Es un estimado: cada banco puede usar base de días distinta (30/360 vs. días
  reales), redondeos o seguros con reglas propias. La meta es igualar cotizaciones
  tipo "tasa anual simple + IVA sobre intereses", la más común en México.
- El CAT calculado es aproximado y no sustituye al oficial de la cotización.
