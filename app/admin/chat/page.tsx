import Link from "next/link";
import { leerCategorias } from "@/src/lib/categorias";
import { BotonEnviar } from "@/components/boton-enviar";
import { ChatRoom, type ChatMessage } from "@/components/chat-room";
import { requireAdmin } from "@/src/features/auth/guards";
import { Users, Gem, MessageSquare, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { invalidarAjustes } from "@/src/lib/settings";
import {
  DM_ACCESS_DEFAULT,
  DM_TIER_LABEL,
  DM_TIER_ORDER,
  getDmAccess,
  type DmAccessMap,
  type MembershipTier,
} from "@/src/features/admin/chat-settings";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Maps a moderation duration choice to an absolute expiry (null = permanent).
const DURATION_TO_MS: Record<string, number | null> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  permanent: null,
};

function resolveExpiry(duration: string): string | null {
  const ms = DURATION_TO_MS[duration];
  if (ms == null) return null;
  return new Date(Date.now() + ms).toISOString();
}

type Room = {
  id: string;
  type: string;
  name: string;
  tier_required: string;
  is_archived: boolean;
};

type Message = {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
  profiles: { full_name: string | null; email: string; is_admin: boolean } | null;
};

type Ban = {
  id: string;
  user_id: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

type Mute = {
  id: string;
  user_id: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

// ── Server actions ────────────────────────────────────────────────────────────

async function createRoomAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const schema = z.object({
    name: z.string().min(2),
    type: z.enum(["community", "tier"]),
    tier_required: z.enum(["none", "corps_de_ballet", "solista", "principal"]),
  });

  const parsed = schema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    tier_required: formData.get("tier_required"),
  });

  if (!parsed.success) redirect("/admin/chat?error=Datos+inválidos" as never);

  const { error } = await supabase.from("chat_rooms").insert({
    name: parsed.data.name.trim(),
    type: parsed.data.type,
    tier_required: parsed.data.type === "community" ? "none" : parsed.data.tier_required,
    is_archived: false,
    participant_ids: [],
  });

  if (error) redirect((`/admin/chat?error=${encodeURIComponent(error.message)}`) as never);

  revalidatePath("/admin/chat");
  revalidatePath("/dashboard/community");
  redirect("/admin/chat?success=Sala+creada" as never);
}

async function archiveRoomAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  await supabase.from("chat_rooms").update({ is_archived: !archived }).eq("id", id);
  revalidatePath("/admin/chat");
  revalidatePath("/dashboard/community");
  redirect("/admin/chat?tab=rooms&success=Sala+actualizada" as never);
}


async function unbanUserAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("chat_bans").delete().eq("id", id);
  revalidatePath("/admin/chat");
  redirect("/admin/chat?tab=bans&success=Usuario+desbaneado" as never);
}

async function unmuteUserAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("chat_mutes").delete().eq("id", id);
  revalidatePath("/admin/chat");
  redirect("/admin/chat?tab=mutes&success=Usuario+desmuteado" as never);
}


async function saveDmAccessAction(formData: FormData) {
  "use server";
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  // Each tier checkbox is present only when toggled on.
  const value: DmAccessMap = {
    none: formData.get("dm_none") === "on",
    corps_de_ballet: formData.get("dm_corps_de_ballet") === "on",
    solista: formData.get("dm_solista") === "on",
    principal: formData.get("dm_principal") === "on",
  };

  invalidarAjustes();

  const { error } = await supabase.from("site_settings").upsert(
    {
      setting_key: "chat.dm_access",
      category: "chat",
      // Se veia tal cual en pantalla, en ingles.
      description: "Qué planes pueden abrir un chat privado con el estudio.",
      is_public: false,
      value,
      updated_by: user.id,
    },
    { onConflict: "setting_key" }
  );

  if (error) redirect(`/admin/chat?tab=dm&error=${encodeURIComponent(error.message)}` as never);

  revalidatePath("/admin/chat");
  revalidatePath("/dashboard/chat");
  redirect("/admin/chat?tab=dm&success=Permisos+de+chat+actualizados" as never);
}


