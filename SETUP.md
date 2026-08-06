# Setup del sistema — Brunela Dance Trainer

Esta guía cubre los 3 servicios externos que el sistema necesita para funcionar
de punta a punta: **Supabase** (ya estaba), **Bunny Stream** (video) y
**Stripe** (pagos). La landing pública no requiere nada de esto.

---

## 1. Base de datos — aplicar la migración nueva

Hay una migración nueva que **arregla un bug** (faltaba la columna `audio_tracks`,
por eso fallaba guardar videos) y agrega los campos de Bunny + el catálogo de
precios mensual/anual.

Aplicala en Supabase (SQL Editor o CLI):

```
supabase/migrations/20260616_video_bunny_audio_tracks_and_pricing.sql
```

### 1.1 Orden de ejecución — ⚠️ NO es el alfabético

**Si alguna vez hay que reconstruir la base desde cero** (proyecto nuevo, cambio
de región, entorno de staging), las migraciones se corren **en este orden**, que
no es el que devuelve `ls`:

```
 1. 20260413_phase_a_core_schema.sql
 2. 20260413_phase_b0_membership_tier_none.sql      <-- SOLA, ejecucion aparte
 3. 20260413_phase_b_subscriptions_rewards_live.sql
 4. 20260413_phase_b1_live_session_link_access.sql  <-- DESPUES de la 3
 5. 20260421_chat_docs_categories_rls.sql
 6. 20260502_studio_announcements.sql
 7. 20260616_chat_dm_access_and_category_rooms.sql
 8. 20260616_video_bunny_audio_tracks_and_pricing.sql
 9. 20260728_rls_initplan_and_chat_indexes.sql
10. 20260729_audio_storage_and_mux_jobs.sql
11. 20260730_chat_studio_admin_lookup.sql
12. 20260730_pricing_update.sql
13. 20260730_stripe_price_ids_per_mode.sql
14. 20260730_stripe_webhook_event_ordering.sql
15. 20260801_access_granting_past_due.sql
16. 20260801_studio_owner_explicit.sql
17. 20260801_data_api_grants.sql                    <-- opera sobre "all
                                                        tables": necesita las
                                                        20 ya creadas
18. 20260801_authenticated_least_privilege.sql      <-- refina lo que otorga
                                                        la 17
19. 20260803_studio_documents_bucket.sql
20. 20260803_activity_events.sql            \
21. 20260803_marketing_consent.sql           |  independientes entre si,
22. 20260803_unify_pilates_categories.sql   /   en cualquier orden
23. 20260804_fix_default_privileges.sql     <-- DESPUES de la 20
24. 20260804_chat_autor_y_rate_limit.sql    \
25. 20260804_guardar_progreso_rpc.sql        |  independientes entre si
26. 20260804_chat_aislamiento_por_plan.sql  /
27. 20260805_invitaciones_a_sesiones.sql    <-- DESPUES de phase_b y phase_b1
28. 20260805_packs_de_clases.sql           <-- DESPUES de phase_a y de la 20260728
29. 20260806_documentos_y_progreso_por_plan.sql  <-- DESPUES de 20260421 y 20260728
```

> **La 28 hace lo mismo con `videos_select_allowed_by_tier`**, que nace en
> phase_a y se reescribe en la 20260728. Corrida antes de esas, los packs dejan
> de dar acceso sin ningun error: la alumna paga y no ve sus clases.
>
> **La 27 reemplaza cuerpos que vienen de phase_b y phase_b1** (el trigger de
> reservas y la funcion del enlace de Zoom). Correrla ANTES de ellas la deja
> pisada, y sin ningun error: el `create or replace` de phase_b ganaria, las
> invitaciones dejarian de abrir la reserva, y el unico sintoma seria una alumna
> invitada que no puede anotarse. Lo detecta `npm run test:aislamiento`.

> **La 23 corrige un error de la 17**, no de la 20. La 17 resetea el default de
> `anon` antes de otorgar, pero a `authenticated` sólo le hace un `grant`, que
> es **aditivo**: se suma al default de Supabase (`ALL`) en vez de
> reemplazarlo. Resultado: toda tabla creada después de la 18 nace con
> `TRUNCATE`, `REFERENCES` y `TRIGGER` para `authenticated`. Las 20 tablas
> viejas no están afectadas porque sobre ellas sí corrió un `revoke all`.
> **Si algún día se reconstruye la base desde cero, la 23 sigue siendo
> necesaria.**

> **De la 19 en adelante el orden entre ellas da igual**, pero todas van
> **después de la 18**, y no por costumbre: la 18 termina con un
> `alter default privileges ... revoke insert, update, delete`, así que toda
> tabla creada después nace **sin permiso de escritura** para `authenticated`.
> Por eso `20260803_activity_events.sql` trae su propio `grant` al final. Si se
> corriera antes de la 18, ese grant se perdería y el registro de actividad
> fallaría con `42501` sin que se note en pantalla.

