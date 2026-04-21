import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export const dynamic = "force-dynamic";

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

async function deleteMessageAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  const roomId = String(formData.get("room_id") ?? "");
  await supabase.from("chat_messages").update({ is_deleted: true }).eq("id", id);
  revalidatePath("/admin/chat");
  redirect((`/admin/chat?tab=rooms&room=${roomId}`) as never);
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
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const tab = typeof params.tab === "string" ? params.tab : "rooms";
  const success = typeof params.success === "string" ? decodeURIComponent(params.success) : null;
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;
  const activeRoomId = typeof params.room === "string" ? params.room : null;

  const { data: roomsData } = await supabase
    .from("chat_rooms")
    .select("id, type, name, tier_required, is_archived")
    .order("created_at");
  const rooms = (roomsData ?? []) as Room[];

  const { data: bansData } = await supabase
    .from("chat_bans")
    .select("id, user_id, reason, expires_at, created_at, profiles(full_name, email)")
    .order("created_at", { ascending: false });
  const bans = (bansData ?? []) as unknown as Ban[];

  const { data: mutesData } = await supabase
    .from("chat_mutes")
    .select("id, user_id, reason, expires_at, created_at, profiles(full_name, email)")
    .order("created_at", { ascending: false });
  const mutes = (mutesData ?? []) as unknown as Mute[];

  const publicRooms = rooms.filter((r) => r.type !== "dm");
  const activeRoom = publicRooms.find((r) => r.id === activeRoomId) ?? null;

  let messages: Message[] = [];
  if (activeRoom) {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, room_id, user_id, content, created_at, is_deleted, profiles(full_name, email, is_admin)")
      .eq("room_id", activeRoom.id)
      .order("created_at", { ascending: false })
      .limit(200);
    messages = (data ?? []) as unknown as Message[];
  }

  const TABS = [
    { key: "rooms", label: "Salas" },
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
          <a key={t.key} href={`/admin/chat?tab=${t.key}`} style={{
            padding: "7px 18px", borderRadius: 99, textDecoration: "none",
            fontSize: 12, fontWeight: 700,
            background: tab === t.key ? "var(--pink)" : "#fdf2f8",
            color: tab === t.key ? "#fff" : "var(--muted)",
            border: tab === t.key ? "none" : "1.5px solid #fce7f3",
            boxShadow: tab === t.key ? "0 4px 12px rgba(190,24,93,0.25)" : "none",
          }}>{t.label}</a>
        ))}
      </div>

      {/* ── ROOMS TAB ── */}
      {tab === "rooms" && (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* Left: room list + create form */}
          <div style={{ width: 270, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Create room */}
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
                    <option value="tier">Exclusiva por tier</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Tier mínimo</label>
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

            {/* Room list */}
            <div className="panel rounded-[2rem] p-5">
              <p className="eyebrow mb-3">Salas ({publicRooms.length})</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {publicRooms.map((room) => {
                  const active = room.id === activeRoomId;
                  const icon = room.type === "community" ? "🌸" : "💎";
                  return (
                    <div key={room.id} style={{
                      borderRadius: 14,
                      background: active ? "linear-gradient(135deg,#fdf2f8,#fce7f3)" : "transparent",
                      border: active ? "1.5px solid #fbcfe8" : "1.5px solid transparent",
                      overflow: "hidden",
                    }}>
                      <a href={`/admin/chat?tab=rooms&room=${room.id}`} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", textDecoration: "none",
                      }}>
                        <span style={{ fontSize: 16 }}>{icon}</span>
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
                      </a>
                      <form action={archiveRoomAction} style={{ borderTop: "1px solid #fce7f3", padding: "6px 12px" }}>
                        <input type="hidden" name="id" value={room.id} />
                        <input type="hidden" name="archived" value={String(room.is_archived)} />
                        <button type="submit" style={{
                          fontSize: 10, fontWeight: 700, color: "var(--muted)", background: "none",
                          border: "none", cursor: "pointer", padding: 0,
                        }}>
                          {room.is_archived ? "Desarchivar" : "Archivar"}
                        </button>
                      </form>
                    </div>
                  );
                })}
                {publicRooms.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>No hay salas todavía. Creá la primera.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: messages */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeRoom ? (
              <div className="panel rounded-[2rem] p-5 space-y-3">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <p className="eyebrow">{activeRoom.name}</p>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                    background: "#fdf2f8", color: "var(--pink)", border: "1px solid #fce7f3",
                  }}>{messages.length} mensajes</span>
                </div>

                {messages.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>No hay mensajes en esta sala.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 560, overflowY: "auto" }}>
                    {messages.map((msg) => {
                      const name = msg.profiles?.is_admin
                        ? "Brunela"
                        : (msg.profiles?.full_name ?? msg.profiles?.email?.split("@")[0] ?? "Usuario");
                      return (
                        <div key={msg.id} style={{
                          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
                          padding: "10px 14px", borderRadius: 14,
                          background: msg.is_deleted ? "#fef2f2" : "rgba(253,242,248,0.4)",
                          border: `1px solid ${msg.is_deleted ? "#fecaca" : "#fce7f3"}`,
                          opacity: msg.is_deleted ? 0.6 : 1,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: msg.profiles?.is_admin ? "var(--pink)" : "var(--ink)" }}>
                                {name}
                              </span>
                              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                                {new Date(msg.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                              {msg.is_deleted && (
                                <span style={{ fontSize: 9, background: "#fecaca", color: "#991b1b", padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>ELIMINADO</span>
                              )}
                            </div>
                            <p style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5, wordBreak: "break-word" }}>{msg.content}</p>
                          </div>
                          {!msg.is_deleted && (
                            <form action={deleteMessageAction} style={{ flexShrink: 0 }}>
                              <input type="hidden" name="id" value={msg.id} />
                              <input type="hidden" name="room_id" value={msg.room_id} />
                              <button type="submit" style={{
                                padding: "4px 10px", borderRadius: 8, border: "1px solid #fecaca",
                                background: "#fef2f2", color: "#991b1b", fontSize: 10, fontWeight: 700, cursor: "pointer",
                              }}>Eliminar</button>
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="panel rounded-[2rem] p-10" style={{ textAlign: "center", color: "var(--muted)" }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>💬</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Seleccioná una sala para ver sus mensajes</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>O creá una sala nueva desde el panel izquierdo</p>
              </div>
            )}
          </div>
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
                      <button type="submit" className="button-secondary" style={{ padding: "6px 14px", fontSize: "0.7rem" }}>
                        Desbanear
                      </button>
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
                      <button type="submit" className="button-secondary" style={{ padding: "6px 14px", fontSize: "0.7rem" }}>
                        Desmutear
                      </button>
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
