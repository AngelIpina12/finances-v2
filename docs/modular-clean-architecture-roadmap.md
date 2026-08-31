# Plan de arquitectura modular para cuentas y transferencias

## Decisión

El proyecto debe evolucionar como un **monolito modular**, organizado por feature,
con límites de Clean/Hexagonal Architecture en las operaciones financieras. No se
recomienda crear repositorios, interfaces y casos de uso para cada CRUD simple desde
el inicio.

La regla es: cuando una operación altera dinero, saldos, más de una tabla o necesita
ser atómica, debe pasar por un caso de uso. Las Server Actions y Drizzle quedan como
adaptadores de entrada y persistencia, respectivamente.

```text
Componente cliente
  → Server Action (auth, parseo, respuesta, revalidación)
    → Caso de uso (reglas de negocio)
      → Puerto de repositorio / unidad de trabajo
        → Adaptador Drizzle + PostgreSQL
```

Las queries para alimentar pantallas pueden seguir siendo directas con Drizzle. Esto
separa lecturas de escrituras sin introducir CQRS completo.

## Base compartida

Crear sólo estas piezas transversales antes de migrar el primer módulo:

```text
src/shared/
├── domain/
│   ├── money.ts              # importe, moneda, redondeo y conversiones seguras
│   ├── result.ts             # Result/errores de aplicación si se necesita
│   └── ids.ts                # tipos de ids, opcional
└── infrastructure/
    └── database/
        └── drizzle.ts        # adaptador o helper para transacciones SQL
```

No usar `number` de JavaScript como representación persistida de dinero. PostgreSQL
ya usa `numeric`; el adaptador debe decidir una representación consistente en la
aplicación y redondear explícitamente.

## 1. Reestructurar `accounts`

El módulo actual ya tiene una buena división por feature: `components`, `actions`,
`queries`, `schemas` y `utils`. La migración debe preservar las rutas públicas y la
UI; el cambio es mover las reglas y Drizzle fuera de las acciones.

### Estructura objetivo

```text
src/features/accounts/
├── presentation/
│   ├── actions/
│   │   └── financial-account-actions.ts
│   └── components/
│       ├── accounts-client.tsx
│       ├── accounts-form.tsx
│       └── accounts-plastic.tsx
├── application/
│   └── use-cases/
│       ├── create-account.ts
│       ├── update-account.ts
│       └── archive-account.ts
├── domain/
│   ├── account.ts
│   ├── account-rules.ts
│   └── account-repository.ts
├── infrastructure/
│   └── drizzle-account-repository.ts
├── queries/
│   └── get-financial-accounts.ts
├── schemas/
│   └── financial-account.schema.ts
└── utils/
    ├── financial-account-draft.ts
    └── format-account-money.ts
```

`presentation/` puede introducirse gradualmente; no es necesario mover archivos en
el primer PR si el cambio de importaciones distrae del objetivo. Lo importante es que
`financial-account-actions.ts` deje de importar `db`, tablas de Drizzle y reglas de
cálculo.

### Responsabilidades

- **Formulario:** React Hook Form, Zod para experiencia de usuario y vista previa.
- **Server Action:** obtiene sesión, hace `safeParse`, llama el caso de uso,
  transforma el resultado a mensaje y ejecuta `revalidatePath`.
- **Caso de uso:** decide si crear/editar, aplica reglas de cuenta de crédito y
  construye el estado persistible.
- **Repositorio Drizzle:** busca, inserta, actualiza y archiva, siempre limitado por
  `userId`.
- **Query:** devuelve el modelo de lectura para `/accounts`; no necesita pasar por
  el repositorio de escritura.

### Primeras interfaces

```ts
export interface AccountRepository {
  create(input: CreateAccountRecord): Promise<void>;
  update(userId: string, accountId: string, input: UpdateAccountRecord): Promise<boolean>;
  archive(userId: string, accountId: string): Promise<boolean>;
}
```

No permitir que `currentBalance` se edite desde `update-account` cuando ya existan
movimientos. El saldo será responsabilidad del ledger de transacciones.

### Orden de migración

1. Extraer `create-account` y cubrirlo con pruebas unitarias.
2. Extraer `update-account` y `archive-account`.
3. Implementar `DrizzleAccountRepository` reutilizando las consultas actuales.
4. Reducir las Server Actions a adaptadores.
5. Mantener las queries de lectura como están.

## 2. Implementar transferencias como un caso de uso independiente

Las transferencias no son un tipo especial de formulario de ingreso/gasto. Son una
operación entre dos cuentas y deben crear dos movimientos inseparables. El esquema
actual ya tiene `transferGroupId` y `transferDirection`, por lo que soporta este
modelo sin una nueva tabla.