> Las dos del **2026-08-01** existen porque dos reglas de negocio vivían sólo
> como ediciones manuales en la base y se habrían perdido al reconstruir desde
> el repo: el período de gracia de `past_due`, y quién es la dueña del estudio.
> Ninguna de las dos daba error al faltar — ver § 4.2.

**Las dos trampas del orden alfabético:**

- **`phase_b1` va DESPUÉS de `phase_b`, no antes.** Ordenado por nombre,
  `phase_b1_...` cae antes que `phase_b_...` porque `'1'` (0x31) es menor que
  `'_'` (0x5F). Pero `b1` usa `public.live_sessions` y
  `public.live_session_access_links`, que **se crean** en
  `phase_b_subscriptions_rewards_live`. En orden alfabético, falla con tabla
  inexistente.

- **`phase_b0` se corre sola.** Es un `alter type ... add value 'none'` sobre el
  enum `membership_tier`. El propio archivo lo dice en su encabezado: *"run this
  as a standalone statement before Phase B"*. No pegarla a otra migración en la
  misma ejecución.

Los pares que comparten fecha (`20260616_chat_...` / `20260616_video_...`, y los
cuatro `20260730_...`) sí son independientes entre sí, salvo que
`pricing_update` (12) va antes que `stripe_price_ids_per_mode` (13): la 12
parchea importes y la 13 reescribe los ids de precio sin tocar importes.

> **Nota:** existía un `20260413_phase_b0_membership_tier_rebuild.sql` de 30
> bytes que contenía una URL, no SQL — se guardó por accidente. Borrado el
> 2026-08-01. Si aparece en un checkout viejo, no correrlo.

---

## 2. Bunny Stream (video con multi-audio)

1. Crear cuenta en https://bunny.net
2. Ir a **Stream** y crear un **Video Library**.
3. Anotar:
   - **Library ID** (número que aparece en la URL / settings de la library).
   - **API Key** de la library (Stream > tu library > **API**).
   - **CDN Hostname** del pull zone de la library (algo como `vz-xxxxxxxx.b-cdn.net`).
4. Cargar esas 3 variables de entorno (en Vercel y en `.env.local`):

```
BUNNY_STREAM_API_KEY=...
BUNNY_STREAM_LIBRARY_ID=...
BUNNY_STREAM_CDN_HOSTNAME=vz-xxxxxxxx.b-cdn.net
```

Con eso, en `/admin/videos` el bloque **"Nuevo video"** te deja subir el archivo
de video + un archivo de audio por idioma (ES / EN / PT). El sistema:
- sube el video a Bunny,
- adjunta cada audio como pista adicional del mismo stream,
- y la alumna puede cambiar de idioma en el reproductor **sin recargar**.

> Nota sobre el endpoint de pistas de audio: la integración usa la API de Bunny
> para adjuntar audios extra. Si Bunny cambia la ruta exacta, está aislada en
> `src/lib/video/bunny.ts` (función `addBunnyAudioTrack`) — es el único lugar a tocar.

---

## 3. Stripe (suscripciones)

### 3.1 Crear los productos y precios

En el dashboard de Stripe (**Test mode** primero), creá **3 productos**, y dentro
de cada uno **2 precios recurrentes** (mensual y anual). En total: **6 precios**.

| Producto | Precio mensual | Precio anual |
|---|---|---|
| **Corps de Ballet** | 16,00 € / month | 154,00 € / year |
| **Solista** | 31,00 € / month | 299,00 € / year |
| **Principal** | 59,00 € / month | 559,00 € / year |

Para cada precio:
- Moneda: **EUR**
- Tipo: **Recurring**
- Intervalo: **Monthly** o **Yearly** según corresponda
- (El período de prueba de 7 días lo aplica el sistema automáticamente en el
  checkout — **no** lo configures en el precio.)

Copiá los 6 **Price IDs** (empiezan con `price_...`).

### 3.2 Cargar los Price IDs en el sistema

Los Price IDs viven en `site_settings` (clave `subscriptions.catalog`) para que
puedas cambiarlos sin redeploy. Corré este SQL en Supabase reemplazando los
`price_...` por los tuyos:

El catalogo guarda **dos juegos** de Price IDs, uno por modo de Stripe:

```json
"prices": {
  "test": { "monthly": "price_...", "yearly": "price_..." },
  "live": { "monthly": "price_...", "yearly": "price_..." }
}
```

El codigo elige el juego segun `STRIPE_SECRET_KEY`: si empieza con `sk_live_`
usa `live`, en cualquier otro caso usa `test`. **Pasar a produccion es cambiar
esa sola variable de entorno** — no hay ningun SQL que correr en el pase, y por
lo tanto no hay mitad que quede sin hacer.

