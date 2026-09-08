# Hoja de ruta posterior a previsión: inversiones, reportes e insights

## 1. Recomendación ejecutiva

Después de cerrar la fase 7 de previsión, el orden recomendado es:

| Fase | Módulo | Objetivo |
| --- | --- | --- |
| 8 | Renta fija | Registrar aportaciones, rendimiento, vencimiento y devolución a una cuenta líquida |
| 9 | Reportes históricos | Explicar qué ocurrió realmente con ingresos, gastos, deuda y patrimonio |
| 10 | Inversiones de mercado | Posiciones, lotes, compras, ventas, precios y rendimiento |
| 11 | Metas y préstamos | Convertir la previsión y el patrimonio en decisiones y seguimiento |
| 12 | Plataforma financiera | Preferencias, divisas, etiquetas, adjuntos, exportación y notificaciones |

La fase 8 debe ir antes de los reportes completos. Así la reportería nace entendiendo
la diferencia entre transferir capital a una inversión, recibir intereses y retirar
principal. Si los reportes se implementaran primero, esas operaciones podrían verse
incorrectamente como gastos o ingresos ordinarios.

No se recomienda implementar renta fija e inversiones bursátiles en el mismo módulo.
Aunque ambas forman parte del patrimonio, sus reglas, valuación y operaciones son
distintas.

## 2. Base disponible en el proyecto

El proyecto ya cuenta con fundamentos suficientes:

- cuentas `investment` y `fixed_income` en el enum financiero;
- transferencias atómicas entre cuentas;
- transacciones reales como ledger;
- movimientos programados y recurrencias;
- financiamientos y cuotas;
- presupuestos por categoría;
- previsión de liquidez y pagos de tarjetas;
- separación por usuario y moneda;
- base PostgreSQL exclusiva para integración.

Los tipos `investment` y `fixed_income` actuales sólo clasifican cuentas. Todavía no
representan un contrato de inversión, una tasa, un plazo, una valuación ni un
vencimiento.

## 3. Principios contables para inversiones

### 3.1 Aportar no es gastar

Mover $10,000 desde una cuenta de débito hacia renta fija debe registrarse como una
transferencia:

```text
Débito                         -$10,000
Cuenta de renta fija           +$10,000
Ingreso reportado                    $0
Gasto reportado                      $0
Patrimonio neto                  sin cambio
Liquidez                       -$10,000
```

La liquidez disminuye porque el dinero deja de estar inmediatamente disponible, pero
el patrimonio no disminuye.

### 3.2 El interés sí es rendimiento

Cuando se reconoce interés:

- si se reinvierte, aumenta el valor de la cuenta de renta fija;
- si se deposita en débito, crea un ingreso en la cuenta receptora;
- una retención fiscal debe registrarse separada del interés bruto;
- los reportes deben distinguir rendimiento devengado y rendimiento realizado.

### 3.3 El vencimiento devuelve capital

Al vencer la inversión:

```text
Principal devuelto   transferencia de renta fija a débito
Interés pagado       ingreso financiero
Retención            gasto/impuesto o deducción del interés bruto
```

Nunca se debe registrar todo el depósito recibido como ingreso, porque parte de él es
la devolución del capital que ya pertenecía al usuario.

## 4. Fase 8 — Renta fija

### 4.1 Alcance inicial

La primera versión debe soportar:

- inversión a plazo con tasa fija;
- cuenta de débito, efectivo o wallet que aporta el capital;
- cuenta líquida en la que se recibirá el vencimiento;
- inversión simple o con capitalización;
- tasa anual;
- base de cálculo `actual/360` o `actual/365`;
- fecha de inicio y vencimiento;
- intereses pagados al vencimiento o periódicamente;
- retención opcional;
- renovación manual;
- estado planeado, activo, vencido, liquidado o cancelado;
- inclusión en patrimonio y exclusión inicial de liquidez.