async function createCategoryRoomAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const schema = z.object({
    category_slug: z.string().min(1),
    name: z.string().min(2),
    tier_required: z.enum(["none", "corps_de_ballet", "solista", "principal"]),
  });
  const parsed = schema.safeParse({
    category_slug: formData.get("category_slug"),
    name: formData.get("name"),
    tier_required: formData.get("tier_required"),
  });
  if (!parsed.success) redirect("/admin/chat?tab=rooms&error=Datos+invalidos" as never);

  // Avoid duplicate channels for the same category.
  const { data: existing } = await supabase
    .from("chat_rooms")
    .select("id")
    .eq("category_slug", parsed.data.category_slug)
    .maybeSingle<{ id: string }>();

  if (existing) {
    redirect(`/admin/chat?tab=rooms&room=${existing.id}&error=Ya+existe+un+canal+para+esa+categoria` as never);
  }

  const { error } = await supabase.from("chat_rooms").insert({
    name: parsed.data.name.trim(),
    type: "tier",
    tier_required: parsed.data.tier_required,
    category_slug: parsed.data.category_slug,
    is_archived: false,
    participant_ids: [],
  });

  if (error) redirect(`/admin/chat?tab=rooms&error=${encodeURIComponent(error.message)}` as never);

  revalidatePath("/admin/chat");
  revalidatePath("/dashboard/community");
  redirect("/admin/chat?tab=rooms&success=Canal+de+categoria+creado" as never);
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const inp = "w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm outline-none focus:border-pink-400 transition";
const lbl = "block text-xs font-bold uppercase tracking-widest text-[color:var(--muted)] mb-2";

function Flash({ msg, tone }: { msg: string | null; tone: "success" | "error" }) {
  if (!msg) return null;
  return (
    <div style={{
      borderRadius: 14, padding: "12px 18px", fontSize: 13, fontWeight: 600,
      background: tone === "success" ? "#f0fdf4" : "#fef2f2",
      color: tone === "success" ? "#166534" : "#991b1b",
      border: `1px solid ${tone === "success" ? "#bbf7d0" : "#fecaca"}`,
    }}>{msg}</div>
  );
}