Los doce ids ya cargados estan en
`supabase/migrations/20260730_stripe_price_ids_per_mode.sql`. Para reemplazar
alguno mas adelante, este SQL escribe **solo** los Price IDs de un modo y deja
los importes y el otro modo como estan:

```sql
-- Cambiar 'test' por 'live' segun el modo que quieras tocar.
update public.site_settings s
set value = jsonb_set(
      s.value,
      '{tiers}',
      (
        select jsonb_agg(
                 case t->>'tier'
                   when 'corps_de_ballet' then jsonb_set(t, '{prices,test}', jsonb_build_object(
                     'monthly', 'price_XXXX_corps_mensual',
                     'yearly',  'price_XXXX_corps_anual'))
                   when 'solista' then jsonb_set(t, '{prices,test}', jsonb_build_object(
                     'monthly', 'price_XXXX_solista_mensual',
                     'yearly',  'price_XXXX_solista_anual'))
                   when 'principal' then jsonb_set(t, '{prices,test}', jsonb_build_object(
                     'monthly', 'price_XXXX_principal_mensual',
                     'yearly',  'price_XXXX_principal_anual'))
                   else t
                 end
                 order by (t->>'display_order')::int
               )
        from jsonb_array_elements(s.value -> 'tiers') t
      )
    ),
    updated_at = timezone('utc', now())
where s.setting_key = 'subscriptions.catalog';
```

Verificacion (3 filas, importes y los dos juegos de ids):

```sql
select t->>'tier' as tier,
       t->>'amount_monthly' as mensual,
       t->>'amount_yearly'  as anual,
       t #>> '{prices,test,monthly}' as test_mensual,
       t #>> '{prices,test,yearly}'  as test_anual,
       t #>> '{prices,live,monthly}' as live_mensual,
       t #>> '{prices,live,yearly}'  as live_anual
from public.site_settings s,
     jsonb_array_elements(s.value->'tiers') t
where s.setting_key = 'subscriptions.catalog'
order by (t->>'display_order')::int;
```

### 3.3 Variables de entorno + webhook

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Configurá el webhook en Stripe apuntando a:

```
https://TU-DOMINIO-DEL-SISTEMA/api/stripe/webhooks
```

Eventos a escuchar:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

> El webhook ya estaba implementado; sincroniza la suscripción a Supabase y, por
> trigger, actualiza el `membership_tier` del perfil → desbloquea el contenido.

### 3.4 Flujo completo

Landing → `/sign-in` → `/dashboard/plan` → botón de plan → Stripe Checkout
(7 días gratis) → webhook → tier desbloqueado. Para cancelar/cambiar: botón
**"Gestionar plan"** → Stripe Billing Portal.

### 3.5 Pase a produccion — lista de control

**Estado al 2026-08-06: todo preparado salvo la verificacion de la cuenta de
Brunela en Stripe.** El dia del pase quedan DOS variables y un redeploy.

Modo test y modo produccion son **dos mundos separados** en Stripe. Cada objeto
existe por duplicado y nada se copia solo -- salvo lo que dice la nota del final,
que es la excepcion y conviene no confundirla.

#### Ya hecho (no volver a tocar)

- [x] **Los 6 price ids de produccion**, cargados en `prices.live` y
      **verificados uno por uno contra la API**: importe, moneda, intervalo,
      activos y del modo correcto.

      corps 16 / 154 · solista 31 / 299 · principal 59 / 559

      Se revisan cuando se quiera con:

      ```bash
      node --env-file=.env.local scripts/verificar-precios-live.mjs
      ```

      Sale con codigo 1 si algo no cuadra, asi sirve de compuerta. Este control
      fue el que detecto, en TEST, un price cargado como 599 en vez de 559 y
      ademas archivado. Del lado live ese error son 40 EUR de mas por año a cada
      suscriptora, cobrados de verdad.

- [x] **Webhook de produccion** en `https://bruneladance.com/api/stripe/webhooks`.

      Los 4 que el codigo procesa -- y sin estos no hay acceso despues de pagar:
      `customer.subscription.created`, `.updated`, `.deleted` y
      **`checkout.session.completed`** (packs).

      Los otros 3 (`invoice.paid`, `invoice.payment_failed`,
      `customer.subscription.trial_will_end`) no los lee nadie hoy: quedan de
      rastro en `subscription_webhook_events` para las analiticas de ingresos.

- [x] **Portal de clientes en produccion.** Es un objeto **aparte** del de test
      -- comprobado por API: dos `bpc_...` distintos, uno con `livemode: false` y
      otro con `true`, y hasta con distinto prorrateo.

      Configurado con los 6 precios, prorrateo, **cancelacion `at_period_end`** y
      codigos promocionales.

      ⚠️ La `at_period_end` no es cosmetica: el webhook tiene una guarda que
      depende de que cancelar deje `status = active` con `cancel_at_period_end`.
      Con *immediately*, quien se arrepiente pierde el acceso que ya pago.

      ⚠️ **La lista de productos NO se puede verificar por API**: el campo no
      viene en la respuesta. Se comprueba abriendo la vista previa del portal y
      confirmando que aparecen los planes con su importe real y no el marcador de
      posicion.