### Estructura objetivo

```text
src/features/transactions/
├── presentation/
│   ├── actions/
│   │   └── transaction-actions.ts
│   └── components/
│       ├── transaction-form.tsx
│       ├── transfer-form.tsx
│       ├── transactions-client.tsx
│       └── transactions-list.tsx
├── application/
│   └── use-cases/
│       ├── create-transaction.ts
│       ├── create-transfer.ts
│       ├── reverse-transaction.ts
│       └── update-transaction.ts
├── domain/
│   ├── transaction.ts
│   ├── transfer.ts
│   ├── balance-ledger.ts
│   └── transaction-repository.ts
├── infrastructure/
│   └── drizzle-transaction-repository.ts
├── queries/
│   └── get-transaction-data.ts
└── schemas/
    ├── transaction.schema.ts
    └── transfer.schema.ts
```

### Contrato funcional de `create-transfer`

Entrada mínima:

```ts
{
  sourceAccountId: string;
  destinationAccountId: string;
  amount: Money;
  date: Date;
  notes?: string;
}
```

El caso de uso debe rechazar:

- Cuentas iguales.
- Cuentas inexistentes, archivadas o de otro usuario.
- Monedas distintas hasta implementar tipo de cambio explícito.
- Importes no positivos.

Dentro de **una única transacción SQL** debe:

1. Leer y bloquear/validar ambas cuentas del usuario.
2. Crear un `transferGroupId`.
3. Insertar la salida: `type: "transfer"`, `transferDirection: "out"`.
4. Insertar la entrada: `type: "transfer"`, `transferDirection: "in"`.
5. Aplicar ambos cambios de saldo según el tipo de cuenta.
6. Actualizar crédito disponible si una cuenta afectada es de crédito.

Una transferencia no debe requerir categoría y no debe contarse como ingreso o gasto
en reportes. Editar o borrar una transferencia debe operar sobre las dos filas del
grupo, nunca sobre una sola.

## 3. Qué hacer después: categorías antes que transferencias

Sí: el siguiente módulo recomendable son **categorías**, pero como un incremento
pequeño que habilita transacciones de ingreso y gasto. El orden propuesto es:

1. **Extraer el caso de uso actual `createTransaction`.** Ya modifica movimientos y
   saldos dentro de una transacción SQL; es el primer candidato para la separación.
2. **Categorías.** Bootstrap idempotente, listado y CRUD básico por usuario. Mantener
   inicialmente sólo categorías de primer nivel; posponer jerarquías.
3. **Transacciones de ingreso/gasto.** Completar edición y reversión atómica, además
   de filtros por fecha, cuenta y categoría.
4. **Transferencias.** Construir `create-transfer` sobre el repositorio y ledger ya
   probados; no duplicar la lógica de saldos en el formulario.
5. **Dashboard real.** Sustituir datos demo por read models de cuentas, transacciones
   y categorías.
6. **Recurrentes y notificaciones.** Añadir un adaptador de cron/job y ocurrencias
   idempotentes antes de automatizar transacciones.
7. **Presupuestos.** Requieren transacciones, categorías y periodos fiables.
8. **Inversiones, renta fija, préstamos y tipo de cambio.** Son subdominios propios;
   añadirlos uno por uno, con casos de uso y pruebas de cálculo.

Las categorías deben venir antes de transferencias sólo porque desbloquean el flujo
central ingreso/gasto. No deben usarse para clasificar transferencias.

## Criterios para avanzar de fase

Antes de implementar transferencias:

- `createTransaction` y la actualización de saldo tienen pruebas de caso de uso.
- Las mutaciones verifican `userId` en el servidor.
- Editar/eliminar un movimiento revierte correctamente su saldo anterior.
- Las categorías de otro usuario nunca pueden asignarse a una transacción.
- Los importes se manejan con precisión decimal consistente.

Antes de implementar recurrencias:

- Las transferencias se crean, revierten y listan por grupo de forma atómica.
- Existe una estrategia de idempotencia para no generar dos veces la misma
  ocurrencia programada.

## Qué no hacer todavía

- No migrar todo el proyecto a carpetas `domain` y `infrastructure` de una vez.
- No crear un repositorio genérico reutilizable para todas las tablas.
- No hacer microservicios ni Event Sourcing.
- No permitir que componentes cliente calculen o persistan saldos.

La meta es aislar primero el código que puede causar inconsistencias financieras y
mantener el resto simple, legible y cercano a Next.js.