Ejemplos que debe poder representar:

- pagaré bancario a 28 días;
- CETE mantenido a vencimiento;
- depósito a plazo;
- inversión flexible con tasa conocida y retiros manuales;
- producto con interés mensual depositado en débito.

No debe intentar todavía descargar tasas de mercado, comprar instrumentos en un
broker ni calcular precios diarios de bonos negociables.

### 4.2 Modelo de datos recomendado

#### `fixed_income_positions`

| Campo | Propósito |
| --- | --- |
| `id` | Identificador de la posición |
| `user_id` | Propietario obtenido desde la sesión |
| `account_id` | Cuenta `financial_accounts` de tipo `fixed_income`, relación uno a uno |
| `funding_account_id` | Cuenta líquida desde la que se aportó el capital |
| `settlement_account_id` | Cuenta líquida que recibirá pagos y vencimiento |
| `name` | Nombre del producto |
| `institution` | Banco o institución |
| `currency` | Misma moneda que las cuentas relacionadas |
| `principal` | Capital original |
| `outstanding_principal` | Capital que sigue invertido |
| `annual_rate` | Tasa anual nominal como decimal |
| `calculation_method` | `simple` o `compound` |
| `day_count_convention` | `actual_360` o `actual_365` |
| `interest_frequency` | `at_maturity`, `monthly` u otra frecuencia soportada |
| `withholding_rate` | Retención opcional como decimal |
| `starts_at` | Inicio del contrato |
| `matures_at` | Vencimiento |
| `auto_renew` | Preferencia; inicialmente sólo informativa |
| `status` | `planned`, `active`, `matured`, `settled`, `cancelled` |
| auditoría | `created_at`, `updated_at` |

#### `fixed_income_cash_flows`

Registra hechos del producto sin duplicar el ledger:

| Campo | Propósito |
| --- | --- |
| `id` | Identificador |
| `position_id` | Posición relacionada |
| `type` | `contribution`, `interest`, `withholding`, `withdrawal`, `maturity` |
| `gross_amount` | Importe antes de retención |
| `tax_amount` | Retención aplicada |
| `net_amount` | Importe neto |
| `occurred_at` | Fecha efectiva |
| `transaction_id` | Ingreso o retención real, cuando corresponda |
| `transfer_group_id` | Transferencia real de principal, cuando corresponda |
| `scheduled_occurrence_id` | Compromiso futuro asociado |

Debe existir una llave de idempotencia para que un vencimiento no se liquide dos
veces.

#### Valuación

En la primera versión no es necesario guardar un devengo diario. La valuación puede
calcularse en memoria para una fecha determinada:

```text
valor estimado = principal pendiente + interés devengado neto estimado
```

Cuando el interés se haga real, se registra el flujo correspondiente. Si más adelante
el volumen lo requiere, puede agregarse `fixed_income_valuation_snapshots` con una
captura diaria o mensual.

### 4.3 Relación con `financial_accounts`

Cada posición tendrá una cuenta financiera propia de tipo `fixed_income`.

- `current_balance` representa principal y rendimientos ya reconocidos en el ledger;
- la valuación calculada puede incluir interés todavía no realizado;
- `include_in_net_worth` estará activado por defecto;
- `include_in_liquidity` estará desactivado por defecto;
- aportar y devolver capital utilizará el caso de uso de transferencias;
- tarjeta de crédito, inversión u otra renta fija no podrán ser cuenta de fondeo en la
  primera versión;
- las tres cuentas deberán pertenecer al mismo usuario y usar la misma moneda.

No conviene guardar sólo `linked_account_id`, como aparece en el DBML original. Es
preferible separar `funding_account_id` y `settlement_account_id`, porque el dinero
puede entrar desde una cuenta y cobrarse en otra.

### 4.4 Casos de uso