- [x] **`NEXT_PUBLIC_APP_URL`** en `https://bruneladance.com`, y **Supabase →
      Authentication** con el dominio nuevo en *Site URL* y *Redirect URLs*. Sin
      eso el login con Google no vuelve: usa `window.location.origin`.

      Google Cloud Console **no se toca**: esa URI apunta al proyecto de
      Supabase, no al dominio.

- [x] **`STRIPE_SECRET_KEY_LIVE`** y **`STRIPE_WEBHOOK_SECRET_LIVE`** cargadas en
      Vercel, en variables APARTE.

      Con `STRIPE_SECRET_KEY` todavia en test, **el sistema no cobra nada de
      verdad**. La primera solo la lee `src/lib/stripe/verificar-precio.ts`, que
      unicamente hace `prices.retrieve`; a la segunda **no la lee nadie**, es un
      estacionamiento. Hay pruebas en `tests/sistema/` que fallan si alguna
      aparece en una ruta de cobro.

      El efecto util: `/admin/precios` verifica los precios de produccion
      **sin** estar en produccion.

#### El dia del pase — dos variables y un redeploy

1. `STRIPE_SECRET_KEY` ← el valor de `STRIPE_SECRET_KEY_LIVE`
2. `STRIPE_WEBHOOK_SECRET` ← el valor de `STRIPE_WEBHOOK_SECRET_LIVE`
3. **Un** redeploy (Vercel no aplica variables en caliente)

⚠️ **Las dos juntas, en el mismo redeploy.** Es la misma regla que `vercel.json`
y la region de Supabase. Cambiar solo la clave deja cobros reales sin endpoint
que avise: **se cobra y no llega el acceso**. Cambiar solo el webhook rompe la
firma de los eventos de prueba. Como Vercel no aplica nada hasta el redeploy,
cambiar las dos y redesplegar una vez es atomico.

#### Verificar despues, sin gastar plata

Las tarjetas de prueba **no funcionan en produccion**. El camino gratis:

1. En Stripe live, cupon del **100%** con un codigo de **un solo uso**.
2. Suscribirse con ese codigo → total 0 EUR, se crea la suscripcion, se dispara
   `customer.subscription.created`. Comprobar que el plan se desbloquea.
3. Comprar un pack con el mismo codigo.

   ⚠️ Con total 0, Stripe pone `payment_status = "no_payment_required"` y **no**
   `"paid"`. El webhook acepta los dos desde el 2026-08-06; antes ese caso
   completaba el checkout y no daba nada.
4. Comprobar en la base:

   ```sql
   select p.email, s.membership_tier, s.status, s.provider_price_id
     from public.subscriptions s join public.profiles p on p.id = s.user_id
    order by s.created_at desc limit 3;

   select pack_id, amount_total_cents, purchased_at
     from public.pack_purchases order by purchased_at desc limit 3;
   ```

   `provider_price_id` tiene que ser uno de **live**. En `amount_total_cents` va
   a haber **0**: es correcto, es el cupon.
5. **Archivar el codigo.**
6. Cancelar desde el portal, que de paso lo prueba.

Sin tocar nada: en el endpoint de live, *Send test webhook* con
`checkout.session.completed`. Va a contestar un motivo legible (le falta
metadata), y eso ya confirma que **la firma valida y la URL llega**, que es lo
que mas se rompe.

> **Que NO hay que rehacer en produccion.** La *recuperacion de ingresos*
> (reintentos de cobro y que hacer al agotarlos) y los *correos a clientes*
> son **compartidos entre modo test y modo produccion**: se configuran una sola
> vez y valen para los dos. De hecho no se pueden editar desde el modo de
> prueba. Ya quedaron configurados el 2026-07-30:
>
> - reintentos inteligentes, 14 dias, y al agotarlos **cancelar la suscripcion**
> - correos de pago fallido y de tarjeta por caducar, hacia la pagina alojada
>   por Stripe
>
> Esa opcion de "al agotar los reintentos" es critica y conviene revisarla
> antes del lanzamiento aunque no haya que tocarla: el sistema da acceso
> durante `past_due` como periodo de gracia, asi que si Stripe dejara la
> suscripcion en `past_due` para siempre ("no hacer nada"), esa alumna
> conservaria el acceso **gratis e indefinidamente**. El corte depende de que
> Stripe mueva el estado a `canceled` o `unpaid`, que no otorgan acceso.
>
> ⚠️ **Esto se confundio el 2026-08-06** y estuvo a punto de meterse trabajo de
> mas en la lista del pase. La distincion correcta, y la unica que hay que
> recordar, es:
>
> | Compartido entre modos | Por modo, hay que rehacer |
> |---|---|
> | Recuperacion de ingresos | Productos y precios |
> | Correos a clientes | Cupones y codigos promocionales |
> | Marca, datos del negocio | Endpoints de webhook |
> | | **Portal de clientes** |
>
> Y el test que lo zanja en diez segundos, para cualquier ajuste que se dude:
> abrir la pantalla en modo prueba y cambiar el interruptor a produccion. Si el
> valor cambia, es por modo. Si no se puede ni editar desde prueba, es
> compartido.


