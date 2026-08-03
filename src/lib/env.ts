import { z } from "zod";

const optionalUrlSchema = z.string().url().optional();

const supabasePublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional()
});

const stripeServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1)
});

function resolveSupabasePublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * Validates the public Supabase env lazily so build-time module loading does not fail before Vercel envs are configured.
 */
export function getSupabasePublicEnv() {
  const parsed = supabasePublicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  const publicKey = parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!publicKey) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: "Missing Supabase publishable key",
        path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
      }
    ]);
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: parsed.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey
  };
}

export function getStripeServerEnv() {
  return stripeServerEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
  });
}

/**
 * La URL publica de la app. De aca sale el success_url del checkout de Stripe,
 * o sea a donde vuelve la alumna despues de pagar.
 *
 * POR QUE NO CAE DIRECTO A LOCALHOST
 *   Antes, si NEXT_PUBLIC_APP_URL faltaba, esto devolvia "http://localhost:3000"
 *   sin decir nada. En un deploy de Vercel eso significa que la alumna paga y
 *   Stripe la manda a SU PROPIA maquina, donde no hay nada escuchando. Cobrado
 *   el dinero, pantalla de error. Y como el fallback es silencioso, no hay
 *   ningun log que lo delate: parece que "el checkout no anda".
 *
 *   Corriendo en Vercel usamos el dominio que la propia plataforma expone. El
 *   fallback a localhost queda solo para desarrollo, que es donde tiene sentido.
 */
export function getAppUrl() {
  const explicito = optionalUrlSchema.parse(process.env.NEXT_PUBLIC_APP_URL);
  if (explicito) return explicito;

  // VERCEL_PROJECT_PRODUCTION_URL es el dominio de produccion; VERCEL_URL es el
  // de este deploy puntual (sirve para previews). Ninguna trae el esquema.
  const dominio = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (dominio) return `https://${dominio}`;

  return "http://localhost:3000";
}

const bunnyEnvSchema = z.object({
  BUNNY_STREAM_API_KEY: z.string().min(1),
  BUNNY_STREAM_LIBRARY_ID: z.string().min(1),
  // CDN hostname of the Bunny pull zone tied to the library, e.g. vz-xxxx.b-cdn.net
  BUNNY_STREAM_CDN_HOSTNAME: z.string().min(1)
});

/**
 * Validates Bunny Stream env lazily so the build does not fail before the
 * Bunny account is configured in Vercel.
 */
export function getBunnyStreamEnv() {
  return bunnyEnvSchema.parse({
    BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY,
    BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID,
    BUNNY_STREAM_CDN_HOSTNAME: process.env.BUNNY_STREAM_CDN_HOSTNAME
  });
}

export function hasBunnyStreamEnv() {
  return Boolean(
    process.env.BUNNY_STREAM_API_KEY &&
      process.env.BUNNY_STREAM_LIBRARY_ID &&
      process.env.BUNNY_STREAM_CDN_HOSTNAME
  );
}

/**
 * Token Authentication signing key for the video library's pull zone.
 *
 * Optional on purpose: when it is absent we emit unsigned URLs, which is what
 * local development wants before the Bunny account is fully configured. This
 * does not fail open in production -- if Token Authentication is enabled in
 * Bunny and this key is missing, Bunny rejects the unsigned URL and playback
 * breaks loudly instead of silently serving unprotected video.
 */
export function getBunnyTokenAuthKey(): string | null {
  const raw = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

export function hasSupabaseAuthEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && resolveSupabasePublicKey());
}

export function hasStripeServerEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET
  );
}
