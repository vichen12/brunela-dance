# CLAUDE.md

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
- Supabase SSR auth and Postgres
- Stripe webhook foundation

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

## Important folders

- `app/` route UI
- `components/` shared UI pieces
- `src/features/auth/` auth server actions and guards
- `src/features/admin/` admin actions and dictionaries
- `src/features/studio/` member studio helpers and server actions
- `src/lib/supabase/` Supabase server client
- `supabase/migrations/` schema and RLS source of truth

## Auth model

- Auth uses Supabase password sign-in.
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
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

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
3. `npm run build` before closing substantial changes

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

## Known next steps

- Add full onboarding/profile editing for members
- Connect Stripe checkout end-to-end
- Keep expanding the ES/EN/FR/IT public dictionary as new landing sections are added
- Polish dashboard visual system to match the final brand palette and assets