> **Si se cambia `access_granting_statuses` con gente ya suscripta**, el trigger
> solo recalcula el `membership_tier` cuando la suscripcion cambia. Para
> aplicarlo a las filas existentes hay que forzar una escritura:
> `update public.subscriptions set user_id = user_id;`

---

## 4. Regiones de la infraestructura

### 4.1 Dónde corre cada cosa hoy

| Pieza | Región | Cómo se verifica |
|---|---|---|
| Supabase (`howtuhfdxgyluskrlkze`) | `eu-central-1` — Fráncfort | Panel de Supabase → Settings → General |
| Vercel (funciones) | `fra1` — Fráncfort | ver abajo |
| Bunny Stream | CDN global | no aplica |

`fra1` **es** `eu-central-1`: las funciones quedan en el mismo centro de datos
que la base. Está fijado en `vercel.json`:

```json
{ "regions": ["fra1"] }
```

**El emparejamiento es lo que importa, no la ciudad.** Tener las dos piezas
juntas ahorra ~160 ms por navegación; elegir entre Fráncfort, París o Dublín son
~10 ms. Por eso `vercel.json` y la región de Supabase se cambian **siempre en el
mismo deploy**: separarlas deja las funciones a un océano de la base.

Historia: hasta el 2026-08-01 las funciones corrían en `iad1` (Virginia) con la
base en Oregón — cada consulta cruzaba Estados Unidos, ~65 ms de ida y vuelta,
y las pantallas privadas encadenan 2 o 3. Se pasó por `pdx1` (Oregón, junto a la
base vieja) y de ahí a `fra1` con la mudanza a Europa.

**Cómo confirmar en qué región corre de verdad** (no confiar en el panel, mirar
la respuesta):

