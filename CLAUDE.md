# CLAUDE.md

---

# ESTADO ACTUAL — 2026-08-01

**Leer esto primero.** Es lo que hace falta para retomar sin contexto previo.

## Infraestructura

| Pieza | Dónde | Detalle |
|---|---|---|
| **Supabase** | `eu-central-1` (Fráncfort) | ref `howtuhfdxgyluskrlkze`, en la organización de Brunela |
| **Vercel** | `fra1` (Fráncfort) | proyecto `brunela-dance` (`prj_MpWybl3x3mSHcg4a9rnxzdtgKfu5`) |
| **Bunny Stream** | CDN global | no afectado por la región |
| Supabase **viejo** | `us-west-2` (Oregón) | 🔴 sigue vivo, **pausar después de 2 semanas** (ver pendientes) |

La base se migró de Oregón a Fráncfort el 2026-08-01. El motivo fue **residencia
de datos** (alumnas en la UE), no velocidad. Todo el plan, las trampas y las
verificaciones están en `SETUP.md` § 4.

**Regla que no se puede romper:** `vercel.json` (región de las funciones) y la
región de Supabase se cambian **en el mismo deploy**. Separarlas deja las
funciones a un océano de la base: ~160 ms por consulta, peor que no migrar.

Verificar en qué región corre de verdad — no confiar en el panel:

```bash
curl -sI https://brunela-dance.vercel.app/sign-in | grep -i x-vercel-id
# gru1::fra1::xxxxx
#       ^^^^ region donde CORRIO la funcion (el primero es solo el borde de entrada)
```

## 🔴 Qué está desplegado y qué no

**Producción corre `7e66a35`**, que es el código de **mayo** más un hotfix de
seguridad. **El rediseño NO está desplegado.**

| Rama | Contenido | Estado |
|---|---|---|
| `main` | código de mayo + hotfix + las 18 migraciones + `fra1` | **en producción** |
| `feat/rediseno-completo` | 3 meses de trabajo: rediseño de las 7 pantallas, reproductor Bunny, worker de mux, checkout y portal de Stripe, mejoras de rendimiento | **sin desplegar**, build verificado desde git |

Para desplegar el rediseño: mergear esa rama a `main`. Conviene hacerlo primero
como **preview** (push de la rama) y probarlo antes de mergear — son 55 archivos
y 5.744 líneas.

## Base de datos

- **18 migraciones**, todas aplicadas. ⚠️ **El orden NO es alfabético** — está en
  `SETUP.md` § 1.1. Las trampas: `phase_b1` va DESPUÉS de `phase_b`, `phase_b0`
  va sola, y las 17 y 18 van al final.
- **20 tablas**, 43 policies en `public` + 1 en `storage`, RLS activa en todas.
- **Permisos acotados** (migraciones 17 y 18): `anon` sin ningún privilegio de
  tabla, `authenticated` sin `DELETE` en ninguna y sólo-lectura en 14 de 20.
  Si aparece un `42501 permission denied`, es esto: se otorga la operación
  puntual sobre esa tabla, no se vuelve al grant global.
- **Contenido: vacío.** 0 videos, 0 categorías, 0 programas, 0 sesiones. La data
  demo del proyecto viejo no se migró a propósito. Para poblar y evaluar diseño:
  `scripts/seed-demo.sql` (idempotente, todo con prefijo `demo-`).

### Cuentas

| Correo | admin | dueña | tier |
|---|---|---|---|
| `brunela.dance@gmail.com` | sí | **sí** | principal |
| `vichendallape@gmail.com` | sí | no | principal |
| `dallapevichen12@gmail.com` | sí | no | principal |
| `dallapevincenzo@gmail.com` | **no** | no | none |

Las tres primeras se importaron del proyecto viejo con sus UUID originales. La
cuarta se creó sola al entrar con Google durante las pruebas — **decidir si se
le da admin o se borra**.

**Quién es la dueña del estudio se DECLARA**, no se deduce: columna
`profiles.is_studio_owner`, con índice único parcial y check constraint. Antes
salía de `created_at`, y eso se sostenía falsificándole la fecha a una cuenta
demo. `get_studio_admin()` prefiere la dueña declarada y sólo cae a "la admin más
antigua" si no hay ninguna.

## Trampas que ya costaron caro

Cinco cosas que fallan **en silencio**. Ninguna da error.

