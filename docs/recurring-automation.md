# Automatización de recurrencias

El endpoint interno `GET` o `POST /api/internal/recurring/generate` mantiene una
ventana de 60 días de ocurrencias para todas las reglas activas.

No completa movimientos ni modifica saldos. Sólo crea ocurrencias futuras; éstas
siguen requiriendo que el usuario las complete desde la aplicación.

## Seguridad

Define un secreto largo únicamente en el entorno del servidor:

```bash
CRON_SECRET="reemplaza-esto-por-un-secreto-aleatorio"
```

Puedes generar uno localmente con:

```bash
openssl rand -base64 32
```

El scheduler debe enviar exactamente este encabezado:

```text
Authorization: Bearer <CRON_SECRET>
```

Una llamada sin secreto, con secreto vacío o incorrecto responde `401`.

## Ejecución manual

Con el servidor local activo:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/internal/recurring/generate
```

La respuesta incluye un identificador de ejecución, las reglas procesadas, las
ocurrencias nuevas, la fecha usada por el generador y la duración:

```json
{
  "ok": true,
  "executionId": "7e969ec8-ec9c-43bf-b08f-1d221f67cbb4",
  "processedRules": 4,
  "generatedOccurrences": 12,
  "generatedAt": "2026-09-03T14:00:00.000Z",
  "durationMs": 38
}
```

Si ya existe una ocurrencia para la misma regla y secuencia, no se duplica. Todas
las respuestas incluyen `Cache-Control: no-store`.

## Scheduler

Configura el proveedor donde despliegues la aplicación para invocar esa ruta una
vez al día. El horario exacto no cambia las fechas financieras: el cálculo usa la
fecha programada y la zona `America/Mexico_City`, no la hora del job.

El endpoint es seguro para reintentos y ejecuciones concurrentes porque el
generador usa una transacción SQL, bloquea las reglas activas y conserva el índice
único `(recurring_rule_id, sequence)`.

Antes de activar el cron en producción, agrega `CRON_SECRET` también a las
variables de entorno del proveedor de despliegue.

## Observabilidad

Cada intento genera un `executionId`. Una ejecución correcta registra el número de
reglas procesadas, ocurrencias creadas y duración. Un error registra su nombre y
mensaje en el servidor, pero la respuesta HTTP no expone esos detalles internos.

El secreto recibido nunca se escribe en los logs. Las solicitudes rechazadas se
registran solamente con su identificador de ejecución.

## Pruebas automatizadas

Ejecuta la suite completa con:

```bash
pnpm test
```

La cobertura crítica comprueba:

- frecuencias semanal, cada 14 días, mensual, semimensual, anual y custom;
- días 29, 30 y 31, meses cortos y años bisiestos;
- conservación del día ancla después de febrero;
- meses con cuatro y cinco pagos y distribución exacta de centavos;
- monto especial en una quinta fecha semanal;
- excepciones aisladas y calendarios personalizados;
- fecha de terminación inclusiva;
- reintentos y ejecuciones concurrentes sin duplicados;
- doble confirmación sin duplicar transacciones ni afectar dos veces el saldo;
- autorización, respuestas y manejo seguro de errores del endpoint.

## Lista de cierre en el proveedor

La implementación queda lista para cualquier scheduler HTTP. La fase se considera
operativa en un ambiente cuando se completa esta lista:

1. desplegar la aplicación y ejecutar las migraciones pendientes;
2. definir un `CRON_SECRET` aleatorio de al menos 32 bytes;
3. programar una llamada diaria autenticada al endpoint;
4. verificar una respuesta `200` y conservar su `executionId` en los logs;
5. repetir inmediatamente la llamada y comprobar que informa cero ocurrencias
   cuando la ventana ya está completa;
6. configurar una alerta para respuestas distintas de `2xx`;
7. confirmar al día siguiente que el scheduler volvió a ejecutarse.

La configuración concreta del job se agrega cuando se elija el proveedor de
despliegue; el repositorio no asume Vercel, Railway, Render u otro servicio.