```bash
curl -sI https://bruneladance.com/sign-in | grep -i x-vercel-id
# x-vercel-id: gru1::fra1::xxxxx
#              |      `-- región donde CORRIÓ la función  <- esto es lo que importa
#              `--------- borde por donde ENTRÓ el request (varía según desde dónde mires)
```

Hay que pedir una ruta dinámica como `/sign-in`. La landing `/` sale de caché de
borde y no muestra región de función.

> En el plan Hobby la elección de región puede estar restringida. Si el header
> sigue diciendo `iad1` después de un deploy, el plan no la está respetando y hay
> que mirarlo en *Settings → Functions → Function Region*.

**Nota sobre el proyecto de Vercel.** El proyecto real es **`brunela-dance`**
(`prj_MpWybl3x3mSHcg4a9rnxzdtgKfu5`). El `.vercel/project.json` local apuntaba a
un proyecto inexistente y el deploy por CLI fallaba; quedó corregido el
2026-08-01. Si alguna vez se clona el repo de cero, hay que correr `vercel link`
y elegir `brunela-dance` (el `.vercel/` está en `.gitignore`, no viaja con el
repo).

### 4.2 Migración a Europa — plan de ejecución

**Decidido el 2026-08-01: se hace.** Destino **`eu-central-1` (Fráncfort)** en
Supabase, emparejado con **`fra1`** en Vercel.

**Por qué se hace.** No por velocidad, por **residencia de datos**: el negocio es
español y las alumnas son residentes de la UE. La base guarda nombres, correos,
referencias de pago y los mensajes del chat, que son comunicaciones personales.
La velocidad es un beneficio secundario (~210 ms → ~70 ms por navegación desde
Barcelona).

**Por qué Fráncfort y no Irlanda.** Barcelona está ~10-15 ms más cerca de
Fráncfort, y `fra1` de Vercel está en esa misma región. Irlanda cumple igual el
argumento legal, pero está más lejos y no aporta nada a cambio. París
(`eu-west-3` + `cdg1`) es geográficamente lo más cercano (~8 ms mejor que
Fráncfort) y se descartó por criterio: no se cambia infraestructura probada por
8 ms.

> Los números de latencia desde Barcelona son **estimados de topología de red,
> no medidos** — no se pudo medir desde España. Lo que sí está medido es que
> emparejar Vercel y Supabase en la misma región ahorra ~160 ms; la elección de
> ciudad son ~10 ms. **El emparejamiento importa 10 veces más que la ciudad.**

#### Lo que hay que entender antes de empezar

**Supabase no cambia de región en el lugar.** Migrar significa crear un proyecto
nuevo, y un proyecto nuevo tiene **ref nuevo, URL nueva y claves nuevas**. Todo
lo que hoy apunta a `ymshzzughzayhidfpyrs` deja de servir.

#### Qué viaja y qué no

| Cosa | ¿Se mueve solo? |
|---|---|
| Esquema: tablas, RLS, funciones, triggers | **Se recrea corriendo las migraciones** (§ 1.1), no restaurando un volcado. El repo es la fuente de verdad y está versionado entero. |
| Datos de `public.*` | Con copia de tablas, respetando el orden de las FK. |
| `auth.users` **incluida la contraseña** | Sí, copiando la tabla con `encrypted_password`. Nadie tiene que resetear nada. |
| `auth.identities` | Sí, y **es obligatorio**. Ver la advertencia de abajo. |
| Sesiones abiertas | **No.** El proyecto nuevo tiene otro JWT secret: todas las sesiones se cortan y cada alumna vuelve a entrar una vez, con su misma contraseña. |
| Archivos de Storage (bucket `class-audio`) | **NO.** Las filas de `storage.objects` son metadatos; los archivos hay que bajarlos y volver a subirlos. |
| Configuración de Auth (proveedor Google, Site URL, Redirect URLs) | **No.** Es config de panel, se rehace a mano. |
| Realtime del chat | Lo cubre la migración 5 (§ 1.1), pero **se verifica igual**. |

#### 🔴 Las tres trampas silenciosas

Ninguna de las tres da error. Las tres se ven como "funcionó".

**1. `auth.identities` — el perfil de admin huérfano.**

`auth.identities` es la fila que vincula la cuenta de Google con el usuario de
Supabase. Si se copia `auth.users` pero **no** `auth.identities`, cuando Brunela
entre con Google no hay identidad que matchear: Supabase **crea un usuario nuevo,
con otro UUID**, y dispara el trigger que le crea un perfil nuevo con
`is_admin = false`.

Resultado: el login *funciona*. Entra sin errores. Pero es otra persona para la
base — su perfil de admin, su progreso y sus mensajes quedan colgando de un UUID
que ya nadie usa, y `get_studio_admin()` puede empezar a devolver la cuenta
equivocada. **Copiar `auth.identities` junto con `auth.users`, siempre.**

**2. `supabase_realtime` sin `chat_messages` — el chat que no se actualiza.**

Lo agrega la migración 5, en un bloque guardado por
`if not exists (... pg_publication_tables ...)`. Esa guarda es justamente lo que
lo vuelve silencioso: si la publicación `supabase_realtime` no existiera en el
proyecto nuevo, el bloque **no falla, no hace nada**.

Síntoma: los mensajes se envían y se guardan bien, pero no aparecen del otro lado
hasta recargar la página. Nadie reporta un error porque no hay ninguno.

**3. `vercel.json` y la region de Supabase separadas — peor que no migrar.**

Si se cambian las variables de entorno y se olvida la región, quedan las
funciones en Oregón y la base en Alemania: **~160 ms por consulta**, peor que
antes de empezar. Por eso los dos cambios van **en el mismo commit y el mismo
deploy** (paso 8).

#### Qué NO se rompe (suele asustar de más)

- **Bunny.** Nada de Bunny apunta a Supabase. `bunny_video_id` y `audio_tracks`
  son columnas de texto y viajan con los datos. La clave de firma
  (`BUNNY_STREAM_TOKEN_AUTH_KEY`) es variable de entorno de Next. Los videos ni
  se tocan.
- **Stripe.** Ningún objeto de Stripe apunta a Supabase. El webhook apunta al
  dominio de Vercel, que no cambia. `stripe_customer_id` y
  `stripe_subscription_id` son texto y viajan con los datos. **No hay que rehacer
  nada en Stripe.** El único riesgo es la ventana: un webhook que llegue durante
  la migración escribe en la base vieja y se pierde en silencio. Se evita
  haciendo que `/api/stripe/webhooks` devuelva **500** mientras dure — Stripe
  reintenta hasta 3 días.
- **El dominio.** La URL de Supabase vive únicamente en variables de entorno. No
  hay DNS que tocar.

---

### 4.3 Los 10 pasos

#### Paso 0 — Fotografía del proyecto viejo

**El método: no verificar contra números recordados, verificar contra el proyecto
viejo.** Correr esto en el SQL Editor del proyecto **actual** y guardar la salida
en un archivo. El diff contra el proyecto nuevo es la verificación real.

```sql
-- A. policies por esquema
select schemaname, count(*) from pg_policies
where schemaname in ('public','storage') group by schemaname order by 1;

-- B. inventario de policies (esto es el diff de verdad)
select schemaname, tablename, policyname from pg_policies
where schemaname in ('public','storage') order by 1,2,3;

-- C. tablas
select table_name from information_schema.tables
where table_schema='public' and table_type='BASE TABLE' order by 1;