1. **`protect_profile_admin_fields()` está definida TRES veces** en las
   migraciones (phase_a, phase_b, y la 16). La buena es la que lleva
   `auth.uid() is not null and ...`. Sin esa guarda, el trigger revierte las
   escrituras de `service_role` — y eso rompe el webhook de Stripe: entra un
   pago, se escribe la suscripción, el trigger revierte el tier, y la alumna
   paga sin recibir acceso.
2. **`auth.identities` hay que copiarla** en cualquier migración de proyecto. Sin
   ella el login con Google crea un usuario NUEVO con otro UUID y deja el perfil
   de admin huérfano. El login "funciona".
3. **Columnas generadas en `auth`** (`users.confirmed_at`, `identities.email`):
   un `insert ... select *` falla. Hay que excluirlas de la lista de columnas,
   no del JSON.
4. **Una server action es un endpoint POST público.** Renderizar el formulario
   bajo `{isAdmin && ...}` no protege nada. Toda action que use
   `createSupabaseAdminClient()` (que saltea RLS) **tiene que llamar
   `requireAdmin()`**. Ya pasó: 4 actions permitían borrar el catálogo a
   cualquiera.
5. **Reglas de negocio que viven sólo en el panel se pierden al reconstruir.**
   Pasó con el período de gracia de `past_due` y con la dueña del estudio. Si una
   regla no está en una migración, no existe.
6. **Un componente no puede cruzar de servidor a cliente como prop.** Un ícono de
   lucide es una función, y React serializa las props para mandarlas por la red.
   Poner `{ Icon: Play }` en un array de un server component y pasárselo a uno de
   cliente tira `Functions cannot be passed directly to Client Components` **en
   tiempo de ejecución**. `tsc` pasa y `next build` pasa: `/admin` compiló
   perfecto y reventó en producción con un 500.
   Por la frontera va una **cadena**, y el mapa de íconos vive del lado del
   cliente (`components/admin-overview-client.tsx`). Renderizar el ícono dentro
   del mismo server component sí es válido — lo que no se puede es pasarlo.

## Decisiones conscientes (no son descuidos)

### Blanco sobre `--pink` da 3.78:1 y no cumple AA — se deja igual

**Decidido el 2026-08-02, con el número sobre la mesa.**

`--pink` `#E64F55` como fondo de botón con texto blanco da **3.78:1**. AA pide
**4.5:1** para texto normal. No cumple, y **el CTA del sidebar tampoco califica
como "texto grande"**: WCAG define texto grande como 18pt (24px) o **14pt en
negrita**, y 14pt son ≈**18.66px**, no 14px. La unidad es puntos. Un label de
14px peso 700 necesita 4.5:1 igual.

Afecta a unos **20 lugares** con fondo coral y texto encima.

**Se deja por identidad de marca**: `#E64F55` es el color de la landing, y el
sistema se unificó *hacia* la landing. Cambiarlo desalinearía las dos mitades
del producto, que era justamente el problema que la unificación vino a resolver.

**Si algún día hace falta accesibilidad estricta**, el reemplazo es
`--pink-mid` `#D93438`: da **4.83:1** y a simple vista es casi el mismo coral.

**La excepción que ya está aplicada:** la burbuja de los mensajes propios en el
chat usa `--pink-mid`, no `--pink`. Ahí el texto es de **lectura sostenida**
(13.5px, peso normal, párrafos enteros), no una etiqueta que se mira de reojo, y
es donde el contraste realmente importa.

> Regla practica que salió de esto: `--pink` para superficie glanceable,
> `--pink-mid` cuando encima va texto que alguien va a **leer**.

### 🔴 "Confirm email" está APAGADO a propósito — hay que volver a encenderlo

**Decidido el 2026-08-02.** El registro necesitaba un recorrido continuo
(landing → registro → onboarding → checkout) y la confirmación por correo lo
parte en dos con un salto por la bandeja de entrada.

Pero el motivo real de apagarlo fue otro: **el SMTP de prueba de Supabase no
sirve para producción** (2-4 correos por hora) y todavía no hay dominio propio.

**Se enciende de nuevo cuando estén el dominio y el SMTP.** Y hace falta igual
para los avisos de clase nueva que pidió Brunela, así que no es opcional.

Mientras esté apagado, cualquiera puede crear una cuenta con un correo que no
es suyo. Con 0 alumnas reales no importa; el día que se abra al público, sí.

Verificarlo sin entrar al panel:

```bash
curl -s "https://howtuhfdxgyluskrlkze.supabase.co/auth/v1/settings" -H "apikey: <publishable>" 
# mailer_autoconfirm: true  -> confirmacion APAGADA
# disable_signup: false     -> altas habilitadas
```

### El correo va a salir de Resend, que es estadounidense

**Decidido el 2026-08-02.** La base se movió a Fráncfort por residencia de
datos, pero **el proveedor de correo elegido opera en Estados Unidos**. Un
correo transaccional lleva nombre y dirección de la alumna, o sea dato personal
de una residente de la UE.

**No es un descuido: es una asimetría deliberada** que hay que reflejar en la
política de privacidad. La alternativa europea evaluada fue Brevo (Francia).

---

## Project

Brunela Dance Trainer is a Next.js App Router project for a dance / pilates studio.
The app has two major surfaces:

- Public marketing landing at `/`
- Private member + admin system behind Supabase auth

Spanish is the primary language. The public landing and sign-in surfaces have a lightweight ES/EN/FR/IT language switcher powered by `src/i18n/public.ts`.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase SSR auth and Postgres (eu-central-1)
- Bunny Stream para video HLS con multi-audio
- Worker de mux propio en `worker/` (ffmpeg, sin dependencias npm)
- Stripe: checkout, portal de facturacion y webhook

## Main routes

- `/` public landing
- `/sign-in` password sign-in with Supabase
- `/dashboard` private studio overview
- `/dashboard/library` member content library
- `/dashboard/library/[slug]` class detail + progress save
- `/dashboard/programs` structured programs overview
- `/dashboard/programs/[slug]` program detail by day
- `/dashboard/live` live sessions, booking, cancellation, access links
- `/admin` admin overview
- `/admin/videos` admin CRUD for videos
- `/admin/programs` admin CRUD for programs + program days
- `/admin/settings` admin CRUD for site settings
- `/admin/users` admin updates for tiers, levels, onboarding and admin role
- `/dashboard/chat` DM con la profesora
- `/dashboard/community` salas de chat por plan
- `/dashboard/documents` documentos del estudio
- `/dashboard/plan` planes y checkout
- `/api/video/[videoId]/[...path]` proxy de manifests HLS con control por RLS
- `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhooks`
- `/api/progress` guardado de progreso
- `/api/admin/videos/*` subida de video y audio a Bunny

## Important folders

- `app/` route UI
- `components/` shared UI pieces
- `src/features/auth/` auth server actions and guards
- `src/features/admin/` admin actions and dictionaries
- `src/features/studio/` member studio helpers and server actions
- `src/lib/supabase/` Supabase server client (`server` = sesion, `admin` = service_role)
- `src/lib/video/` Bunny: firma de URLs y reescritura de manifests HLS
- `src/lib/stripe/` catalogo de precios y resolucion de modo test/live
- `src/lib/audio/` bucket `class-audio` y config de bitrate
- `worker/` worker de mux (cola -> ffmpeg -> Bunny -> swap)
- `scripts/` utilidades sueltas y `seed-demo.sql`
- `supabase/migrations/` schema and RLS source of truth. ORDEN NO ALFABETICO:
  ver SETUP.md 1.1

## Auth model

- Auth por contrasena Y por Google OAuth (`components/oauth-buttons.tsx`).
- La URL de callback de Google contiene el ref del proyecto Supabase: si el
  proyecto cambia, hay que agregarla en Google Cloud Console o no entra nadie.
- There is no public sign-up route in the app right now.
- Users are expected to exist first in Supabase Auth.
- `profiles` is auto-created from `auth.users` via trigger.
- Admin access is gated by `profiles.is_admin`.

## Data model summary

Core tables used by the app:

- `profiles`
- `videos`
- `programs`
- `program_days`
- `user_progress`
- `site_settings`
- `subscriptions`
- `live_sessions`
- `live_session_bookings`
- `live_session_access_links`
- `categories`, `documents`, `studio_announcements`
- `chat_rooms`, `chat_messages`, `chat_bans`, `chat_mutes`
- `video_mux_jobs`, `reward_claims`, `subscription_webhook_events`

Son 20 tablas. Las escribibles por una alumna son solo 6: `user_progress`,
`live_session_bookings`, `chat_messages`, `chat_mutes`, `chat_rooms` y
`profiles`. En el resto `authenticated` tiene solo lectura (migracion 18).

Membership tiers:

- `none`
- `corps_de_ballet`
- `solista`
- `principal`

Access is enforced mainly by Supabase RLS, not just UI hiding.

## Current system behavior

- Dashboard overview reads real user profile and subscription state.
- Library reads accessible videos through RLS and shows saved progress.
- Video detail can save progress through server actions.
- Programs show day-by-day structure and link into the right class context.
- Live sessions allow reserve / cancel flows through server actions.
- Admin screens already manage videos, programs, settings and users.

## Environment variables

Required in normal development:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Required for Stripe webhook work:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (su prefijo `sk_live_` o `sk_test_` es lo UNICO que decide
  el modo, y con el modo el juego de price ids: ver `src/lib/stripe/catalog.ts`)
- `STRIPE_WEBHOOK_SECRET`

Required for video:

- `BUNNY_STREAM_API_KEY`
- `BUNNY_STREAM_LIBRARY_ID`
- `BUNNY_STREAM_CDN_HOSTNAME`
- `BUNNY_STREAM_TOKEN_AUTH_KEY`

El worker de mux usa las mismas: `node --env-file=.env.local worker/index.mjs`.
No tiene `.env` propio y acepta `NEXT_PUBLIC_SUPABASE_URL` como alias de
`SUPABASE_URL`.

## Design and product notes

- The product should feel editorial, premium and dance-focused.
- Avoid generic SaaS styling.
- Avoid washed-out contrast and low-legibility sections.
- The member area should feel like a private studio, not a default admin template.

## Conventions

- Prefer server components for data-heavy pages.
- Use server actions for mutations.
- Keep business rules in Supabase + server actions, not only in client components.
- Reuse helpers in `src/features/studio/helpers.ts` for labels and i18n resolution.
- When editing files manually, use ASCII unless the file clearly needs accents.

## Local workflow

1. `npm install`
2. `npm run dev`
3. `npx tsc --noEmit` antes de cerrar cambios.

NO corras `npm run build` con el dev server levantado: pisa `.next` y rompe el
login con `__webpack_modules__ is not a function`. Ya paso dos veces. Si necesitas
un build de verdad, hacelo en un worktree aparte:

```bash
git worktree add --detach /tmp/verify HEAD
# enlazar node_modules y correr next build ahi
```

Y verifica SIEMPRE desde git, no desde disco: `tsc` pasa con archivos sin
trackear que Vercel no va a tener.

## PENDIENTE: verificar el reproductor en iPhone / iPad

Esta es la unica parte del reproductor que **no esta verificada**. Todo lo demas
se probo en Chrome real (reproduccion, cambio de idioma, recuperacion de token
vencido, control de acceso). El equipo de desarrollo trabaja en Windows y no
tiene Safari ni dispositivo Apple, y el WebKit de Playwright en Windows no trae
el motor HLS nativo, asi que correrlo ahi no probaria nada.

Importa porque el publico de un producto de danza en casa usa iPhone y iPad.

### Por que puede fallar justo ahi

Bunny exige un token en CADA archivo (playlist y segmentos) y no manda cookie.
Los reproductores no propagan el query string a los hijos, asi que servimos las
playlists reescritas desde `/api/video/...` con los tokens ya adentro
(`src/lib/video/hls-manifest.ts`). Safari tiene ademas dos caminos posibles:

- iOS 17.1+ suele usar **hls.js** (Managed Media Source) — camino ya verificado.
- Versiones anteriores usan el **motor HLS nativo**, que no expone ningun hook
  de red y lista las pistas de audio por `video.audioTracks` de WebKit, una API
  distinta. Ese camino esta implementado pero nunca se ejecuto en un Apple.

### Que hay que probar (en Safari, iPhone y iPad)

Abrir una clase que tenga mas de un idioma, estando logueada como miembro:

1. El video **arranca** y sigue mas alla del primer minuto, no solo unos segundos.
2. Arriba a la derecha aparecen los botones de idioma (ES / EN / FR / IT).
3. Tocar otro idioma **cambia el audio** y la reproduccion NO se reinicia.
4. Lo mismo en pantalla completa.
5. Pausar, esperar 15 minutos, volver y adelantar: tiene que seguir reproduciendo.

### Que sintoma es un fallo, y que significa