const ROOM_TYPE_LABEL: Record<string, string> = {
  community: "Comunidad", tier: "Tier", dm: "DM privado",
};
const TIER_LABEL: Record<string, string> = {
  none: "Todas", corps_de_ballet: "Corps", solista: "Solista", principal: "Principal",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminChatPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user: adminUser } = await requireAdmin();
  const adminUserId = adminUser.id;
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const tab = typeof params.tab === "string" ? params.tab : "rooms";
  const success = typeof params.success === "string" ? decodeURIComponent(params.success) : null;
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;
  const activeRoomId = typeof params.room === "string" ? params.room : null;

  // Cinco consultas independientes que estaban encadenadas: eran cinco viajes
  // seguidos a Supabase. Medido antes: 1728 ms de espera pura en esta pantalla.
  const [
    { data: roomsData },
    { data: bansData },
    { data: mutesData },
    dmAccess,
    categoriesData,
  ] = await Promise.all([
    supabase
      .from("chat_rooms")
      .select("id, type, name, tier_required, is_archived")
      // Fase D: los DM se descartan en SQL y no en memoria.
      //
      // Esta pantalla ya los filtraba con `rooms.filter(r => r.type !== "dm")`,
      // pero DESPUES de traerlos. Y hay UN DM POR ALUMNA: con 500 alumnas eran
      // 500 filas viajando en cada carga para tirarlas al llegar. Es la clase
      // de consulta que anda perfecto hasta que el estudio crece.
      .neq("type", "dm")
      .order("created_at"),
    supabase
      .from("chat_bans")
      .select("id, user_id, reason, expires_at, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false }),
    supabase
      .from("chat_mutes")
      .select("id, user_id, reason, expires_at, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false }),
    getDmAccess(),
    // Fase E: cacheado. Las categorias no dependen de quien mira.
    leerCategorias(),
  ]);

  const rooms = (roomsData ?? []) as Room[];
  const bans = (bansData ?? []) as unknown as Ban[];
  const mutes = (mutesData ?? []) as unknown as Mute[];
  const categories = categoriesData ?? [];

  const publicRooms = rooms.filter((r) => r.type !== "dm");
  const activeRoom = publicRooms.find((r) => r.id === activeRoomId) ?? null;

  let messages: Message[] = [];
  if (activeRoom) {
    const { data } = await supabase
      .from("chat_messages")
      .select("*, profiles(full_name, email, is_admin)")
      .eq("room_id", activeRoom.id)
      .order("created_at", { ascending: false })
      .limit(200);
    messages = (data ?? []) as unknown as Message[];
  }

  const TABS = [
    { key: "rooms", label: `Salas (${publicRooms.length})` },
    { key: "dm", label: "Chat directo" },
    { key: "bans", label: `Baneos (${bans.length})` },
    { key: "mutes", label: `Muteos (${mutes.length})` },
  ];

  return (
    <main className="space-y-6">
      <header className="hero-stage">
        <p className="eyebrow">Moderación</p>
        <h1 className="display mt-5 text-5xl leading-none md:text-6xl">Chat.</h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
          Salas, mensajes, muteos y baneos del estudio.
        </p>
      </header>

      {(success || error) && (
        <div className="space-y-2">
          <Flash msg={success} tone="success" />
          <Flash msg={error} tone="error" />
        </div>
      )}

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/chat?tab=${t.key}` as never} style={{
            padding: "7px 18px", borderRadius: 99, textDecoration: "none",
            fontSize: 12, fontWeight: 700,
            background: tab === t.key ? "var(--pink)" : "var(--pink-wash)",
            color: tab === t.key ? "#fff" : "var(--muted)",
            border: tab === t.key ? "none" : "1.5px solid var(--pink-soft)",
            boxShadow: tab === t.key ? "0 4px 12px rgba(230, 79, 85,0.25)" : "none",
          }}>{t.label}</Link>
        ))}
      </div>

      {/* ── ROOMS TAB ── */}
      {tab === "rooms" && (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* Left: room list + create form */}
          <div style={{ width: 270, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Create room */}
            {/* LA LISTA PRIMERO.
                Antes los dos formularios ocupaban la columna entera siempre y
                la lista quedaba empujada al fondo: al crear una sala no habia
                forma de encontrarla. Lo que se ve por defecto tiene que ser lo
                que YA existe; crear es la excepcion, no lo normal. */}
            <div className="panel rounded-[2rem] p-5">
              <p className="eyebrow mb-3">Salas ({publicRooms.length})</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {publicRooms.map((room) => {
                  const active = room.id === activeRoomId;
                  const Icon = room.type === "community" ? Users : Gem;
                  return (
                    <div key={room.id} style={{
                      borderRadius: 14,
                      background: active ? "linear-gradient(135deg,var(--pink-wash),var(--pink-soft))" : "transparent",
                      border: active ? "1.5px solid var(--pink-line)" : "1.5px solid transparent",
                      overflow: "hidden",
                    }}>
                      <Link href={`/admin/chat?tab=rooms&room=${room.id}` as never} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", textDecoration: "none",
                      }}>
                        <Icon size={16} strokeWidth={1.9} style={{ flexShrink: 0, color: active ? "var(--pink)" : "var(--muted)" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--pink)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {room.name}
                          </p>
                          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                            <span style={{ fontSize: 9, color: "var(--muted)" }}>{ROOM_TYPE_LABEL[room.type]}</span>
                            {room.tier_required !== "none" && (
                              <span style={{ fontSize: 9, color: "var(--pink)", fontWeight: 600 }}>{TIER_LABEL[room.tier_required]}</span>
                            )}
                            {room.is_archived && (
                              <span style={{ fontSize: 9, background: "#fef3c7", color: "#92400e", padding: "1px 5px", borderRadius: 99, fontWeight: 700 }}>ARCHIVADO</span>
                            )}
                          </div>
                        </div>
                      </Link>
                      <form action={archiveRoomAction} style={{ padding: "0 12px 8px" }}>
                        <input type="hidden" name="id" value={room.id} />
                        <input type="hidden" name="archived" value={String(room.is_archived)} />
                        <BotonEnviar pendingLabel="…" style={{
                          fontSize: 9.5, fontWeight: 700, color: "var(--muted)", background: "none",
                          border: "none", padding: 0,
                        }}>{room.is_archived ? "Desarchivar" : "Archivar"}</BotonEnviar>
                      </form>
                    </div>
                  );
                })}
                {publicRooms.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>No hay salas todavía. Creá la primera.</p>
                )}
              </div>
            </div>

            <details className="panel rounded-[2rem]" style={{ padding: "14px 18px" }}>
              <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 32 }}>
                <span className="eyebrow" style={{ margin: 0 }}>Crear una sala</span>
                <Plus size={16} strokeWidth={2.2} style={{ color: "var(--pink)" }} />
              </summary>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="panel rounded-[2rem] p-5">
              <p className="eyebrow mb-4">Nueva sala</p>
              <form action={createRoomAction} className="space-y-3">
                <div>
                  <label className={lbl}>Nombre</label>
                  <input className={inp} name="name" required placeholder="General · Ballet Avanzado..." />
                </div>
                <div>
                  <label className={lbl}>Tipo</label>
                  <select className={inp} name="type" defaultValue="community">
                    <option value="community">Comunidad (todas)</option>
                    <option value="tier">Exclusiva por plan</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Plan mínimo</label>
                  <select className={inp} name="tier_required" defaultValue="none">
                    <option value="none">Sin restricción</option>
                    <option value="corps_de_ballet">Corps de Ballet</option>
                    <option value="solista">Solista</option>
                    <option value="principal">Principal</option>
                  </select>
                </div>
                <button className="button-primary w-full" type="submit">Crear sala</button>
              </form>
            </div>
              <div className="panel rounded-[2rem] p-5">
                <p className="eyebrow mb-1">Canal por categoría</p>
                <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                  Crea un canal alineado con una categoría de la biblioteca.
                </p>
                <form action={createCategoryRoomAction} className="space-y-3">
                  <div>
                    <label className={lbl}>Categoría</label>
                    <select className={inp} name="category_slug" required defaultValue="">
                      <option value="" disabled>Elegí una categoría…</option>
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name_i18n?.es ?? c.slug}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Nombre del canal</label>
                    <input className={inp} name="name" required placeholder="Ballet · Comunidad" />
                  </div>
                  <div>
                    <label className={lbl}>Plan mínimo</label>
                    <select className={inp} name="tier_required" defaultValue="none">
                      <option value="none">Sin restricción</option>
                      <option value="corps_de_ballet">Corps de Ballet</option>
                      <option value="solista">Solista</option>
                      <option value="principal">Principal</option>
                    </select>
                  </div>
                  <button className="button-secondary w-full" type="submit">Crear canal de categoría</button>
                </form>
              </div>
              </div>
            </details>
          </div>

          {/* Right: messages */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeRoom ? (
              /*
               * El MISMO componente que usan las alumnas.
               *
               * POR QUE SE REEMPLAZO LO QUE HABIA
               *   Esta pantalla tenia su propia implementacion: los mensajes se
               *   renderizaban en el servidor y enviar disparaba una server
               *   action que terminaba en revalidatePath x2 + redirect(). O sea
               *   UNA NAVEGACION COMPLETA por cada mensaje. Ademas no tenia
               *   realtime: para ver lo que escribia una alumna habia que
               *   recargar a mano.
               *
               *   Eran dos implementaciones del mismo chat, y la de Brunela era
               *   la peor de las dos.
               *
               * `canModerate` sale de isAdmin dentro del componente, asi que
               * eliminar, mutear y banear siguen estando -- pero al pasar el
               * mouse, no como botones gritando en cada mensaje.
               */
              <div style={{ height: "calc(100vh - 220px)", minHeight: 420, border: "1.5px solid var(--pink-soft)", borderRadius: 24, overflow: "hidden", background: "#fff" }}>
                <ChatRoom
                  roomId={activeRoom.id}
                  userId={adminUserId}
                  isAdmin
                  initialMessages={messages as unknown as ChatMessage[]}
                  roomName={activeRoom.name}
                  placeholder="Escribí un mensaje como Brunela…"
                />
              </div>
            ) : (
              <div className="panel rounded-[2rem] p-10" style={{ textAlign: "center", color: "var(--muted)" }}>
                <MessageSquare size={30} strokeWidth={1.5} style={{ color: "var(--pink)", marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Seleccioná una sala para ver sus mensajes</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>O creá una sala nueva desde el panel izquierdo</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DM ACCESS TAB ── */}
      {tab === "dm" && (
        <div className="panel rounded-[2.4rem] p-7 md:p-9 space-y-5" style={{ maxWidth: 560 }}>
          <div>
            <p className="eyebrow mb-2">Chat directo con Brunela</p>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              Elegí qué planes pueden <strong>iniciar</strong> un chat privado con vos.
              Vos siempre podés escribirle a cualquier alumna desde la pestaña de mensajes,
              sin importar su plan.
            </p>
          </div>

          <form action={saveDmAccessAction} className="space-y-3">
            {DM_TIER_ORDER.map((tier) => {
              const enabled = dmAccess[tier as MembershipTier];
              return (
                <label
                  key={tier}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", borderRadius: 16,
                    background: enabled ? "linear-gradient(135deg, var(--pink-wash), var(--pink-soft))" : "#fafafa",
                    border: `1px solid ${enabled ? "var(--pink-line)" : "#f0eeec"}`,
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                      {DM_TIER_LABEL[tier as MembershipTier]}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {enabled ? "Puede iniciar chat directo" : "No puede iniciar chat directo"}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    name={`dm_${tier}`}
                    defaultChecked={enabled}
                    style={{ width: 20, height: 20, accentColor: "var(--pink-mid)" }}
                  />
                </label>
              );
            })}
            <p style={{ fontSize: 11, color: "var(--muted)" }}>
              Por defecto solo el plan <strong>Principal</strong> tiene chat directo (coincide con la landing).
            </p>
            <BotonEnviar className="button-primary">Guardar permisos</BotonEnviar>
          </form>
        </div>
      )}

      {/* ── BANS TAB ── */}
      {tab === "bans" && (
        <div className="panel rounded-[2.4rem] p-7 md:p-9 space-y-4">
          <p className="eyebrow mb-2">Usuarios baneados — {bans.length}</p>
          {bans.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)", fontSize: 13 }}>
              No hay usuarios baneados. Los baneos se aplican desde el chat del miembro.
            </div>
          ) : (
            <div className="space-y-3">
              {bans.map((ban) => {
                const name = ban.profiles?.full_name ?? ban.profiles?.email ?? ban.user_id;
                return (
                  <div key={ban.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", borderRadius: 16,
                    background: "#fef2f2", border: "1px solid #fecaca",
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{name}</p>
                      {ban.reason && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Motivo: {ban.reason}</p>}
                      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: "var(--muted)" }}>
                          Baneado: {new Date(ban.created_at).toLocaleDateString("es-AR")}
                        </span>
                        {ban.expires_at && (
                          <span style={{ fontSize: 10, color: "#92400e" }}>
                            Expira: {new Date(ban.expires_at).toLocaleDateString("es-AR")}
                          </span>
                        )}
                      </div>
                    </div>
                    <form action={unbanUserAction}>
                      <input type="hidden" name="id" value={ban.id} />
                      <BotonEnviar className="button-secondary" style={{ padding: "6px 14px", fontSize: "0.7rem" }}>Desbanear</BotonEnviar>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MUTES TAB ── */}
      {tab === "mutes" && (
        <div className="panel rounded-[2.4rem] p-7 md:p-9 space-y-4">
          <p className="eyebrow mb-2">Usuarios muteados — {mutes.length}</p>
          {mutes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)", fontSize: 13 }}>
              No hay usuarios muteados. Los muteos se aplican desde el chat del miembro.
            </div>
          ) : (
            <div className="space-y-3">
              {mutes.map((mute) => {
                const name = mute.profiles?.full_name ?? mute.profiles?.email ?? mute.user_id;
                return (
                  <div key={mute.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", borderRadius: 16,
                    background: "#fefce8", border: "1px solid #fef08a",
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{name}</p>
                      {mute.reason && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Motivo: {mute.reason}</p>}
                      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: "var(--muted)" }}>
                          Muteado: {new Date(mute.created_at).toLocaleDateString("es-AR")}
                        </span>
                        {mute.expires_at && (
                          <span style={{ fontSize: 10, color: "#92400e" }}>
                            Expira: {new Date(mute.expires_at).toLocaleDateString("es-AR")}
                          </span>
                        )}
                      </div>
                    </div>
                    <form action={unmuteUserAction}>
                      <input type="hidden" name="id" value={mute.id} />
                      <BotonEnviar className="button-secondary" style={{ padding: "6px 14px", fontSize: "0.7rem" }}>Desmutear</BotonEnviar>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
