# CLAUDE.md

---

# ESTADO ACTUAL — 2026-08-06

**Leer esto primero.** Es lo que hace falta para retomar sin contexto previo.

### Cómo retomar en cinco minutos

1. **En qué punto está**: **desplegado y cobrando de verdad.** El rediseño ya
   está en `main` y en producción, en `bruneladance.com`. Stripe pasó a modo
   producción el 2026-08-06. Las 29 migraciones aplicadas y verificadas, y la
   base **sin datos de prueba**.

   **Lo que falta para abrir no es técnico: es contenido.** La base está vacía
   — sin clases, alguien puede pagar y entrar a un estudio sin nada.
2. **Qué se está haciendo ahora**: nada a medias. Packs, invitaciones y panel
   de precios están terminados y verificados. Lo siguiente es el **rediseño de
   la landing** y, después, hacerla editable — ver *ÚLTIMO PASO* en Pendientes.
3. **Antes de tocar SQL**, leer *Trampas que ya costaron caro* (son ocho, todas
   fallan en silencio) y el orden de migraciones en `SETUP.md` § 1.1, que **no es
   alfabético**.
4. **Los tres comandos de verificación**, del más rápido al más lento:

   | Comando | Qué mira | Cuándo |
   |---|---|---|
   | `npm run verificar` | RLS, policy y grant por tabla; guarda en cada action y ruta. **~1 s, sin credenciales** | Corre solo en cada commit |
   | `npm run test:sistema` | **127 pruebas** de interfaz, rutas, caché, plata y contenido pago. **~0,5 s, sin base** | Al tocar pantallas, cobro o acceso |
   | `npm run test:aislamiento` | **126 pruebas** contra Supabase real, incluida la **auditoría adversarial**. **~165 s** | Al tocar cualquier policy |

   ⚠️ Los tres se **probaron rompiendo cosas a propósito** para confirmar que dan
   rojo. Una verificación que no puede fallar no es verificación — ver trampa 7.

   El hook de pre-commit se instala solo con `npm install` (`prepare` →
   `core.hooksPath`). Para saltearlo en una emergencia: `git commit --no-verify`.

   Y uno que no corre solo, para antes de tocar Stripe:
   `node --env-file=.env.local scripts/verificar-precios-live.mjs` — comprueba
   los 6 price ids contra la API de Stripe. Ya cazó un precio archivado.
5. **Reglas de trabajo de este proyecto**: las migraciones se muestran antes de
   correrlas y las corre el dueño del proyecto en Supabase; se verifica contra la
   base real, no se asume; primero se diagnostica y se reporta, después se
   implementa.

