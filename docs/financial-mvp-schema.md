# Esquema financiero MVP

Este proyecto conserva las tablas de Better Auth (`users`, `sessions`, `accounts` y
`verifications`) tal como están. La tabla `accounts` de Better Auth **no** representa
cuentas bancarias: las cuentas financieras viven en `financial_accounts`.

## Alcance de esta migración

La primera migración financiera contiene sólo las tablas necesarias para convertir el
dashboard de datos de demostración a datos reales:

- `financial_accounts`
- `categories`
- `transactions`

No agrega preferencias de usuario, presupuestos, metas, recurrencias ni tablas de
inversiones. Esas entidades se crearán en migraciones independientes cuando sus flujos
de producto existan.

## Decisiones de modelo

- `users.id` es `text`, porque Better Auth es la fuente de identidad. Todas las FK
  financieras hacia un usuario usan el mismo tipo.
- Los importes usan `numeric(15,2)`; nunca `float` para dinero.
- Una transferencia se registra como dos transacciones con el mismo `transfer_group_id`:
  una salida (`transfer_direction = out`) y una entrada (`transfer_direction = in`). Esto
  permite conservar el historial por cuenta y actualizar ambos saldos correctamente.
- `current_balance` se guarda para lecturas rápidas, pero debe actualizarse dentro de la
  misma transacción SQL que inserta, modifica o elimina una transacción completada.
- Sólo se guarda `last_four_digits`; no se almacenan PAN, CVV, PIN ni información de
  banda magnética.

## Generar y aplicar la migración

1. Confirma que `DATABASE_URL` apunta a tu base de datos de desarrollo.
2. Genera los archivos SQL:

   ```bash
   pnpm db:generate
   ```

3. Revisa el SQL generado en `drizzle/`.
4. Aplica la migración únicamente a desarrollo:

   ```bash
   pnpm db:migrate
   ```

## Siguiente incremento

Crear el CRUD de `financial_accounts` con Server Actions y Zod. Después, crear
categorías iniciales por usuario y el formulario de transacciones. Sólo entonces se
reemplaza `getDashboardData()` por queries reales de Drizzle.