```text
createFixedIncomePosition
activateFixedIncomePosition
recordFixedIncomeContribution
projectFixedIncomeAccrual
recordInterestPayment
settleFixedIncomePosition
cancelFixedIncomePosition
renewFixedIncomePosition
getFixedIncomePortfolio
```

Crear, activar o liquidar una posición debe ejecutarse en una transacción SQL cuando
modifique simultáneamente posición, cuenta, transferencia y ocurrencia.

### 4.5 Integración con previsión

La previsión debe incorporar:

- salida de liquidez en la fecha de aportación planeada;
- intereses periódicos que llegarán a una cuenta líquida;
- principal e interés neto esperado en el vencimiento;
- renovación sólo si el usuario la confirma o habilita explícitamente;
- alerta si la cuenta de fondeo no tendrá saldo suficiente;
- separación por moneda.

Una aportación futura reduce liquidez, pero no es un gasto. Un vencimiento aumenta
liquidez, pero sólo el interés neto aumenta el patrimonio.

### 4.6 Interfaz

#### `/fixed-income`

- resumen de capital invertido, interés devengado y próximo vencimiento;
- tarjetas por posición con tasa, plazo, progreso y valor estimado;
- filtros por moneda, institución y estado;
- calendario de intereses y vencimientos;
- acción para aportar, retirar, liquidar o renovar;
- aviso claro de valores estimados frente a movimientos confirmados.

#### Modal de posición

- nombre e institución;
- cuenta de fondeo;
- cuenta de liquidación;
- principal;
- fecha de inicio y vencimiento;
- tasa anual;
- método y base de cálculo;
- frecuencia de intereses;
- retención;
- vista previa de interés bruto, retención, interés neto y monto al vencimiento.

Debe conservar los patrones actuales: React Hook Form, Zod, `Controller`, drafts,
Server Actions, casos de uso, repositorios, toast, Framer Motion y skeletons.

### 4.7 Incrementos

1. Funciones puras de interés, días y vencimiento con pruebas.
2. Tablas, migración y repositorio transaccional.
3. Crear posición y transferencia de aportación.
4. Listado, formulario, detalle y skeleton.
5. Integración con movimientos programados y previsión.
6. Liquidación, cancelación y renovación idempotentes.
7. Pruebas de integración y escenario manual completo.

### 4.8 Pruebas esenciales

- año de 360 frente a 365 días;
- interés simple y compuesto;
- febrero bisiesto;
- aportación desde cuenta ajena, archivada o de otra moneda;
- principal sin saldo suficiente;
- pago de interés reinvertido y depositado en débito;
- retención fiscal;
- vencimiento ejecutado dos veces;
- cancelación antes del vencimiento;
- transferencia de principal sin afectar ingresos ni gastos;
- efecto correcto en patrimonio y liquidez;
- posición de otro usuario inaccesible.

## 5. Fase 9 — Reportes históricos e insights

### 5.1 Propósito

La previsión responde “¿qué probablemente ocurrirá?”. Los reportes responderán:

- ¿qué ocurrió realmente?;
- ¿en qué gasté?;
- ¿cuánto ahorré?;
- ¿cómo cambió mi patrimonio?;
- ¿cuánto rendimiento produjeron mis inversiones?;
- ¿qué cambió respecto al periodo anterior?;
- ¿qué patrones merecen atención?

Sólo las transacciones completadas y hechos de inversión confirmados alimentarán los
resultados históricos. Los eventos proyectados nunca se mezclarán con datos reales.

### 5.2 Reportes iniciales

1. Ingresos, gastos y ahorro neto por periodo.
2. Gastos por categoría y subcategoría.
3. Tendencia mensual y comparación contra el periodo anterior.
4. Cumplimiento de presupuestos.
5. Evolución de patrimonio por moneda.
6. Evolución de deuda y utilización de crédito.
7. Flujo entre cuentas, excluido de ingresos y gastos.
8. Rendimiento de renta fija: bruto, retención, neto y anualizado.
9. Ingresos y gastos recurrentes frente a variables.