| Si vas a… | Leé |
|---|---|
| Poner el proyecto en marcha | `SETUP.md` |
| Explicarle algo a Brunela | `docs/manual-brunela.md` |
| Saber qué se entregó y qué no | `docs/entrega.md` |
| Entender los límites de escala | `docs/escalabilidad.md` |

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
curl -sI https://bruneladance.com/sign-in | grep -i x-vercel-id
# gru1::fra1::xxxxx
#       ^^^^ region donde CORRIO la funcion (el primero es solo el borde de entrada)
```

## 🔴 Qué está desplegado y qué no

**Producción corre `7e66a35`**, que es el código de **mayo** más un hotfix de
seguridad. **El rediseño NO está desplegado.**

| Rama | Contenido | Estado |
|---|---|---|
| `main` | código de mayo + hotfix + `fra1` | **en producción** |
| `feat/rediseno-completo` | 3 meses de trabajo: rediseño de las 7 pantallas, reproductor Bunny, worker de mux, checkout y portal de Stripe, mejoras de rendimiento | **sin desplegar**, build verificado desde git |

Para desplegar el rediseño: mergear esa rama a `main`. Conviene hacerlo primero
como **preview** (push de la rama) y probarlo antes de mergear — son 55 archivos
y 5.744 líneas.

## Base de datos

- **32 migraciones**, 31 aplicadas y verificadas y **una pendiente** (la 32, `20260921_3_la_lista_vacia_ahora_si_se_rechaza.sql`). ⚠️ **El orden NO es
  alfabético** — está en `SETUP.md` § 1.1. Las trampas: `phase_b1` va DESPUÉS de
  `phase_b`, `phase_b0` va sola, y las 17 y 18 van al final.

  > **La 29 cerró una filtración real** encontrada *atacando* la base, no
  > leyendo: `documents_select_published` sólo miraba `is_published`, y
  > `/dashboard/documents` **firma** una URL de descarga para cada documento que
  > RLS devuelve, con `service_role`, que saltea el bucket privado. Una cuenta
  > gratuita recibía enlaces funcionando para contenido de `principal`.
  > **Cuarta vez de la misma familia** —`categories`, chat, chat por plan,
  > documentos—: la columna existe, la interfaz la respeta, la policy no.
  > El código *afirmaba* que RLS ya filtraba por plan; ese comentario es
  > probablemente por qué nadie lo vio leyendo.
- **25 tablas**, RLS activa en todas. Verificado el 2026-08-05 contra la base:
  las migraciones crean 25 y la base tiene 25, **cuadra exacto**.

  > Hubo un período en que no cuadraba —había una tabla en `public` que ninguna
  > migración creaba— y quedó anotado como pendiente. Al recontar el 2026-08-05
  > los números coinciden y no hay ninguna tabla sin RLS, así que **está
  > cerrado**. El diagnóstico sigue en `scripts/diagnostico-tabla-de-mas.sql` por
  > si el conteo vuelve a desviarse.
- **Permisos acotados** (migraciones 17 y 18): `anon` sin ningún privilegio de
  tabla, `authenticated` sin `DELETE` en ninguna y sólo-lectura en casi todas.
  Si aparece un `42501 permission denied`, es esto: se otorga la operación
  puntual sobre esa tabla, no se vuelve al grant global.
- **Contenido: vacío, y limpio.** Los datos de prueba se borraron el
  2026-08-06, verificado tabla por tabla:

  | | |
  |---|---:|
  | videos, programas, días, sesiones, packs | **0** |
  | reservas, enlaces de Zoom, invitaciones | **0** |
  | salas y mensajes de chat | **0** |
  | trabajos de muxeo, logros, progreso | **0** |
  | **categorías** (las reales) | **7** |
  | **site_settings** | **7** |

  **Cero huérfanos**: `auth.users` y `profiles` cuadran 4 a 4, ningún
  participante fantasma en salas, ningún `updated_by` colgado.

  `subscription_webhook_events` (16) se conserva: es el rastro de auditoría de
  Stripe y no se borra nunca.

  Para volver a poblar y evaluar diseño: `scripts/seed-demo.sql` (idempotente,
  todo con prefijo `demo-`). El script del borrado quedó en
  `scripts/borrar-datos-de-prueba.sql`, con las dos trampas de claves foráneas
  que costó descubrir.

### Cuentas

**Cuatro, y son todas.** Al 2026-08-06 no queda ninguna cuenta de prueba.

| Correo | admin | dueña | tier |
|---|---|---|---|
| `brunela.dance@gmail.com` | sí | **sí** | principal |
| `vichendallape@gmail.com` | sí | no | principal |
| `dallapevichen12@gmail.com` | sí | no | principal |
| `vidallape8@gmail.com` | no | no | none |

Las tres admin se importaron del proyecto viejo con sus UUID originales. La
cuarta es de Vincenzo, sin plan.

> **Se borraron el 2026-08-06**: las cuatro `@brunela.test`,
> `dallapevincenzo@gmail.com` y `brunela.sssdance@gmail.com`.
>
> ⚠️ La última tenía una suscripción `trialing` en Stripe (modo test), y el
> orden importó: **cancelar en Stripe, esperar el webhook, y recién después
> borrar la cuenta.** Al revés, `subscriptions.user_id` es `on delete cascade`,
> así que la fila desaparece y el evento siguiente intenta reescribirla contra
> un perfil inexistente — violación de clave foránea, 500, y Stripe reintentando
> durante días. Se hizo bien: los dos eventos de la cancelación llegaron antes
> del borrado.

**Quién es la dueña del estudio se DECLARA**, no se deduce: columna
`profiles.is_studio_owner`, con índice único parcial y check constraint. Antes
salía de `created_at`, y eso se sostenía falsificándole la fecha a una cuenta
demo. `get_studio_admin()` prefiere la dueña declarada y sólo cae a "la admin más
antigua" si no hay ninguna.

## Trampas que ya costaron caro

Ocho cosas que fallan **en silencio**. Ninguna da error.

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

7. **`begin;`/`commit;` propios en el SQL Editor de Supabase.** El editor ya
   envuelve lo pegado en su transaccion; un `commit;` propio la cierra antes de
   tiempo y **lo que sigue se ejecuta sin error visible y no persiste**. El
   editor dice "Success" y la base queda igual.
   Se descubrio con `20260804_chat_aislamiento_por_plan.sql`: el bloque pegado
   suelto entraba, el mismo SQL con `begin/commit` no. **Pegar solo el SQL.**
   Y verificar siempre por COMPORTAMIENTO (`npm run test:aislamiento`), no por
   `pg_policies`: los metadatos tambien pueden enganar si la consulta esta mal
   escrita, como paso con `'%tier_required%'`, que es substring de
   `membership_tier_required`.

8. **`create or replace function` reemplaza el cuerpo ENTERO, y el orden de las
   migraciones decide quien gana.** Varias migraciones tardias redefinen
   funciones nacidas en `phase_a` / `phase_b`. Correrlas fuera de orden no da
   ningun error: la version vieja pisa a la nueva y las comprobaciones agregadas
   desaparecen.
   Pasa hoy con `20260805_invitaciones_a_sesiones.sql`, que redefine el trigger
   de reservas y la funcion del enlace de Zoom. Corrida antes de `phase_b`, el
   unico sintoma seria una alumna invitada que no puede anotarse.
   De ahi tambien la regla al escribirlas: **copiar la funcion entera** desde la
   version vigente y marcar lo que cambia. Copiar de menos no rompe la
   migracion, borra comprobaciones en silencio.

   > Corolario, del mismo dia: **una prueba puede pasar por el motivo
   > equivocado**. Dos pruebas de invitaciones daban verde porque la tabla no
   > existia — `expect(error).not.toBeNull()` se satisface con "tabla no
   > encontrada". Por eso `tests/aislamiento/` exige el **codigo de error exacto**
   > (`42501`), lleva **control positivo** por `service_role`, y tiene una guarda
   > en `beforeAll` que tira el archivo entero si falta la migracion.

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

### Tres funciones le responden a `anon` y se decidió DEJARLAS

**Decidido el 2026-08-06**, con la migración escrita y descartada.

`is_admin()`, `current_user_membership_tier()` y `can_start_dm()` son
alcanzables por RPC con la clave publicable, la que está en el HTML de la
landing. **No filtran nada**: sin sesión `auth.uid()` es null y devuelven
`false`, `'none'` y `false`.

**Por qué no se cerraron:**

1. **Beneficio cero.** No hay ningún dato que proteger; es sólo superficie.
2. **Riesgo alto.** Cerrarlas obliga a `revoke ... from PUBLIC` — revocarle a
   `anon` **no sirve**, porque el permiso lo hereda de PUBLIC. Y revocar de
   PUBLIC deja sin `EXECUTE` a **todos** los roles a la vez, así que hay que
   devolvérselo a `authenticated` en la misma transacción. `is_admin()` está en
   **188 policies**: si ese `grant` no entra, la aplicación deja de leer entera.
3. **El modo de fallo es el que ya nos pasó.** Ese mismo día el SQL Editor de
   Supabase cortó una transacción en silencio y costó cuatro intentos (trampa
   7). Es exactamente el escenario donde el `grant` no entra, el editor dice
   *Success*, y nadie se entera hasta que una alumna no puede abrir nada.

A dos días de entregar, riesgo real contra beneficio nulo.

**Cómo quedó cubierto sin mentir:** `tests/aislamiento/adversario.test.ts` las
lleva en `RESPONDEN_A_ANON` como **excepción declarada con su valor esperado**.
La prueba sigue **descubriendo** todas las funciones —si aparece una cuarta,
rojo— y además **comprueba que estas tres siguen devolviendo exactamente eso**.
Si alguna cambiara y empezara a contestar otra cosa, se pone en rojo igual.

> **Mejora futura, sin presión de fecha:** hacerlo con la app frenada, corriendo
> los tres `revoke`+`grant` juntos y verificando ANTES de soltar que
> `authenticated` conserva el `EXECUTE`. La verificación correcta es un
> **control positivo**: comprobar sólo que `anon` quedó afuera pasaría igual con
> el sistema caído.

### El correo va a salir de Resend, que es estadounidense

**Decidido el 2026-08-02.** La base se movió a Fráncfort por residencia de
datos, pero **el proveedor de correo elegido opera en Estados Unidos**. Un
correo transaccional lleva nombre y dirección de la alumna, o sea dato personal
de una residente de la UE.

**No es un descuido: es una asimetría deliberada** que hay que reflejar en la
política de privacidad. La alternativa europea evaluada fue Brevo (Francia).

### 🔴 NUNCA correr `npm audit fix --force` en este proyecto

**Comprobado el 2026-08-03.** El aviso de Next abarca `9.3.4-canary.0` hasta
`16.3.0-canary.5`, o sea *todas* las versiones publicadas. npm no encuentra
ninguna "segura" por arriba, así que elige la única por abajo y anuncia:

```
Will install next@9.3.3, which is a breaking change
```

Eso es **bajar de Next 15 a Next 9**: seis años y cuatro majors atrás, sin App
Router. Destruye la aplicación entera. `npm audit fix` a secas es seguro; el
`--force` no.

La forma correcta es subir a la última 15.x a mano (`npm install next@15.5.x`).

### El `overrides` de `package.json` no es decorativo

Dos dependencias **transitivas** quedaron sin parche porque Next las fija:

| Paquete | Next pide | Forzado a | Por qué |
|---|---|---|---|
| `sharp` | `^0.34.3` (opcional) | `^0.35.3` | 4 CVE de libvips |
| `postcss` | `8.4.31` (anidada) | `$postcss` → 8.5.25 | XSS y lectura de archivos |

`postcss` va como `$postcss` y no como un rango: al ser también dependencia
directa nuestra, npm rechaza cualquier otra cosa con `EOVERRIDE`.

Si alguien borra este bloque, las dos vuelven solas a la versión vulnerable y el
`npm audit` deja de estar en cero. Lo que hay que verificar después de tocarlo es
`/_next/image`, que es lo que ejercita `sharp` de verdad.

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
- `/dashboard/plan` planes, packs y checkout
- `/admin/packs` packs de clases: crear, elegir clases, publicar
- `/admin/precios` importes y price ids de planes y packs, con aviso de Stripe
- `/api/video/[videoId]/[...path]` proxy de manifests HLS con control por RLS
- `/api/stripe/checkout`, `/api/stripe/checkout-pack`, `/api/stripe/portal`,
  `/api/stripe/webhooks`
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
- `live_session_invitations`
- `categories`, `documents`, `studio_announcements`
- `chat_rooms`, `chat_messages`, `chat_bans`, `chat_mutes`
- `packs`, `pack_videos`, `pack_purchases`
- `video_mux_jobs`, `reward_claims`, `subscription_webhook_events`

Son 25 tablas. Las escribibles por una alumna son solo 6: `user_progress`,
`live_session_bookings`, `chat_messages`, `chat_mutes`, `chat_rooms` y
`profiles`. En el resto `authenticated` tiene solo lectura (migracion 18).

**`live_session_invitations` es la unica cosa del sistema que da acceso sin
mirar el plan.** Abre los tres lugares que gobiernan una sesion (verla,
reservarla, ver el Zoom), y la regla vive en dos funciones:
`current_user_is_invited_to_live_session(sesion)` para `authenticated`, y
`is_invited_to_live_session(sesion, alumna)` **solo para `service_role`** —
exponer la de dos argumentos dejaria enumerar quien esta invitada a que, porque
una funcion con EXECUTE para `authenticated` es un endpoint RPC publico.
Cubierta por `tests/aislamiento/sesiones.test.ts`.

**`pack_purchases` es la SEGUNDA**, y la mas amplia: un pack comprado abre clases
sueltas sin mirar el plan. Toca una sola policy —`videos_select_allowed_by_tier`,
la que protege el catalogo entero— y la regla vive en el mismo par de funciones:
`current_user_has_purchased_video(video)` para `authenticated`, y
`has_purchased_video(video, alumna)` **solo para `service_role`**.
El reproductor no necesito ni un cambio: `app/api/video/[videoId]/[...path]`
busca con el cliente de la alumna, asi que decide RLS.
Cubierta por `tests/aislamiento/packs.test.ts`.

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

Opcionales, **sólo para el aviso de precios de `/admin/precios`**:

- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_SECRET_KEY_LIVE`