-- D. funciones
select routine_name, security_type from information_schema.routines
where routine_schema='public' order by 1;

-- E. los ajustes que NO estan (o no estaban) en migraciones
select setting_key, value from public.site_settings
where setting_key in ('subscriptions.access_defaults','subscriptions.catalog');

-- F. realtime
select schemaname, tablename from pg_publication_tables
where pubname='supabase_realtime';

-- G. cuanto dato real hay
select 'profiles' t, count(*) from public.profiles
union all select 'videos', count(*) from public.videos
union all select 'subscriptions', count(*) from public.subscriptions
union all select 'user_progress', count(*) from public.user_progress
union all select 'chat_messages', count(*) from public.chat_messages
union all select 'auth.users', count(*) from auth.users
union all select 'auth.identities', count(*) from auth.identities;
```

#### Paso 1 — Crear el proyecto nuevo

Supabase → New project → región **`eu-central-1` (Frankfurt)**, misma
organización. Anotar el `ref` nuevo y guardar las 3 claves: URL, publishable key,
service role key.

#### Paso 2 — Esquema

**a)** Las 29 migraciones **en el orden de § 1.1** — que no es el alfabético.
Las **17 y 18 van al final sin excepción**: usan `grant ... on all tables in
schema public`, que sólo alcanza a las tablas que ya existen, y la 18 refina lo
que otorga la 17.

**b)** Verificar que `20260801_access_granting_past_due.sql` (la 15) haya
quedado aplicada. Esa migración existe precisamente porque el período de gracia
era una edición manual que se habría perdido en la reconstrucción.

#### Paso 3 — Auth: proveedores y URLs

En el panel del proyecto **nuevo**:

- *Authentication → Providers → Google*: pegar el **mismo** Client ID y Client
  Secret que se usan hoy.
- *Authentication → URL Configuration*: Site URL y Redirect URLs
  (`https://bruneladance.com/**`, `https://brunela-dance.vercel.app/**` para las
  vistas previa de Vercel, y `http://localhost:3000/**`).

#### 🔴 Paso 4 — Google Cloud Console (esto es lo que rompe el login)

**El `ref` del proyecto está dentro de la URL de callback de Google.**

El flujo es: `signInWithOAuth` → Google →
**`https://<REF>.supabase.co/auth/v1/callback`** → `/auth/callback` de la app.
Ese `<REF>` cambia con el proyecto.

Google Cloud Console → *APIs y servicios → Credenciales → cliente OAuth 2.0 →
URIs de redireccionamiento autorizados* → **agregar**:

```
https://<REF_NUEVO>.supabase.co/auth/v1/callback
```

**Agregar, no reemplazar** — dejar también el viejo hasta confirmar la migración.
Si falta, el botón de Google devuelve `redirect_uri_mismatch` y no entra nadie.

#### Paso 5 — Abrir la ventana

Poner la app en mantenimiento y hacer que `/api/stripe/webhooks` devuelva 500,
para que Stripe reintente en vez de perder eventos.

> Al 2026-08-01 hay 0 suscripciones activas, así que este paso es formalidad.
> Queda escrito porque deja de serlo después del primer cobro.

#### Paso 6 — Datos (arranque limpio)

**Decisión del 2026-08-01: camino limpio.** Se copian **sólo los 3 usuarios
reales y el contenido real**. Las 18 clases demo con fotos de picsum y las
cuentas `*.demo@brunela.local` **no se copian** — la data demo ya cumplió su
función y no migrarla salda de paso la limpieza que estaba pendiente.

Orden obligatorio:

1. **`auth.users`** — preservando `id` y `encrypted_password`. Preservar el UUID
   no es opcional: `profiles.id` referencia `auth.users(id)` y `user_progress`
   cuelga de ahí.
2. **`auth.identities`** — 🔴 **trampa 1.** Sin esto el login con Google crea un
   usuario nuevo y deja el perfil de admin huérfano, sin dar ningún error.
   **Copiar por `user_id`, no una fila por usuario:** el proyecto viejo tiene
   **6 identidades para 5 usuarios**, así que alguna cuenta tiene dos métodos de
   login (correo + Google) y una copia "una por cabeza" perdería uno.
3. **`public.*`** respetando FKs: `profiles` → `categories` → `videos` →
   `programs` → `program_days` → el resto.
4. **`site_settings` NO se copia.** Ya viene de las migraciones 12, 13 y 15.
   Copiarlo encima pisaría el catálogo bueno con el viejo.
5. **Marcar a Brunela como dueña del estudio** (migración 16):

   ```sql
   update public.profiles
      set is_admin = true, is_studio_owner = true, membership_tier = 'principal'
    where email = 'brunela.dance@gmail.com';
   ```

   Corre directo: `auth.uid()` es null en el SQL Editor y el trigger
   `trg_profiles_protect_admin_fields` lleva la guarda `auth.uid() is not null`,
   así que no interviene.

   Conviene además **crear su cuenta primero**, para que el `created_at` deje
   correcto también el camino de fallback de `get_studio_admin()`.