### 5.3 Insights explicables

La primera versión debe usar reglas deterministas, no texto generado ni modelos
predictivos. Ejemplos:

- “Alimentos aumentó 18% frente al promedio de los tres meses anteriores”.
- “La utilización de BBVA pasó de 32% a 61%”.
- “Ahorraste 12% del ingreso del mes”.
- “Tres suscripciones representan $840 mensuales”.
- “El rendimiento neto de renta fija fue $520 este trimestre”.
- “El presupuesto de transporte superó su límite durante dos periodos consecutivos”.

Cada insight debe incluir periodo, métrica base, comparación y vínculo hacia los
movimientos que lo explican.

### 5.4 Arquitectura

```text
src/features/reports/
├── components/
│   ├── reports-client.tsx
│   ├── report-controls.tsx
│   ├── income-expense-summary.tsx
│   ├── category-breakdown.tsx
│   ├── net-worth-history.tsx
│   └── insights-panel.tsx
├── domain/
│   ├── report-metrics.ts
│   ├── net-worth-calculator.ts
│   ├── investment-return-calculator.ts
│   └── insight-rules.ts
├── queries/
│   ├── get-report-data.ts
│   └── get-net-worth-history.ts
└── utils/
    └── report-filters.ts
```

Los reportes son read models y pueden consultar con Drizzle directamente. Sólo deben
usar casos de uso y repositorios cuando guarden preferencias, snapshots o
exportaciones.

### 5.5 Historial de saldos y patrimonio

Para cuentas normales, el saldo histórico puede reconstruirse desde el saldo de
apertura y las transacciones ordenadas. Debe reutilizarse la misma semántica de saldo
del dominio de transacciones.

Para inversiones, el precio o interés devengado cambia sin que exista una
transacción. Por ello se necesitarán snapshots de valuación cuando se agreguen activos
de mercado o cuando el cálculo bajo demanda deje de ser suficiente.

Nunca deben sumarse monedas distintas. Hasta implementar tipos de cambio, cada
reporte mostrará una serie independiente por moneda.

### 5.6 Incrementos

1. Contratos de métricas y filtros de fecha/moneda.
2. Ingresos, gastos, ahorro y categorías.
3. Presupuestos y recurrencias.
4. Patrimonio y deuda histórica.
5. Rendimiento de renta fija.
6. Insights deterministas y explicables.
7. Exportación CSV; PDF sólo si se define un formato de reporte estable.
8. Pruebas de integración y rendimiento de queries.

### 5.7 Pruebas esenciales

- transferencias excluidas de ingreso y gasto;
- transacciones canceladas excluidas;
- edición y reversión reflejadas una sola vez;
- filtros por usuario, cuenta, categoría, moneda y rango;
- periodos sin actividad;
- comparación contra periodos de distinta duración;
- tarjetas tratadas como deuda;
- aportaciones de inversión tratadas como transferencias;
- intereses tratados como rendimiento;
- monedas separadas;
- reconstrucción histórica consistente con saldos actuales.

## 6. Fase 10 — Inversiones de mercado

Implementar después de renta fija y del núcleo inicial de reportes:

- instrumentos (`investments`);
- lotes de compra (`investment_lots`);
- compras y ventas vinculadas con transferencias/transacciones;
- precio promedio y costo fiscal básico;
- precios manuales y `investment_prices`;
- ganancias realizadas y no realizadas;
- dividendos;
- valuación histórica y contribución al patrimonio.

La integración automática con brokers debe quedar para un incremento separado. La
primera versión puede usar captura manual o importación CSV.

## 7. Fase 11 — Metas y préstamos

### Metas

- asociar una meta con una cuenta financiera;
- monto objetivo y fecha;
- progreso real y aportación requerida;
- impacto en previsión;
- hitos y notificaciones.

### Préstamos