| Sintoma | Que esta pasando |
|---|---|
| Pantalla negra o spinner eterno tras la miniatura, o el cartel "No se pudo cargar el video" | Los segmentos dan 403: el manifest reescrito no le esta llegando al motor nativo |
| Reproduce bien pero **no aparece ningun boton de idioma** | `video.audioTracks` viene vacio en WebKit; habria que usar el menu nativo de pantalla completa |
| Los botones aparecen pero tocarlos no cambia nada | WebKit ignora `track.enabled`; habria que cambiar de idioma recargando el stream |
| Arranca y se corta a los pocos segundos | Problema de token o de segmentos, mismo origen que el primer caso |

### Como diagnosticar

Conectar el iPhone a una Mac, Safari → menu Desarrollo → elegir el dispositivo →
pestana Red. Buscar respuestas **403** contra `*.b-cdn.net`. Si las hay, el
problema es el token en los segmentos. Si no hay 403 y el video igual no se ve,
el problema es de codecs o del motor, no de acceso.

## PENDIENTES — 2026-08-01

Ordenados por lo que bloquea a lo que puede esperar.

### Bloqueantes para dar por cerrada la migración

- [ ] **Subir un video real** desde `/admin/videos` y reproducirlo. Valida Bunny,
      el worker de mux y el proxy de manifests de punta a punta. Es lo único de
      las 7 pruebas de corte que quedó sin hacer.
- [ ] **Checkout de prueba** con `4242 4242 4242 4242` contra la base nueva:
      confirmar que la suscripción se escribe y el tier se desbloquea.
- [ ] **Decidir qué pasa con `dallapevincenzo@gmail.com`** (admin o borrarla).

### Antes de abrir al público

- [ ] **Desplegar `feat/rediseno-completo`.** Producción todavía muestra el
      diseño de mayo.
- [ ] **Verificar el reproductor en iPhone / iPad** — ver la sección de abajo. Es
      la única parte entregada sin medir, y el público de un producto de danza en
      casa usa iPhone.
- [ ] **Pasar Stripe a producción**: cambiar `STRIPE_SECRET_KEY` a la `sk_live_`
      y rehacer la configuración del portal de clientes (es por modo). Lista
      completa en `SETUP.md` § 3.5. **No hay SQL que correr**: los 12 price ids
      de los dos modos ya están cargados.
- [ ] **Rotar la `service_role`** por higiene (`SETUP.md`; el orden importa:
      crear la nueva, redeploy, verificar, recién ahí revocar la vieja).

### Después, con dos semanas de margen

- [ ] **Pausar el proyecto Supabase viejo** (pausar, NO borrar). Al hacerlo mueren
      de paso las dos cuentas `*.demo@brunela.local`, una de las cuales todavía
      es admin con contraseña conocida.
- [ ] **Sacar la URI de callback vieja** de Google Cloud Console. Recién al final.
- [ ] Borrar `_local/` (tiene hashes de contraseña de la migración; está en
      `.gitignore`).

### Deuda técnica conocida

- [ ] **Migración de color**: ~304 ocurrencias de magenta hardcodeado en 24
      archivos. Unas 166 son tintes claros que ya tienen `--pink-wash`. El
      sidebar y el dashboard están migrados; el resto no.
- [ ] **Plan de escalabilidad A–E**, aprobado y postergado: filtrado de la
      biblioteca en SQL, los `count exact` de `/admin`, rate limiting,
      degradación con gracia.
- [ ] **`videos.stream_asset_id` es una COLUMNA MUERTA.** Quedo de la epoca de
      Mux.com. Cero filas la usan, nadie la escribe ni la lee. Se saco de la
      interfaz el 2026-08-03 pero la columna sigue en la base a proposito: una
      migracion menos es una cosa menos que puede salir mal. **No confundir con
      `stream_playback_id`, que SI esta viva**: Bunny la escribe con la URL del
      HLS y el proxy de video la usa como respaldo para las clases viejas.

- [ ] **Unificar el CSS de las pantallas de auth.** `sign-in-form.tsx` y
      `registro-form.tsx` tienen el mismo bloque `<style>` duplicado, porque en
      este proyecto cada pantalla de auth lleva su CSS adentro en vez de
      `globals.css`. Se dejó así para no mezclar la limpieza con el alta de
      usuarios; si las dos se desincronizan, el login y el registro dejan de
      parecerse.
- [ ] Edición de perfil para miembros (el onboarding inicial ya está). La policy
      `profiles_update_self_or_admin` y el grant de `UPDATE` ya están puestos.
- [ ] Seguir ampliando el diccionario público ES/EN/FR/IT.
