# Plan del módulo de categorías

## Objetivo

Construir el módulo que permite a cada usuario organizar sus ingresos y gastos con
categorías propias. Las categorías son un prerrequisito para que las transacciones
produzcan reportes, presupuestos y filtros útiles.

La primera versión no debe intentar resolver jerarquías complejas, etiquetas ni
presupuestos. Debe entregar categorías confiables, aisladas por usuario y fáciles de
usar al crear un movimiento.

## Estado actual

La tabla `categories` y el bootstrap de categorías predeterminadas ya existen. El
formulario de transacciones las consulta y filtra por `income` o `expense`.

La siguiente fase convierte ese bootstrap en un módulo completo: listado, creación,
edición, archivado y selección consistente desde transacciones.

## Alcance de la primera versión

Cada categoría tendrá:

```text
Nombre
Tipo: ingreso | gasto
Color
Icono opcional
Orden de visualización
```

También se podrán:

- Crear categorías personales.
- Editar nombre, color, icono y orden.
- Archivar categorías que aún no se quieran mostrar.
- Restaurar categorías archivadas en una fase posterior si hace falta.
- Inicializar categorías predeterminadas de forma idempotente.

Las categorías predeterminadas deben distinguirse con `isSystem`. En la primera
versión se pueden editar visualmente, pero no eliminar físicamente.

## Reglas de negocio

- Una categoría pertenece a un solo usuario.
- El nombre es obligatorio, se recorta y tiene un límite razonable, por ejemplo 60
  caracteres.
- Un usuario no puede repetir el mismo nombre dentro del mismo tipo. `Comida` como
  gasto e ingreso podría permitirse, aunque normalmente no aporta valor.
- Una categoría sólo puede usarse en transacciones de su mismo tipo.
- Las categorías archivadas no aparecen al crear nuevas transacciones.
- Una categoría con movimientos históricos no se elimina físicamente: se archiva.
- `transfer` no debe ser una categoría seleccionable; las transferencias tienen su
  propio caso de uso y no cuentan como ingreso ni gasto.

La validación de forma vive en Zod. La pertenencia al usuario, la unicidad real y la
protección de categorías con historial se validan en el caso de uso y en PostgreSQL.

## Modelo de datos

La tabla actual ya contiene lo necesario para iniciar:

```text
categories
├── id
├── userId
├── parentId          # se mantiene, pero no se expone aún en UI
├── name
├── type
├── iconUrl
├── color
├── sortOrder
├── isSystem
├── deletedAt
├── createdAt
└── updatedAt
```

Antes de implementar el CRUD, conviene revisar o añadir estas restricciones de base
de datos:

```text
UNIQUE (user_id, type, name) WHERE deleted_at IS NULL
INDEX  (user_id, type, sort_order) WHERE deleted_at IS NULL
```

La primera evita duplicados aun si dos solicitudes llegan al mismo tiempo. El índice
acelera la lista que usará el formulario de movimientos.

## Arquitectura del feature

Seguir la misma separación aplicada a cuentas y transacciones:

```text
src/features/categories/
├── actions/
│   └── category-actions.ts
├── application/
│   └── use-cases/
│       ├── create-category.ts
│       ├── update-category.ts
│       ├── archive-category.ts
│       └── bootstrap-default-categories.ts
├── domain/
│   ├── category-repository.ts
│   └── category-rules.ts
├── infrastructure/
│   └── drizzle-category-repository.ts
├── components/
│   ├── categories-client.tsx
│   ├── category-form.tsx
│   └── category-list.tsx
├── queries/
│   └── get-categories.ts
├── schemas/
│   └── category.schema.ts
└── constants/
    └── default-categories.ts
```

### Responsabilidades

```text
CategoryForm
  → valida interacciones y muestra errores con React Hook Form + Zod

Server Action
  → obtiene sesión, valida entrada, llama el caso de uso y revalida rutas

Caso de uso
  → aplica reglas: propiedad, nombre duplicado, archivado y categorías de sistema

Repositorio Drizzle
  → ejecuta inserciones, updates, archivos y consultas de soporte

Query de lectura
  → devuelve el modelo que necesitan la página y TransactionForm
```

## Schema de formulario sugerido

```ts
export const categoryTypes = ["income", "expense"] as const;

export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string()
    .trim()
    .min(2, "Escribe un nombre de al menos 2 caracteres.")
    .max(60, "El nombre no puede superar 60 caracteres."),
  type: z.enum(categoryTypes),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Selecciona un color válido."),
  iconUrl: z.string().url().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
```

No incluir `userId`, `isSystem`, `deletedAt`, fechas ni `parentId` en el primer
formulario. Los primeros cuatro son valores de servidor; `parentId` pertenece a una
fase de subcategorías.

## Experiencia de usuario

La página `/categories` puede organizarse en dos grupos:

```text
Categorías de gasto
  Alimentación · Transporte · Vivienda · Salud · …

Categorías de ingreso
  Nómina · Freelance · Inversiones · …
```

Cada fila muestra color, icono, nombre y acciones de editar/archivar. Un único modal
sirve para crear y editar. El formulario debe usar el mismo patrón de `AccountForm`:
`defaultValues`, React Hook Form, `Controller` para selects, validación `onChange` y
una única fuente de verdad.

En `TransactionForm`, las categorías llegan desde la query de lectura y se filtran
por el tipo elegido. Al cambiar de gasto a ingreso, se debe limpiar `categoryId` sin
validarlo inmediatamente; el usuario elegirá una categoría compatible después.

## Orden de implementación

1. Extraer el bootstrap actual a `BootstrapDefaultCategoriesUseCase` y un repositorio
   de categorías.
2. Añadir la query `getCategories(userId)` para la futura página y reutilizarla en el
   formulario de transacciones.
3. Crear `category.schema.ts` y `create-category`.
4. Construir `/categories`, lista y modal de creación.
5. Añadir edición y archivado lógico.
6. Manejar errores de nombre duplicado con un mensaje de dominio entendible.
7. Añadir pruebas de casos de uso y del adaptador Drizzle.
8. Sustituir el bootstrap manual por una inicialización automática y segura, cuando
   la experiencia de producto esté definida.

## Fuera de alcance por ahora

- Subcategorías (`parentId`).
- Reordenamiento drag and drop.
- Iconos personalizados o subida de archivos.
- Borrado físico.
- Categorías para transferencias.
- Presupuestos por categoría.
- Etiquetas (`tags`), que son un concepto distinto y pertenecen a transacciones.

## Criterios de terminado

- Un usuario puede ver sus categorías de ingreso y gasto.
- Puede crear, editar y archivar únicamente sus propias categorías.
- Una categoría archivada no aparece en el formulario de nuevos movimientos.
- No se crean duplicados activos por usuario y tipo.
- El formulario de transacciones sólo permite categorías compatibles con su tipo.
- Los movimientos históricos siguen mostrando su categoría aunque ésta se archive.