Sirven para verificar el juego de price ids del **otro** modo. La clave ES el
modo: con una `sk_test_` Stripe no dice "este price es de producción", dice "no
existe" — y son dos problemas distintos. Con las dos cargadas, el panel
distingue de verdad.

**En producción se carga la de TEST** (`STRIPE_SECRET_KEY` va a ser la live). Una
clave de prueba filtrada no cobra nada real. En local no hace falta ninguna: los
ids de producción salen en gris como *no verificables*, nunca en verde.

⚠️ Las usa **un solo archivo**, `src/lib/stripe/verificar-precio.ts`, que sólo
hace `prices.retrieve`. No se exportan ni se instancian en ningún otro lado, para
que no puedan terminar creando una sesión de pago. Y se comprueba el **prefijo**
de cada una: una `sk_live_` guardada en `STRIPE_SECRET_KEY_TEST` contestaría con
total seguridad sobre el juego equivocado, y un aviso que miente es peor que no
tener aviso.

Requerida para que el proyecto de Supabase no se pause:

- `CRON_SECRET`

Un valor largo y aleatorio (`openssl rand -hex 32`). Vercel lo manda solo como
`Authorization: Bearer …` en sus invocaciones de cron. **Sin ella, la ruta
responde 503 y el keepalive NO corre** — es a propósito: esa ruta consulta con
`service_role` y prefiere quedarse cerrada antes que abierta.

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

## PENDIENTES — 2026-08-05

Ordenados por lo que bloquea a lo que puede esperar.

### ✅ Migraciones corridas y verificadas (2026-08-04)