- principal, tasa, plazo y saldo insoluto;
- tabla de amortización;
- separación entre capital e interés;
- pagos vinculados con transacciones;
- integración con previsión y patrimonio.

Conviene implementar metas antes que recomendaciones automáticas. El sistema debe
conocer qué intenta lograr el usuario antes de sugerir cambios financieros.

## 8. Fase 12 — Plataforma financiera

Capacidades transversales que pueden añadirse por incrementos independientes:

- moneda preferida, zona horaria y locale por usuario;
- tipos de cambio explícitos y fechados;
- etiquetas para análisis transversal;
- adjuntos y comprobantes;
- importación y exportación CSV;
- notificaciones de pagos, vencimientos, presupuestos y metas;
- bitácora de cambios financieros sensibles;
- backups y procedimientos de recuperación;
- endurecimiento de secretos y configuración de producción.

Los tipos de cambio deben almacenar fuente, fecha y tasa utilizada. Una conversión
histórica nunca debe recalcularse silenciosamente con la tasa actual.

## 9. Estructura propuesta para renta fija

```text
src/features/fixed-income/
├── actions/
│   └── fixed-income-actions.ts
├── application/
│   ├── fixed-income-error.ts
│   └── use-cases/
│       ├── create-fixed-income-position.ts
│       ├── record-fixed-income-interest.ts
│       └── settle-fixed-income-position.ts
├── components/
│   ├── fixed-income-client.tsx
│   ├── fixed-income-form.tsx
│   ├── fixed-income-card.tsx
│   ├── fixed-income-summary.tsx
│   └── fixed-income-schedule.tsx
├── domain/
│   ├── fixed-income-calculator.ts
│   ├── fixed-income-repository.ts
│   └── fixed-income.types.ts
├── infrastructure/
│   └── drizzle-fixed-income-repository.ts
├── queries/
│   └── get-fixed-income-data.ts
├── schemas/
│   └── fixed-income.schema.ts
└── utils/
    └── fixed-income-draft.ts
```

## 10. Decisiones que deben fijarse antes de la fase 8

1. Qué productos entrarán en la primera versión: se recomienda pagaré, depósito a
   plazo y CETE mantenido a vencimiento.
2. Si la tasa capturada será nominal anual o rendimiento anual efectivo; se
   recomienda nominal anual con convención explícita.
3. Si el interés se reconoce diariamente sólo como valuación o también en el ledger;
   se recomienda valuación diaria calculada y ledger sólo cuando se realiza.
4. Si se permitirán retiros anticipados; se recomienda registrarlos manualmente con
   penalización opcional, sin intentar inferir reglas del banco.
5. Si la renovación será automática; se recomienda que inicialmente requiera
   confirmación.
6. Cómo representar CETES: inicialmente por principal invertido, tasa/rendimiento y
   valor al vencimiento, dejando precios de mercado fuera de alcance.
7. No habilitar conversión de moneda implícita.

## 11. Criterio de cierre de la fase 8

La fase de renta fija estará terminada cuando el usuario pueda:

1. crear una posición vinculada con una cuenta de fondeo y otra de liquidación;
2. aportar capital mediante una transferencia real sin crear un gasto;
3. consultar principal, interés estimado, retención y valor al vencimiento;
4. ver intereses y vencimiento dentro de previsión;
5. liquidar la posición exactamente una vez;
6. recibir principal e interés con su clasificación correcta;
7. comprobar el efecto separado sobre liquidez y patrimonio;
8. rastrear cada cifra hasta sus movimientos reales o cálculos del contrato.

## 12. Próximo paso recomendado

El siguiente trabajo debe ser un plan técnico detallado exclusivamente para la fase 8,
seguido por la implementación del primer incremento: funciones puras de interés,
convenciones de días y calendario de vencimiento. La migración debe generarse sólo
después de que esas reglas estén aprobadas y cubiertas por pruebas.
