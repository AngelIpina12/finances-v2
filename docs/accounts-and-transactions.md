# Cuentas y siguiente incremento: categorías y transacciones

Este documento describe el módulo de cuentas ya implementado y define el siguiente
incremento funcional del producto: categorías y transacciones.

## 1. Módulo de cuentas

La ruta pública es `/accounts`, protegida por el layout privado. La información se
lee exclusivamente en servidor y las interacciones del usuario viven en componentes
cliente puntuales.

### Estructura

```text
app/(private)/
├── layout.tsx
└── accounts/page.tsx

src/features/accounts/
├── actions/financial-account-actions.ts
├── components/
│   ├── accounts-client.tsx
│   ├── accounts-form.tsx
│   └── accounts-plastic.tsx
├── constants/account.constants.ts
├── queries/get-financial-accounts.ts
├── schemas/financial-account.schema.ts
└── utils/
    ├── financial-account-draft.ts
    └── format-account-money.ts
```

### Qué está implementado

- Lectura de cuentas activas filtrada por `userId`.
- Estado vacío para usuarios nuevos.
- Filtros locales por tipo de cuenta y opción para ocultar saldos.
- Cards físicas con proporción bancaria, animaciones con Framer Motion y color
  personalizado.
- Formulario modal para crear y editar cuentas.
- Archivado lógico: una cuenta se marca con `deletedAt` e `isActive = false`; no se
  destruyen datos.
- Confirmación de archivado mediante `AlertDialog`.
- Validación en servidor con Zod y mutaciones mediante Server Actions.
- Revalidación de `/accounts` y `/dashboard` después de cada mutación.

### Seguridad y propiedad de datos

Las acciones nunca aceptan un `userId` del navegador. Obtienen la sesión mediante
`requireAuth()` y sólo actualizan filas cuyo `financial_accounts.user_id` coincide
con el usuario autenticado.

No se almacenan números completos de tarjeta, CVV o PIN. Para la representación
visual sólo se utiliza `lastFourDigits`.

### Tipos de cuenta

El formulario soporta los tipos del enum `account_type`. Las experiencias más
completas actualmente son:

- `cash`
- `debit`
- `credit`
- `wallet`

`investment`, `fixed_income` y `loan` existen en el modelo, pero necesitarán sus
propios detalles y cálculos en incrementos posteriores.

### Reglas para tarjetas de crédito

Las tarjetas de crédito no usan `openingBalance` como deuda. El formulario solicita:

- `creditLimit`
- `owedAmount` (deuda actual)
- `billingDate` (día de corte)
- `dueDate` (fecha límite de pago)

`availableCredit` no se confía desde el cliente. La Server Action lo calcula:

```ts
availableCredit = Math.max(0, creditLimit - owedAmount)
```

Zod impide guardar una deuda superior al límite de crédito.

### Saldo actual

Mientras no exista el módulo de transacciones, al crear o editar una cuenta no
crediticia se mantiene:

```text
currentBalance = openingBalance
```

Cuando se implemente el ledger de transacciones, `currentBalance` deberá actualizarse
dentro de la misma transacción SQL que crea, edita o elimina un movimiento completado.
No se deberá editar directamente desde el formulario de cuenta.

### Monedas

El resumen de cuentas no suma importes de distintas monedas como si todas fueran MXN.
Por ahora agrupa y muestra cada total por su propia moneda. La conversión a una moneda
preferida se añadirá cuando exista soporte de tipos de cambio.

## 2. Siguiente incremento: categorías y transacciones

El siguiente objetivo es que los saldos sean consecuencia de movimientos registrados,
no sólo valores capturados manualmente.

### Fase A: categorías iniciales

Crear categorías por defecto cuando un usuario empieza a usar la app. Pueden generarse
por una acción de bootstrap al entrar por primera vez al módulo de transacciones.

Categorías mínimas sugeridas:

```text
Ingresos: Nómina, Freelance, Inversiones, Otros ingresos
Gastos: Alimentos, Transporte, Vivienda, Salud, Entretenimiento,
        Suscripciones, Compras, Educación, Otros gastos
```

La tabla `categories` ya soporta tipo, color, icono, orden y jerarquía. La primera
versión puede usar sólo categorías de primer nivel.

### Fase B: transacciones de ingreso y gasto

Crear `/transactions` con:

- Tabla o lista de movimientos recientes.
- Filtros por período, cuenta, categoría y tipo.
- Modal para crear ingreso o gasto.
- Edición y archivado/eliminación controlados.
- Estados vacíos y skeletons.

El formulario inicial debe requerir:

```text
Tipo: ingreso | gasto
Cuenta
Categoría
Monto
Fecha
Comercio o descripción (opcional)
Notas (opcional)
```

### Regla crítica: actualización atómica de saldo

Crear un movimiento y actualizar la cuenta deben realizarse dentro de una única
transacción de PostgreSQL:

```text
BEGIN
  INSERT INTO transactions (...)
  UPDATE financial_accounts
    SET current_balance = current_balance +/- amount
COMMIT
```

Para un ingreso se suma el monto. Para un gasto se resta. Sólo los movimientos con
estado `completed` afectan el saldo actual.

Al editar o borrar una transacción, primero se revierte su efecto anterior y después
se aplica el nuevo efecto. Esto evita saldos desincronizados.

### Fase C: transferencias

Las transferencias se implementan después de validar ingresos y gastos. Una
transferencia crea dos filas `transactions` con el mismo `transferGroupId`:

```text
Cuenta origen      type: transfer, transferDirection: out
Cuenta destino     type: transfer, transferDirection: in
```

Ambas filas se crean dentro de la misma transacción SQL. No se contabilizan como
ingreso ni gasto en el dashboard.

### Arquitectura propuesta

```text
src/features/transactions/
├── actions/
│   └── transaction-actions.ts
├── components/
│   ├── transactions-client.tsx
│   ├── transaction-form.tsx
│   ├── transaction-list.tsx
│   └── transaction-filters.tsx
├── queries/
│   └── get-transactions.ts
├── schemas/
│   └── transaction.schema.ts
└── utils/
    └── balance-ledger.ts
```

La página y las queries serán Server Components. El formulario, filtros y menús de
acciones serán Client Components. Las mutaciones usarán Server Actions.

### Orden de implementación

1. Query y acción de bootstrap para categorías predeterminadas.
2. Formulario de ingreso y gasto con Zod.
3. Server Action atómica para crear el movimiento y actualizar el saldo.
4. Lista de transacciones y filtros básicos.
5. Edición/reversión de movimientos.
6. Transferencias.
7. Sustituir los datos mock del dashboard por queries reales.

## 3. Criterios de terminado del siguiente incremento

- Un usuario puede crear una cuenta y registrar un ingreso o gasto.
- El movimiento se ve en la lista de transacciones.
- El saldo de la cuenta se actualiza correctamente.
- Un gasto no puede registrarse en una cuenta de otro usuario.
- El dashboard puede obtener los movimientos y saldos reales del usuario.