| Migración | Verificado |
|---|---|
| `20260803_activity_events.sql` | tabla creada, grants exactos |
| `20260803_marketing_consent.sql` | 4 columnas + trigger |
| `20260803_unify_pilates_categories.sql` | cero referencias a reformer/mat |
| `20260803_studio_documents_bucket.sql` | bucket privado |
| `20260804_chat_autor_y_rate_limit.sql` | `author_name` poblado, cero sin autor |
| `20260804_guardar_progreso_rpc.sql` | `prosecdef=false`, `greatest()` en las dos ramas |
| `20260804_fix_default_privileges.sql` | cero TRUNCATE/REFERENCES/TRIGGER |
| `20260804_chat_aislamiento_por_plan.sql` | 14/14 en `test:aislamiento` |
| `20260805_invitaciones_a_sesiones.sql` | 34/34 en `test:aislamiento` |

**✅ `20260921_formulario_de_clases.sql` corrió el 2026-09-21.**

**✅ `20260921_2_vaciar_planes_no_se_repara.sql` corrió el 2026-09-21.**

**🔴 QUEDA `20260921_3_la_lista_vacia_ahora_si_se_rechaza.sql`.** La 2 destapó
que el CHECK de la lista vacía **nunca funcionó**: `array_length('{}', 1)` es
NULL, no 0, y un CHECK con NULL deja pasar. Hasta que se corra,
`npm run test:aislamiento` da **125 de 126**.

### ✅ Lo que pidió Brunela — bloque A, hecho (2026-08-05)

- **Códigos promocionales.** No hubo nada que programar: `allow_promotion_codes`
  ya estaba en el checkout, y el webhook resuelve el plan por `price.id`, que un
  descuento no cambia. Pasos de panel en `docs/manual-brunela.md` § 9.
  ⚠️ **Los cupones son por modo**: los de prueba no existen en producción.
- **Invitaciones puntuales a sesiones.** Ver la sección del modelo de datos.

### ✅ Packs de clases sueltas — hecho y verificado (2026-08-05)

**Qué es:** vender un pack de clases (ej. 5) con **pago único, sin suscripción**
y **acceso permanente**. Cambia la pregunta del sistema de *"¿qué plan tiene?"*
a *"¿qué plan tiene O qué compró?"*.

**Lo que hace que sea abordable** — medido, no supuesto:

- Sólo **4 policies** gobiernan contenido por plan: `videos_*`, `programs_*`,
  `program_days_*`, `live_sessions_*`. Un pack de clases sueltas toca **una**:
  `videos_select_allowed_by_tier`.
- El proxy de video (`app/api/video/[videoId]/[...path]/route.ts`) hace su
  búsqueda con el cliente **de la alumna**, así que **RLS decide**. Si la policy
  dice que sí, el reproductor dice que sí: **cero cambios en el reproductor**.

**Tablas nuevas:** `packs`, `pack_videos`, `pack_compras`, más una vista
`packs_publicos` y una función `user_has_purchased_video(video_id)` para que la
policy quede legible y haya un solo lugar que cambiar.

**Decisiones tomadas:**

| | |
|---|---|
| Acceso | **Permanente**. `vence_el` queda en la tabla por si algún día se vende algo temporal, pero se escribe `null` |
| Vitrina en la landing | `service_role` leyendo la **vista** `packs_publicos` — NO se le da `SELECT` a `anon` |
| Por qué la vista | La lista de columnas la impone Postgres, no un comentario en TypeScript. Es una página **pública**: el radio de daño es todo internet |
| Qué expone | slug, nombre, descripción, precio, cuántas clases, portada, orden, destacado |
| Qué NO expone | ❌ `bunny_video_id`, `stream_playback_id`, ids de `pack_videos`, `stripe_price_id` |
| Flujo de compra | Se reusa el camino de los planes con un parámetro hermano `?pack=<slug>`, **validado contra la tabla**. El precio sale de la base, nunca de la URL |
| Configuración | Brunela decide desde `/admin` qué packs salen en la landing, en qué orden y cuáles destaca. Nada hardcodeado |

**🔴 Los dos `unique` que NO son opcionales — y son distintos:**

1. `pack_compras.stripe_checkout_session_id UNIQUE` — **Stripe reintenta los
   webhooks.** Sin esto, un reintento da dos packs por un pago.
2. `packs.stripe_price_id UNIQUE` — si dos packs comparten price id, el webhook
   pregunta "¿qué pack compró?" y **resuelve el primero que encuentra**. La
   alumna paga el Pack A y recibe el B. El error tiene que nombrar el pack en
   conflicto: un `23505` pelado dice el constraint, no cuál es el otro pack.

**Las dos trampas de Stripe:**

- `mode: "subscription"` está fijo en `app/api/stripe/checkout/route.ts`. Un pack
  necesita `mode: "payment"`. Es una rama, no una reescritura.
- **La metadata viaja por otro lado.** `customer.subscription.*` trae
  `metadata.user_id` porque el checkout se lo pone a la suscripción. En un pago
  único **no hay objeto suscripción**: va en la sesión de checkout y el webhook
  la lee de otro sitio. Equivocarse ahí = pack pagado sin acceso, que es la
  trampa 1 con otro disfraz.

El webhook actual **no se rompe**: ignora lo que no es suscripción devolviendo un
motivo, así que agregar `checkout.session.completed` es aditivo.

**Todo entregado y verificado — 51/51 en `npm run test:aislamiento`:**

| Pieza | Dónde |
|---|---|
| Migración | `20260805_packs_de_clases.sql` |
| CRUD de packs | `/admin/packs` + `components/admin-pack-drawer.tsx` |
| Precios con aviso de Stripe | `/admin/precios` |
| Vitrina pública | `components/packs-publicos.tsx`, desde la vista `packs_publicos` |
| Checkout | `app/api/stripe/checkout-pack/route.ts` (**ruta aparte**) |
| Webhook | `registrarCompraDePack()` en `app/api/stripe/webhooks/route.ts` |
| Pruebas | `tests/aislamiento/packs.test.ts` (17) |

**Decisiones de implementación que conviene no deshacer:**

