"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Baneo desde la vista de comunidad.
 *
 * POR QUE ES UNA SERVER ACTION Y NO UNA ESCRITURA DESDE EL CLIENTE
 *   Mutear se hace desde el cliente (chat-room.tsx) porque la migracion 18 le
 *   dejo INSERT/UPDATE sobre chat_mutes a `authenticated`. chat_bans NO: quedo
 *   de solo lectura, asi que la misma escritura desde el navegador devolveria
 *   42501.
 *
 *   La salida facil habria sido ampliar el grant. Se descarto: banear es una
 *   accion de admin, y la 18 existe justamente para que `authenticated` tenga
 *   lo minimo. Abrir chat_bans para las cuatro personas que ya entran a
 *   /admin/chat contradiria lo que esa migracion vino a hacer.
 *
 * POR QUE requireAdmin() ESTA PRIMERO
 *   Una server action es un endpoint POST publico: su id no es secreto y que el
 *   boton se renderice bajo {canModerate && ...} no impide que la llamen. Como
 *   ademas corre con service_role, que saltea RLS, sin esta guarda cualquier
 *   alumna logueada podria banear a cualquiera. Es exactamente el agujero que
 *   se cerro el 2026-08-01 en las cuatro acciones de /dashboard.
 *
 * DEVUELVE en vez de redirigir: la llama un componente cliente en medio de una
 * conversacion, y sacar a la admin de la pantalla seria peor que un cartel.
 */

const DURACIONES = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  permanent: null,
} as const;

const esquema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  duration: z.enum(["1h", "24h", "7d", "permanent"]),
});

export type ResultadoModeracion = { ok: true } | { ok: false; error: string };

export async function banearUsuarioAction(input: {
  userId: string;
  reason?: string;
  duration: "1h" | "24h" | "7d" | "permanent";
}): Promise<ResultadoModeracion> {
  const { user } = await requireAdmin();

  const parsed = esquema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos invalidos." };
  }

  if (parsed.data.userId === user.id) {
    return { ok: false, error: "No podes banearte a vos misma." };
  }

  const ms = DURACIONES[parsed.data.duration];
  const expiresAt = ms == null ? null : new Date(Date.now() + ms).toISOString();

  const supabase = createSupabaseAdminClient();

  // unique(user_id) en chat_bans -> upsert, asi re-banear actualiza el registro
  // en vez de fallar por clave duplicada.
  const { error } = await supabase.from("chat_bans").upsert(
    {
      user_id: parsed.data.userId,
      banned_by: user.id,
      reason: parsed.data.reason?.trim() || null,
      expires_at: expiresAt,
    },
    { onConflict: "user_id" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/community");
  revalidatePath("/admin/chat");
  return { ok: true };
}
