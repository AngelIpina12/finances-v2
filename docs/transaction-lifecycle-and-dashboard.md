# Siguiente incremento: ciclo de vida de transacciones y dashboard real

El módulo de categorías ya cuenta con ruta, formulario, acciones, query, reglas de
dominio e infraestructura Drizzle. No debe reconstruirse antes de continuar.

El siguiente objetivo es garantizar que el ledger financiero sea corregible y
confiable. Sólo después deben implementarse transferencias y el dashboard con datos
reales.

## 1. Orden de trabajo

```text
1. Integridad de categorías
2. Edición y cancelación de transacciones
3. Transferencias entre cuentas
4. Queries reales del dashboard
5. Pagos recurrentes y presupuestos
```

## 2. Integridad de categorías

La regla de unicidad de una categoría debe aplicarse sólo mientras esté activa.
Esto permite archivar `Comida` y crear posteriormente una nueva categoría activa con
el mismo nombre y tipo.

La restricción e índice objetivo en PostgreSQL son:

```sql
CREATE UNIQUE INDEX categories_active_user_type_name_idx
  ON categories (user_id, type, name)
  WHERE deleted_at IS NULL;

CREATE INDEX categories_active_user_type_sort_order_idx
  ON categories (user_id, type, sort_order)
  WHERE deleted_at IS NULL;
```

La migración debe sustituir el índice único actual que no considera `deleted_at`.

## 3. Edición de transacciones

Una transacción completada ya afectó el saldo de una cuenta. Por eso editarla no es
un `UPDATE` directo: primero debe revertirse el efecto anterior y después aplicarse
el nuevo, todo dentro de una sola transacción SQL.

```text
BEGIN
  1. Leer y validar el movimiento original por user_id.
  2. Revertir su efecto en la cuenta original.
  3. Validar cuenta y categoría nuevas.
  4. Aplicar el efecto del movimiento actualizado.
  5. Actualizar la fila transactions.
COMMIT
```

### Efectos de saldo

| Cuenta | Ingreso | Gasto |
|---|---:|---:|
| Efectivo, débito, wallet | suma | resta |
| Crédito | reduce deuda | aumenta deuda |

Para una tarjeta de crédito, cualquier cambio debe recalcular también:

```text
availableCredit = max(0, creditLimit - owedAmount)
```

## 4. Cancelación de transacciones

No se deben borrar físicamente los movimientos financieros.

La cancelación debe:

1. Comprobar que la transacción pertenece al usuario autenticado.
2. Revertir su efecto sobre el saldo sólo si tenía `status = completed`.
3. Cambiar su estado a `cancelled`.
4. Conservar la fila para historial y auditoría.

La lista principal puede ocultar movimientos cancelados por defecto, con un filtro
para consultarlos cuando sea necesario.

## 5. Transferencias entre cuentas

Las transferencias se implementan después de validar ingresos, gastos, edición y
cancelación.

Una transferencia crea dos filas en `transactions` dentro de una única transacción
SQL:

```text
Cuenta origen
  type: transfer
  transferDirection: out

Cuenta destino
  type: transfer
  transferDirection: in

Ambas filas
  transferGroupId: mismo UUID
```

No se contabilizan como ingreso ni gasto en reportes, presupuesto o flujo de caja.

Este flujo también resuelve pagos de tarjetas de crédito: el dinero se transfiere
desde una cuenta de débito/efectivo hacia la cuenta de crédito, en vez de registrarlo
como un ingreso ficticio.

## 6. Arquitectura propuesta

```text
src/features/transactions/
├── actions/
│   └── transaction-actions.ts
├── application/use-cases/
│   ├── create-transaction.ts
│   ├── update-transaction.ts
│   ├── cancel-transaction.ts
│   └── create-transfer.ts
├── domain/
│   ├── transaction-repository.ts
│   └── transaction-rules.ts
├── infrastructure/
│   └── drizzle-transaction-repository.ts
├── components/
│   ├── transaction-form.tsx
│   ├── transaction-list.tsx
│   ├── transaction-filters.tsx
│   └── transfer-form.tsx
└── schemas/
    ├── transaction.schema.ts
    └── transfer.schema.ts
```

## 7. Dashboard con datos reales

Una vez que el ledger permita crear, editar, cancelar y transferir sin desincronizar
saldos, se reemplazarán los mocks de `getDashboardData()` por una query layer real.

Las primeras queries deben ser:

```text
getFinancialOverview(userId, range)
getSpendingByCategory(userId, range)
getAccountsSummary(userId)
getRecentTransactions(userId, range)
```

Los cálculos deben excluir:

- transacciones `cancelled`;
- transferencias de ingresos y gastos;
- cuentas archivadas cuando corresponda.

## 8. Criterios de terminado

- Una categoría archivada no impide recrear una categoría activa homónima.
- Editar un movimiento ajusta correctamente el saldo de origen y destino.
- Cancelar un movimiento revierte una única vez su efecto.
- Una transferencia no altera totales de ingresos ni gastos.
- El dashboard obtiene saldos, movimientos y métricas reales del usuario.

## 9. Estado de implementación

Implementado:

- edición de ingresos y gastos con reversión y reaplicación atómica del saldo;
- cancelación lógica de movimientos, incluidas las dos partes de una transferencia;
- transferencias entre cuentas de la misma moneda mediante dos filas enlazadas;
- formularios React Hook Form con validación Zod;
- filtros para ingresos, gastos, transferencias y movimientos cancelados;
- queries reales para patrimonio, ingresos, gastos, flujo neto, categorías,
  historial estimado y movimientos recientes del dashboard;
- estados vacíos para módulos que todavía no tienen tablas, como presupuestos y
  metas.

La migración `drizzle/0003_round_sphinx.sql` contiene los índices parciales de
categorías. Debe ejecutarse con `pnpm db:migrate` en cada entorno donde todavía no
se haya aplicado.

### Alcance actual de transferencias

Las transferencias sólo permiten cuentas con la misma moneda. El soporte entre
monedas debe añadirse posteriormente junto con una tasa de cambio explícita y el
monto convertido, para evitar diferencias silenciosas en saldos y reportes.

### Validación técnica

- TypeScript: correcto.
- ESLint de los módulos de transacciones y dashboard: correcto.
- Build con Webpack: el código compila; el prerender global queda bloqueado por la
  página existente `/auth/forgot-password`, que necesita envolver el uso de
  `useSearchParams()` en un límite `Suspense`.