- **El checkout de packs es una RUTA APARTE**, no un `if` dentro del de
  suscripciones. Ese cobra y funciona; meterle una rama que cambie `mode`, el
  árbol de precios, la metadata y el destino de vuelta es tocar el único camino
  de cobro que hoy anda para agregar uno que todavía no.
- **Un pack nace SIN publicar.** Y no se puede publicar sin al menos una clase y
  sin identificador de Stripe del modo activo: es la única validación que
  *bloquea*, porque el fallo lo sufre la alumna en el checkout.
- **Un pack vendido no se borra.** `pack_purchases.pack_id` es `on delete
  restrict`; la acción lo frena antes con un mensaje legible, porque el error de
  clave foránea en crudo no le dice nada a Brunela. Se despublica.
- **El acceso se calcula en vivo contra `pack_videos`, no se congela al comprar.**
  Sacar una clase de un pack se la saca también a quien ya lo pagó. Es correcto
  para arreglar un error de armado, y el panel lo avisa cuando hay compras.
- **En el cruce plan/pack, el pack va PRIMERO** (en el onboarding y en el
  arranque automático). Quien llegó por un pack no eligió plan, y cobrarle una
  suscripción que no pidió es el peor error posible ahí.

### 🔴 Formulario de clases nuevo — falta correr la migración (2026-09-21)

**Qué cambió:** el formulario de `/admin/videos` pasó de texto libre a listas
cerradas, en el orden que pidió Brunela: título ES/EN, descripción ES/EN, tipo
de contenido, categoría, nivel, duración, materiales, planes, estado y — abajo
de todo, en un recuadro aparte — a qué plan de clases pertenece.

**El vocabulario vive en UN archivo**, `src/features/studio/catalogo-clases.ts`:
los 2 tipos, las 11 categorías, los 4 niveles, los 17 materiales, los 3 planes
y los 2 estados. Lo consumen el formulario de subida, el panel de edición, los
filtros de la biblioteca, el dashboard y la ficha de la clase. Antes cada
pantalla tenía su propia lista escrita a mano, y agregar una categoría la
dejaba en el filtro como slug crudo en minúscula.

**La migración `20260921_formulario_de_clases.sql` NO está corrida.** Agrega dos
columnas, un trigger, un índice GIN, reescribe la policy del catálogo y
reemplaza las categorías. Va **al final de todo**: redefine
`videos_select_allowed_by_tier`, que ya se reescribió tres veces, y corrida
antes que packs pierde la rama de packs en silencio (trampa 8). Trae una guarda
que falla ruidosamente si packs no corrió.

#### 🔴 El acceso al catálogo pasó de RANGO a LISTA

Hasta ahora era «de este plan para arriba»: una columna y una comparación de
rangos. **Pedido explícito del 2026-09-21: combinación libre**, o sea poder
publicar algo para Corps y Principal y no para Solista.

Se advirtió que la alternativa —«de este plan para arriba»— no tocaba ninguna
policy, y se eligió la libre igual. No es un descuido.

| | |
|---|---|
| Quién manda | `videos.planes_permitidos` (`membership_tier[]`). Es lo que lee la policy |
| `membership_tier_required` | **sigue viva pero es DERIVADA**: el plan más bajo de la lista, puesto por trigger. La usan insignias y filtros |
| ⚠️ La trampa | Con `{corps, principal}` esa columna dice `corps_de_ballet` y **Solista NO ve la clase**. Quien quiera saber quién ve qué mira la LISTA |
| Por qué se deja | Sacarla obligaría a tocar una docena de pantallas para no ganar nada |
| El trigger va en **los dos sentidos** | Si la escritura trae la lista, gana la lista. Si trae solo el tier, la lista se reconstruye con la regla vieja — sin esto, todo lo que inserta pasando solo el tier (incluidas `tests/aislamiento/ayudantes.ts`) crearía clases que no ve nadie |
| Filtrar por plan | `contains("planes_permitidos", [plan])`, **nunca** `eq("membership_tier_required", plan)`: con `eq`, filtrar por Solista no encuentra una clase `{corps, solista}` |

Cubierto por `tests/aislamiento/planes.test.ts` (14), con control positivo en
cada bloque y código de error exacto (`23514` para el check, `42501` para la
escritura).

#### 🔴 El agujero que dejó, y que encontró una prueba

`test:aislamiento` contra la base ya migrada dio **125 de 126**, y la que
fallaba tenía razón. Reproducido a mano:

```
clase con planes_permitidos = {solista}
update ... set planes_permitidos = '{}'
  -> sin error
  -> quedó {solista, principal}
```

**Vaciar la lista ensanchaba el acceso**: una clase exclusiva de Solista pasaba
a verla Principal, sin error y sin rastro.

El trigger `videos_sincronizar_planes()` reconstruía la lista cada vez que la
veía vacía. Esa rama **hace falta** — hay código y pruebas que insertan clases
pasando solo `membership_tier_required` — pero en un UPDATE no sabía distinguir:

| | |
|---|---|
| «no vino la lista» | hay que derivarla — **INSERT** |
| «la vaciaron a propósito» | hay que rechazarla — **UPDATE** |

Trataba la segunda como la primera. Y el check constraint
`videos_planes_permitidos_validos` estaba bien escrito y **nunca llegaba a
dispararse**: el trigger corre antes y ya había «arreglado» la fila.

Lo tapa `20260921_2_vaciar_planes_no_se_repara.sql` con una guarda de tres
líneas. En INSERT se sigue derivando, porque ahí `'{}'` es el default de la
columna y no se puede distinguir de «no me mandaron nada».

#### Y debajo había un segundo agujero: el CHECK nunca chequeó

Al dejar de reparar, la 2 destapó que la fila vacía **se guardaba igual**:

```
array_length(planes_permitidos, 1) >= 1
```

`array_length('{}', 1)` en Postgres **no devuelve 0: devuelve NULL**. La
comparación da NULL, y un CHECK sólo rechaza cuando da FALSE — con NULL **deja
pasar**. Esa mitad del constraint fue un adorno desde el primer día.

La otra mitad —`not (planes @> array['none'])`— sí funciona, y por eso la prueba
de `'none'` estuvo siempre en verde: el constraint existía y andaba, sólo que no
controlaba lo que decía controlar.