#### Paso 7 — Storage

Bajar y volver a subir el bucket `class-audio`. Las filas de `storage.objects`
son metadatos: **los archivos no viajan con el SQL**. El bucket y sus policies sí
los crea la migración 10.

#### 🔴 Paso 8 — Variables + `vercel.json`, EN EL MISMO DEPLOY

**Trampa 3.** Las dos cosas juntas, un solo deploy.

```json
{ "regions": ["fra1"] }
```

Y las 3 claves nuevas en **tres lugares**:

| Dónde | Qué |
|---|---|
| Vercel (Production **y** Preview) | las 3 claves nuevas |
| `.env.local` de desarrollo | las 3 claves nuevas |
| `.env` del worker de mux | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |

#### Paso 9 — Cerrar la ventana

Quitar el mantenimiento, restaurar el webhook, y reenviar desde Stripe los
eventos del rato (`stripe events resend <id>` o el botón de reintento).

#### Paso 10 — Proyecto viejo: pausado, NO borrado

Dos semanas como mínimo. Es la única vuelta atrás.

---

### 4.4 Verificaciones

Correr cada una en el proyecto **nuevo** y comparar contra la salida del Paso 0.

```sql
-- 1. POLICIES -> mismo numero que el paso 0.A
select schemaname, count(*) from pg_policies
where schemaname in ('public','storage') group by schemaname order by 1;

-- 1b. si no coincide, cual falta (esto es lo que realmente sirve)
select schemaname, tablename, policyname from pg_policies
where schemaname in ('public','storage') order by 1,2,3;

-- 2. TABLAS -> diff contra paso 0.C
select table_name from information_schema.tables
where table_schema='public' and table_type='BASE TABLE' order by 1;

-- 3. RLS ACTIVA EN TODAS -> tiene que devolver CERO FILAS.
--    Una tabla sin RLS es una fuga de datos, no un detalle.
select relname from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- 4. get_studio_admin -> devuelve a Brunela, y anon NO puede ejecutarla
select * from public.get_studio_admin();
select grantee, privilege_type from information_schema.routine_privileges
where routine_name='get_studio_admin';
--    esperado: authenticated/EXECUTE presente, anon AUSENTE

-- 5. CATALOGO: los 12 price ids -> tiene que dar 12
select count(*) as ids_cargados
from public.site_settings s,
     jsonb_array_elements(s.value->'tiers') t,
     lateral (values (t->'prices'->'test'->>'monthly'),
                     (t->'prices'->'test'->>'yearly'),
                     (t->'prices'->'live'->>'monthly'),
                     (t->'prices'->'live'->>'yearly')) v(id)
where s.setting_key='subscriptions.catalog' and v.id is not null;

-- 5b. importes -> 16/154, 31/299, 59/559
select t->>'tier', t->>'amount_monthly', t->>'amount_yearly'
from public.site_settings s, jsonb_array_elements(s.value->'tiers') t
where s.setting_key='subscriptions.catalog'
order by (t->>'display_order')::int;

-- 6. PERIODO DE GRACIA -> ["trialing", "active", "past_due"]
select value->'access_granting_statuses'
from public.site_settings where setting_key='subscriptions.access_defaults';

-- 7. BUCKET class-audio -> privado, 52428800, 4 mime types
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='class-audio';

-- 8. REALTIME -> chat_messages TIENE que aparecer  (trampa 2)
select schemaname, tablename from pg_publication_tables
where pubname='supabase_realtime';

-- 9. TRIGGER de creacion de perfiles -> 1 fila
select tgname from pg_trigger where tgname='on_auth_user_created';

-- 10. IDENTIDADES -> mismo conteo que el paso 0.G  (trampa 1)
select count(*) from auth.identities;
```

**Y las pruebas a mano, en este orden** — cada una depende de la anterior:

1. **Login con Google** → entra y cae en `/dashboard`. Si falla, es el Paso 4.
2. **Que sea el MISMO usuario** → entrando como Brunela, el panel de admin tiene
   que estar accesible. Si entra pero no es admin, es la **trampa 1**: se creó un
   usuario nuevo.
3. **Chat en vivo** → abrir el chat en dos navegadores; el mensaje tiene que
   aparecer **sin recargar**. Si se guarda pero no aparece, es la **trampa 2**.
4. **Reproducir una clase** con cambio de idioma → valida Bunny + el proxy de
   manifests.
5. **Checkout de prueba** con `4242 4242 4242 4242` → valida Stripe + webhook +
   desbloqueo del tier.
6. **La región**, que es el motivo de todo esto:

```bash
curl -sI https://bruneladance.com/sign-in | grep -i x-vercel-id
# esperado: xxx1::fra1::...   <- el SEGUNDO segmento tiene que decir fra1
```
