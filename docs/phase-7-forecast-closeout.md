# Cierre de la fase 7: previsión

## Resultado

La fase permite proyectar liquidez futura sin crear transacciones ni modificar saldos
reales. El cálculo considera cuentas líquidas, movimientos programados, recurrencias,
cuotas financiadas y pagos de tarjetas según su corte y plazo en días naturales.

La interfaz permite seleccionar un rango de hasta 180 días, filtrar por moneda y
cuenta, y agrupar por día, semana o mes. Todas las cifras consolidadas permanecen
separadas por moneda.

## Reglas cubiertas automáticamente

- compras antes, durante y después del corte;
- cortes en meses cortos y febrero bisiesto;
- vencimientos que cruzan de año;
- fechas cercanas a medianoche en la zona de la aplicación;
- estrategias de saldo total, mínimo, monto fijo y manual;
- estados vencidos;
- monto fijo limitado al compromiso calculado;
- deduplicación de cuotas MSI incluidas en el estado informado;
- varias tarjetas pagadas desde una misma cuenta líquida;
- ingresos, gastos directos, pagos de tarjeta y cuotas separados;
- rango con inicio inclusivo y fin exclusivo;
- separación estricta entre monedas;
- primer momento con liquidez negativa;
- aislamiento por usuario;
- exclusión de cuentas archivadas y ocurrencias completadas o canceladas;
- recurrencias materializadas sin duplicación.

## Escenario de aceptación cubierto

Existe una prueba de dominio que combina:

- saldo líquido inicial;
- nómina e ingreso mensual;
- recibo programado;
- mandado y suscripción en tarjetas distintas;
- cuota MSI;
- dos tarjetas pagadas desde la misma cuenta.

La prueba verifica tanto el saldo líquido final como la deuda final de cada tarjeta y
el desglose de ingresos, gastos directos, pagos de tarjetas y financiamientos.

## Comandos de verificación

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm test:integration
pnpm exec next build --webpack
```

El build con `--webpack` se usa como comprobación alternativa cuando Turbopack no
puede abrir su proceso interno dentro del entorno aislado.

## Pendiente operativo antes de producción

El `BETTER_AUTH_SECRET` local actual tiene 18 caracteres. Better Auth recomienda al
menos 32 caracteres aleatorios. No se reemplazó automáticamente porque hacerlo
invalidaría las sesiones existentes y el valor definitivo debe almacenarse como
secreto del entorno de despliegue.

Una forma de generar el valor es:

```bash
openssl rand -base64 32
```

Después debe actualizarse `BETTER_AUTH_SECRET` en desarrollo y en el proveedor de
producción, reiniciar la aplicación y volver a iniciar sesión.

## Fuera de esta fase

- conversión automática de monedas;
- sincronización bancaria;
- intereses reales de tarjeta;
- ejecución automática de pagos;
- estimaciones probabilísticas;
- reportes e insights históricos.

Los reportes históricos constituyen la siguiente fase funcional y deben consumir las
transacciones reales, no las proyecciones de esta pantalla.