Lo arregla `20260921_3` con `cardinality()`, que sí devuelve 0. Y repara antes
cualquier fila que haya quedado en `{}`, porque `add constraint` valida las filas
existentes y con una sola fallaría la migración entera.

> **La lección, que es la de siempre en este repo, y esta vez en tres capas:**
> el trigger tapaba al constraint, y el constraint tapaba su propio NULL. Cada
> capa se veía perfecta leyéndola. Lo único que lo encontró fue una prueba que
> ejercita el COMPORTAMIENTO — y tardó dos migraciones en llegar al fondo porque
> cada arreglo destapaba la capa siguiente.
>
> Regla concreta que sale de acá: **para contar elementos de un arreglo en un
> CHECK va `cardinality()`, nunca `array_length(x, 1)`.**

#### El aviso del formulario: mismo error, cometido por una persona

Con combinación libre, Brunela puede dejar una clase para Corps de Ballet y no
para Principal. Quien paga el plan más caro espera ver todo lo de abajo, así que
casi siempre es un descuido de tilde.

`components/selector-de-planes.tsx` lo dice —«Principal no va a ver esta
clase»— y **avisa, no bloquea**: puede haber una clase de bienvenida solo para
quien recién empieza, y bloquear dejaría a Brunela trabada sin forma de decirle
al sistema que esta vez es a propósito. Misma regla que `/admin/precios`.

La regla vive en `planesCarosSinIncluir()`, que solo cuenta como hueco un plan
**más caro** que alguno incluido: `{solista, principal}` deja a Corps afuera y
eso es exclusividad normal, no un error.

#### Lo demás, sin sorpresas

- **Nivel NO es columna nueva.** Los 4 niveles del formulario son un rango de
  `recommended_min_level` / `recommended_max_level`, que ya existían. La ida y
  la vuelta están en `catalogo-clases.ts`. Una columna al lado serían dos
  fuentes de verdad — la familia de errores que este proyecto ya pagó cuatro
  veces.
- **Materiales** siguen en `equipment text[]`: lo que cambió es que ahora son
  una lista cerrada y no un CSV donde «Colchoneta» y «colchoneta» eran dos
  materiales distintos.
- **Las 11 categorías reemplazan** a ballet/pilates/stretching/pbt/pct. Momento
  barato: 0 clases, 0 documentos, 0 salas. Las viejas se **desactivan**, no se
  borran, porque `documents.category_slug` y `chat_rooms.category_slug` guardan
  el slug suelto.
- **«Archivado» salió del desplegable** por pedido. El enum y la columna siguen;
  una clase archivada de antes muestra su propio estado y se puede guardar.

#### Los planes de clases ya existían

Lo que pidió Brunela —«yo te armo las clases de la semana de pies»— es
`programs` + `program_days`, que están desde `phase_a` y se editan en
`/admin/programs`. Lo que faltaba era **engancharlos desde la subida**, porque
el orden de las clases se tiene en la cabeza justo cuando se sube el video.

El formulario de subida ofrece plan + día, con el **primer día libre** ya
completado (el primer hueco, no «el último más uno»: un plan de 14 días al que
le falta el 7 tiene que ofrecer el 7). Si falla el enganche **no se tira abajo
la subida**: el video ya está en Bunny y se avisa para arreglarlo a mano.

El panel de **edición** no lo ofrece a propósito: un día es una relación entre
un plan y una clase, y verla desde un solo lado deja el otro sin contexto.

### Planes de trabajo — se llaman así, y Corps los ve con candado (2026-09-21)

**Qué es un plan de trabajo:** una serie de días en orden, cada uno con una
clase — «Trabajo de pies, 14 días». En la base son `programs` + `program_days`,
que existen desde `phase_a`. **Es LA diferencia entre Corps de Ballet y
Solista:** Corps ve las clases sueltas y elige; Solista las ve ordenadas.

#### El nombre

En toda la interfaz se llaman **«Planes de trabajo»**, nunca «Programas» ni
«planes» a secas. Son 27 strings en 14 archivos: navegación lateral y móvil,
cabecera y barra del panel, accesos del dashboard, `helpers.ts`,
`dictionary.ts`, analíticas y la página de suscripción.

> No había colisión real antes — la interfaz decía «Programas» en todos lados y
> «Planes» solo en la suscripción. La metió el formulario de subida del
> 2026-09-21 al decir «plan de clases». Se renombró igual, por pedido explícito:
> es como habla Brunela.

`src/i18n/messages.ts` y `components/ui/demo.tsx` quedaron **sin tocar a
propósito**: no los importa nadie, son código muerto. Renombrarlos habría hecho
parecer que estaban vivos.

#### 🔴 La vitrina de planes, y qué es lo que NO muestra

Antes, un Corps entraba a `/dashboard/programs` y leía *«Todavía no hay
programas publicados para tu plan»* — porque RLS, correctamente, no le devolvía
ninguno. O sea que a quien había que convencer de subir de plan se le mostraba
una pantalla vacía que se lee como «acá no hay nada».

Ahora ve todos los planes publicados, con candado y con **«Disponible desde
Solista»**, y la tarjeta bloqueada lleva a `/dashboard/plan`. Es el mismo patrón
que la vitrina de la biblioteca.

| | |
|---|---|
| Quién decide el candado | `supabase.from("programs").select("id")` con el cliente **de la alumna**, o sea RLS. **Nunca** comparar `membership_tier` en JavaScript: daría una respuesta que puede no coincidir con la policy de la página siguiente |
| Qué muestra la vitrina | portada, título, descripción, cuántos días, nivel y foco |
| 🔴 Qué NO muestra | **el día por día.** Qué clase toca cada día es el trabajo que se paga. La consulta de `program_days` con `service_role` pide **solo** `recommended_min_level` y `category_slugs` — ni slug, ni id, ni título |
| El detalle | `/dashboard/programs/[slug]` ya no hace `notFound()` para quien no tiene el plan: muestra una página de venta. **Esa página no consulta `program_days`** |

Cubierto por 4 invariantes en `tests/sistema/plata-y-acceso.test.ts`, las cuatro
**probadas rompiendo el código a propósito**.

