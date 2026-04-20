# CLAUDE.md

## Project

Brunela Dance Trainer is a Next.js App Router project for a dance / pilates studio.
The app has two major surfaces:

- Public marketing landing at `/`
- Private member + admin system behind Supabase auth

Spanish is the primary language. English exists in data structures and copy scaffolding, but the main UX should feel Spanish-first.

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

## Known next steps

- Build the real video player UI instead of progress shortcut buttons
- Add full onboarding/profile editing for members
- Connect Stripe checkout end-to-end
- Add proper locale switching instead of visual language placeholders
- Polish dashboard visual system to match the final brand palette and assets
