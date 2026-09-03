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

La respuesta incluye las reglas procesadas y las ocurrencias nuevas. Si ya existe
una ocurrencia para la misma regla y secuencia, no se duplica.

## Scheduler

Configura el proveedor donde despliegues la aplicación para invocar esa ruta una
vez al día. El horario exacto no cambia las fechas financieras: el cálculo usa la
fecha programada y la zona `America/Mexico_City`, no la hora del job.

El endpoint es seguro para reintentos y ejecuciones concurrentes porque el
generador usa una transacción SQL, bloquea las reglas activas y conserva el índice
único `(recurring_rule_id, sequence)`.

Antes de activar el cron en producción, agrega `CRON_SECRET` también a las
variables de entorno del proveedor de despliegue.
