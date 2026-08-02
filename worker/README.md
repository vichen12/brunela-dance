# Worker de muxeo multi-idioma

## Qué hace

Brunela sube una clase y, opcionalmente, un mp3 por idioma (EN / FR / IT). El
video va directo a Bunny y los mp3 directo a Supabase Storage. Este worker es
quien los une.

Bunny Stream **no tiene API para agregar pistas de audio a un video existente**
(verificado: los endpoints devuelven 404). Pero **sí conserva las pistas que ya
vienen dentro del archivo subido** y las expone como idiomas seleccionables en
el HLS. Entonces el worker:

1. Toma un job pendiente de `video_mux_jobs`.
2. Baja de Bunny el archivo **original** (no una versión recomprimida).
3. Baja los mp3 de Supabase Storage.
4. Los une con `ffmpeg -c:v copy` — **el video no se re-encodea**, solo cambia
   de contenedor. Es rápido y sin pérdida de calidad.
5. Sube el resultado a Bunny como un video **nuevo**.
6. Espera el encode y **verifica que el playlist tenga todos los idiomas
   pedidos**.
7. Recién ahí apunta la clase al video nuevo, borra el viejo y borra los mp3.

**El paso 6 no es opcional.** En las pruebas, Bunny perdió una pista de audio en
1 de 7 encodes, sin ningún patrón reproducible. Si no se verifica, una clase
puede quedar publicada con un idioma menos y nadie se entera hasta que una
alumna se queja. Si falta algún idioma, el job **no hace el swap**: reintenta, y
después de 3 intentos queda en `failed` con el detalle de qué faltó.

Mientras todo esto pasa, **la clase sigue viéndose normal en español**. El video
viejo se sirve hasta que el nuevo está verificado.

## Requisitos

- **Node.js 20 o superior** (usa `fetch` nativo)
- **ffmpeg** en el PATH
- Sin dependencias de npm. No hay `npm install` que correr.

El worker solo hace conexiones **salientes**: consulta Supabase, baja de Bunny,
sube a Bunny. No expone ningún puerto, no necesita dominio ni certificado.

## Variables de entorno

| Variable | Obligatoria | Qué es |
|---|---|---|
| `SUPABASE_URL` | sí | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | Clave de servicio (salta RLS) |
| `BUNNY_STREAM_API_KEY` | sí | API key de la video library |
| `BUNNY_STREAM_LIBRARY_ID` | sí | Id numérico de la library |
| `BUNNY_STREAM_CDN_HOSTNAME` | sí | Ej. `vz-xxxx.b-cdn.net`, sin `https://` |
| `BUNNY_STREAM_TOKEN_AUTH_KEY` | sí | Clave de firma de URLs |
| `POLL_INTERVAL_SECONDS` | no | Cada cuánto busca trabajo. Default `30` |
| `AUDIO_BITRATE_KBPS` | no | Default `96`. Debe coincidir con `src/lib/audio/config.ts` |
| `MAX_ATTEMPTS` | no | Reintentos antes de `failed`. Default `3` |
| `ENCODE_TIMEOUT_MINUTES` | no | Espera máxima del encode. Default `180` |
| `WORK_DIR` | no | Carpeta temporal. Default la del sistema |

Son las **mismas** que ya están en `.env.local` del proyecto, salvo que ahí la
URL se llama `NEXT_PUBLIC_SUPABASE_URL` (el worker acepta las dos).

## Correrlo localmente

Desde la raíz del proyecto:

```bash
# Un solo ciclo: toma un job, lo procesa y termina. Ideal para probar.
node --env-file=.env.local worker/index.mjs --once

# Continuo: se queda esperando trabajo.
node --env-file=.env.local worker/index.mjs
```

Si ffmpeg no está instalado, falla al arrancar con un mensaje claro en vez de
morir en el primer job.

## Encenderlo en Railway

Unos 10 minutos. El worker no necesita estar prendido para que el sistema
funcione: los jobs se acumulan en `pending` y se procesan cuando arranca.

1. **railway.app** → *New Project* → *Deploy from GitHub repo* → elegí este repo.
2. Railway va a detectar Next.js. Como esto es un servicio aparte, entrá a
   *Settings* del servicio y poné:
   - **Start Command**: `node worker/index.mjs`
   - **Build Command**: dejalo vacío (no hay nada que compilar).
3. **ffmpeg**: Railway usa Nixpacks. Agregá en la raíz del repo un archivo
   `nixpacks.toml` con:
   ```toml
   [phases.setup]
   nixPkgs = ["nodejs_20", "ffmpeg"]
   ```
   Sin esto, el worker arranca y sale con "ffmpeg no está instalado".
4. *Variables* → cargá las 6 obligatorias de la tabla de arriba.
5. *Deploy*. En los logs tiene que aparecer:
   ```
   worker de muxeo iniciado (poll cada 30s, 96 kbps, 3 intentos)
   ```

**Recursos**: alcanza el plan más chico. El worker no re-encodea video, así que
casi no usa CPU; lo que necesita es disco temporal (aproximadamente 3× el peso
del video más grande) y ancho de banda.

**Costo estimado**: ~5 USD/mes más uso. Se puede apagar cuando no se use.

### Para apagarlo

*Settings* → *Remove service*, o pausar el proyecto. Los jobs que queden sin
procesar esperan en `pending` sin romper nada.

## Cómo saber qué está pasando

En el panel, `/admin/videos` muestra el estado de cada clase. Desde SQL:

```sql
select id, video_id, status, attempts, last_error, created_at
from video_mux_jobs
order by created_at desc
limit 20;
```

| Estado | Significa |
|---|---|
| `pending` | En cola. Si lleva mucho tiempo así, **el worker no está corriendo** |
| `processing` | Un worker lo tomó ahora mismo |
| `done` | Listo, la clase ya sirve todos los idiomas |
| `failed` | Agotó los reintentos. El motivo está en `last_error` |

Para reintentar un job fallido, alcanza con volverlo a poner en cola:

```sql
update video_mux_jobs
set status = 'pending', attempts = 0, last_error = null
where id = '<id-del-job>';
```

## Si algo sale mal

| Síntoma | Causa probable |
|---|---|
| `ffmpeg no esta instalado o no esta en el PATH` | Falta el `nixpacks.toml` del paso 3 |
| `Supabase 401: Invalid API key` | `SUPABASE_SERVICE_ROLE_KEY` mal copiada. Si es un JWT tiene que tener **dos puntos** separando tres partes |
| `Descarga fallida (403)` | `BUNNY_STREAM_TOKEN_AUTH_KEY` incorrecta, o *Block direct URL file access* activado en la library |
| `El encode quedo sin los idiomas [...]` | Es la verificación haciendo su trabajo. Reintenta solo |
| Jobs eternamente en `pending` | El worker no está corriendo |
