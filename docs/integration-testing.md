# Pruebas de integración

Las pruebas unitarias se ejecutan con `pnpm test`. Las de integración usan una base
PostgreSQL exclusiva y nunca pueden apuntar a la base de desarrollo.

## Configuración

1. Crea una base vacía, por ejemplo `finances_v2_test`.
2. Copia `.env.test.template` como `.env.test`.
3. Define `DATABASE_URL_TEST` con la URL de esa base.

El runner rechaza la ejecución si `DATABASE_URL_TEST` coincide con `DATABASE_URL`.

## Ejecución

```bash
pnpm test:integration
```

El comando aplica las migraciones a la base de pruebas y ejecuta sólo archivos
`*.integration.test.ts`. Cada prueba debe limpiar los datos que crea, preferentemente
usando un usuario aleatorio y borrándolo al finalizar.