> ⚠️ Una de esas pruebas nació inútil y hay que saber por qué: comparaba con
> `` new RegExp(`${x}`) `` escrito con **una** barra. Dentro de un template
> literal `` es el carácter de retroceso, así que la regex buscaba un
> backspace y **no coincidía nunca** — pasaba siempre, incluso con el slug
> expuesto. Van dos barras.
>
> Y el límite de palabra tampoco es adorno: `category_slugs` contiene «slug», así
> que un `toContain("slug")` da rojo sobre código correcto. Misma familia que
> `'%tier_required%'` contra `membership_tier_required` (trampa 7).

#### Agregar una clase a un plan, desde la clase

Antes había que ir a `/admin/programs`, abrir el plan y buscar la clase en un
desplegable de todas. Ahora está en los dos lados:

- **Al subir** — bloque «Agregar a un plan de trabajo», dentro de *Solo para vos*.
- **Al editar** — `components/clase-en-planes.tsx`, que además **lista en qué
  planes ya está** y permite quitarla.

El día viene precompletado con el **primer hueco libre**, no con «el último más
uno»: un plan de 14 días al que le falta el 7 tiene que ofrecer el 7, o ese día
no se llena nunca.

**Dos cosas que no se pueden deshacer sin romperlo:**

1. **Una clase puede estar en VARIOS planes y varios días.** `program_days` tiene
   `unique (program_id, day_number)`, **no** una restricción por video. Lo único
   imposible es que un día tenga dos clases. Por eso el panel muestra una lista,
   no un solo selector.
2. **🔴 El id de QUITAR va en el `name`/`value` del botón, no en un `<input
   type="hidden">`.** El bloque se renderiza dentro del formulario de la clase;
   con un hidden por fila, las tres mandarían el mismo `name` y
   `formData.get()` devolvería siempre el primero — apretar QUITAR en el día 7
   borraría el día 1.

Las acciones son propias (`agregarClaseAPlanAction`, `quitarClaseDePlanAction`)
y **no** reusan `upsertProgramDayAction`: esa pide el *slug* de la clase y
termina redirigiendo a `/admin/programs`, que cerraría el panel abierto.

#### La ficha del plan, para la alumna

Tiene que contestar cuatro cosas, en este orden: **qué me toca hoy**, **por dónde
voy**, **cuánto me falta** y **qué viene después**. Antes contestaba solo la
última, y mal — los 14 días se veían todos iguales.

- El total son los **días cargados**, no `duration_days`. Un plan que promete 14
  y tiene 3 mostraba «0/3 días» al lado de un chip que decía «14 días»: las dos
  cifras ciertas y contradiciéndose. Para la alumna manda lo que existe.
- Tres estados por día: completado (✓), **hoy** (borde de marca) y futuro
  (apagado). **Los futuros se pueden abrir**, decidido el 2026-09-21: bloquearlos
  forzaría el orden pero castiga a la que quiere adelantar antes de un viaje.

#### Arrastre corregido

`app/dashboard/library/page.tsx` filtraba por plan con
`.eq("membership_tier_required", fPlan)` en SQL mientras el filtro en memoria ya
usaba `planes_permitidos`. SQL descartaba antes, así que filtrar por «Solista» no
encontraba una clase `{corps, solista}`. Ahora es `.contains()` en los dos lados.

### 🔵 `/admin/precios` — cómo funciona el aviso

Brunela edita **el importe que se anuncia** y **el price id de Stripe**, que son
dos datos separados que nadie ata entre sí. Al cargar la pantalla se le pregunta
a Stripe cuánto vale cada id y se muestra al lado.

**Avisa, no bloquea** — y es a propósito: hay un momento legítimo en que no
coinciden, que es mientras se está migrando de precio. Bloquear ahí la dejaría
trabada. Detecta importe distinto, moneda distinta, price **archivado**, price
**de otro modo** y price inexistente.

⚠️ `guardarPreciosDePlanesAction` **parte del catálogo existente** y pisa sólo los
campos del formulario. Reconstruirlo desde cero perdería `trial_days`, `currency`
y lo que se agregue después — en silencio, porque a un JSON al que le falta una
clave nada lo delata hasta que algo la busca.

⚠️ Y llama a `invalidarAjustes()`. Sin eso Brunela guarda, ve el cartel verde, y
la landing sigue mostrando el precio viejo hasta que la caché vence sola a los
5 minutos.

### ⏳ ÚLTIMO PASO — landing editable desde el panel

**Va DESPUÉS del rediseño de la landing**, por decisión explícita: hacerla
editable ahora y rediseñarla después es hacer el trabajo dos veces.

**Editable:**

- **FAQ** — agregar, editar, ordenar y borrar preguntas
- **Textos de presentación** — hero, «sobre mí», descripciones de sección
- **El video del tráiler**
- **Precios y packs** — ya en curso, ver arriba

**🔴 Deliberadamente NO editable:** estructura, secciones, colores, tipografía.
Si Brunela puede mover todo, rompe el diseño y no tiene cómo volver atrás. El
límite es *contenido sí, forma no*.

Hoy la landing tiene **todo hardcodeado** en `app/page.tsx` y `HomePage` **no es
async**: nunca leyó la base. El primer cambio que la vuelva dinámica —el de
precios— es el que abre ese camino; el resto se apoya en él.

### ✅ Datos de prueba borrados (2026-08-06)

La base quedó vacía de contenido inventado y **sin una sola fila huérfana**. El
detalle está arriba, en *Base de datos*.

**Tres cosas que costó descubrir y quedaron escritas en
`scripts/borrar-datos-de-prueba.sql`:**

1. **Dos claves foráneas `RESTRICT` frenan el borrado** — `pack_purchases →
   packs` y `program_days → videos`. Hay que borrar compras y días primero, o
   falla a mitad de camino.
2. **Borrar una cuenta NO borra sus DM.** `chat_rooms.participant_ids` es un
   `uuid[]`, no una clave foránea: no hay cascada, y la sala queda con un
   participante fantasma. Se borran por participante y no por nombre, porque los
   nombres llevan una raya larga (—) y un `like` con ese carácter depende de
   cómo lo pegue el editor.
3. **Los mensajes no eran de las cuentas de prueba**, sino de las reales. Borrar
   las cuentas no se los llevaba: había que borrar las salas.

⚠️ **El video con archivo en Bunny se borra desde `/admin/videos`, no por SQL**:
esa acción llama a `deleteBunnyVideo`. Por SQL quedaría el archivo huérfano
ocupando espacio y facturando.

