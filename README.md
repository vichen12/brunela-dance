# Brunela Dance Trainer

Base scaffold for Phase C of Brunela Dance Trainer using Next.js App Router, Supabase SSR and Stripe webhooks.

## Stack

- Next.js App Router
- TypeScript strict
- Tailwind CSS
- Supabase SSR
- Stripe webhook endpoint

## Required environment variables

Copy `.env.example` to `.env.local` and complete:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Local setup

1. Run `npm install`
2. Run `npm run dev`
3. Open `http://localhost:3000`

## Auth and admin bootstrap

1. Create your user in Supabase Auth.
2. Execute `select public.bootstrap_admin_by_email('your-email@example.com');`
3. Sign in at `/sign-in`
4. Visit `/admin`

## Current scope

- Public landing page
- Supabase auth with password sign-in
- Protected dashboard
- Admin-only dashboard shell
- Stripe webhook audit and subscription sync skeleton
- Client-safe live session link access through RLS