### Bloqueantes para dar por cerrada la migración

- [ ] **Subir un video real** desde `/admin/videos` y reproducirlo. Valida Bunny,
      el worker de mux y el proxy de manifests de punta a punta. Es lo único de
      las 7 pruebas de corte que quedó sin hacer.
- [ ] **Checkout de prueba** con `4242 4242 4242 4242` contra la base nueva:
      confirmar que la suscripción se escribe y el tier se desbloquea.
- [x] ~~Decidir qué pasa con `dallapevincenzo@gmail.com`~~ — borrada el 2026-08-06.

### Antes de abrir al público

- [ ] **Desplegar `feat/rediseno-completo`.** Producción todavía muestra el
      diseño de mayo.
- [ ] **Verificar el reproductor en iPhone / iPad** — ver la sección de abajo. Es
      la única parte entregada sin medir, y el público de un producto de danza en
      casa usa iPhone.
- [x] ~~Pasar Stripe a producción~~ — **HECHO el 2026-08-06.**

      El sistema **cobra de verdad**. La cuenta quedó verificada
      (`charges_enabled` y `payouts_enabled` en true, sin requisitos
      pendientes), el webhook de live responde en
      `bruneladance.com/api/stripe/webhooks` con los 4 eventos que el código
      procesa, y los 6 price ids de producción cuadran con lo que se anuncia:
      16/154, 31/299, 59/559.

      ⚠️ **`.env.local` sigue en TEST y tiene que quedarse así.** Sólo Vercel
      pasó a live. Poner la clave de producción en local haría que
      `npm run dev` cobrase de verdad.
- [ ] **Rotar la `service_role`** por higiene (`SETUP.md`; el orden importa:
      crear la nueva, redeploy, verificar, recién ahí revocar la vieja).

### Después, con dos semanas de margen

- [ ] **Pausar el proyecto Supabase viejo** (pausar, NO borrar). Al hacerlo mueren
      de paso las dos cuentas `*.demo@brunela.local`, una de las cuales todavía
      es admin con contraseña conocida.
- [ ] **Sacar la URI de callback vieja** de Google Cloud Console. Recién al final.
- [ ] Borrar `_local/` (tiene hashes de contraseña de la migración; está en
      `.gitignore`).

### 🔴 La base de producción está en el plan Free

**El sistema cobra dinero real sobre una base sin copias de seguridad.** Eso es
lo que hay que saber; lo demás son consecuencias.

| | |
|---|---|
| **Sin copias** | Un borrado accidental **no se puede deshacer**. Pro trae copia diaria |
| **Se pausa a los 7 días** sin peticiones | Un proyecto pausado no da un error legible: la aplicación entera deja de responder hasta que alguien lo reactiva a mano |

Lo segundo está **parcheado** con un cron de Vercel (`/api/cron/keepalive`, todos
los días a las 07:00 UTC) que hace una consulta mínima. **Lo primero no tiene
parche**: o se paga Pro, o se saca un `pg_dump` a mano cada tanto.

> Con 0 alumnas era una decisión razonable. Con alumnas pagando, cada día que
> pasa sin copia es un día de datos que no se pueden recuperar.

### Deuda técnica conocida

- [ ] **Cerrar las tres funciones que le responden a `anon`** — `is_admin()`,
      `current_user_membership_tier()` y `can_start_dm()`. Ver *Decisiones
      conscientes*: se descartó a propósito el 2026-08-06 por riesgo contra
      beneficio cero. **Hacerlo con la app frenada y sin fecha encima.**

- [ ] **Migración de color**: ~304 ocurrencias de magenta hardcodeado en 24
      archivos. Unas 166 son tintes claros que ya tienen `--pink-wash`. El
      sidebar y el dashboard están migrados; el resto no.
- [x] **Plan de escalabilidad A–E** — hecho salvo B3. Detalle completo de qué
      se resuelve pagando y qué no: `docs/escalabilidad.md`.

      - **A** · guarda de orden del webhook: verificada, seguía intacta
      - **B** · chat: autor desnormalizado, N+1 eliminado, rate limit por
        trigger, degradación con gracia. **B3 (Broadcast) SIN HACER**
      - **C** · progreso en un viaje (RPC) + guardado cada 30 s en vez de 10
      - **D** · categoría en SQL con el índice GIN, paginación, DM fuera en SQL
      - **E** · `categories` cacheada; `site_settings` ya lo estaba

- [ ] **🔴 B3 · `postgres_changes` → Broadcast.** Es lo único del plan que
      queda, y lo único que no se arregla pagando: con `postgres_changes`
      Postgres evalúa RLS **una vez por conexión suscrita** en cada cambio.
      500 alumnas en una sala = 500 evaluaciones por mensaje.

      **No se hizo por riesgo, no por tiempo.** Broadcast mueve la
      autorización de las policies de la tabla a las de `realtime.messages`;
      un error ahí filtra mensajes entre salas o entre planes. Verificarlo
      pide dos sesiones autenticadas de planes distintos contra Supabase real,
      y no hay banco de pruebas para eso.

      **Mitigante:** el costo dominante era el N+1, que ya no está. Broadcast
      recién importa con **cientos** de personas conectadas a la vez.

- [ ] **Agregación en TypeScript: el techo son ~500 alumnas.** `/admin` usa
      `count exact` por métrica, y `/admin/analiticas` trae las filas crudas y
      agrega en memoria. Con ~30 ms de ida y vuelta a Fráncfort, **quince
      consultas son ~450 ms por carga**, y el panel de analíticas hace seis en
      paralelo más el progreso completo.

      Con menos de 500 alumnas traer las filas es **más rápido** que contar en
      SQL, y no necesita migración: por eso se hizo así. Por encima de eso hay
      que pasarlo a **funciones SQL** (`SECURITY DEFINER`, una por bloque) que
      devuelvan el resultado agregado. Eso **sí** es una migración.

      El cambio está acotado a propósito: toda la lectura vive en
      `src/features/admin/analitica/`, así que cambiar la fuente no toca
      ninguna pantalla. Ese aislamiento es también lo que permite que las
      métricas mejoren solas cuando `activity_events` acumule historia.
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
