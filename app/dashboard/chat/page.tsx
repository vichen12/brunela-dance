import Link from "next/link";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getDmAccess, tierCanStartDm } from "@/src/features/admin/chat-settings";
import { ChatRoom, type ChatMessage } from "@/components/chat-room";

export const dynamic = "force-dynamic";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

type Profile = { id: string; full_name: string | null; email: string; membership_tier: MembershipTier; is_admin: boolean };

type DmRoom = {
  id: string;
  type: string;
  participant_ids: string[];
};

export default async function ChatPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const selectedUserId = typeof params.user === "string" ? params.user : null;

  const profile = await getCurrentProfile(user.id);

  const isAdmin = profile?.is_admin ?? false;

  // ─── ADMIN VIEW ───────────────────────────────────────────────
  if (isAdmin) {
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_tier, is_admin")
      .eq("is_admin", false)
      .order("created_at", { ascending: false });

    const members = (allProfiles ?? []) as Profile[];

    const { data: allDmRooms } = await supabase
      .from("chat_rooms")
      .select("id, type, participant_ids")
      .eq("type", "dm");

    const dmRooms = (allDmRooms ?? []) as DmRoom[];

    const activeUserId = selectedUserId ?? members[0]?.id ?? null;
    let activeRoom: DmRoom | null = null;

    if (activeUserId) {
      activeRoom = dmRooms.find((r) =>
        r.participant_ids.includes(user.id) && r.participant_ids.includes(activeUserId)
      ) ?? null;

      if (!activeRoom) {
        const activeMember = members.find((m) => m.id === activeUserId);
        if (activeMember) {
          const { data: newRoom } = await supabase
            .from("chat_rooms")
            .insert({
              type: "dm",
              name: `DM: Brunela — ${activeMember.full_name ?? activeMember.email}`,
              participant_ids: [user.id, activeUserId],
            })
            .select("id, type, participant_ids")
            .single<DmRoom>();
          activeRoom = newRoom;
        }
      }
    }

    let initialMessages: ChatMessage[] = [];
    if (activeRoom) {
      // Newest 100, re-sorted oldest-first for display. Ordering ascending and
      // then limiting would pin the room to its first 100 messages forever.
      const { data } = await supabase
        .from("chat_messages")
        .select("id, user_id, content, created_at, is_deleted, profiles(full_name, email, is_admin)")
        .eq("room_id", activeRoom.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(100);
      initialMessages = ((data ?? []) as unknown as ChatMessage[]).reverse();
    }

    const activeMember = members.find((m) => m.id === activeUserId);

    const TIER_BADGE: Record<string, string> = {
      none: "Sin plan", corps_de_ballet: "Corps", solista: "Solista", principal: "Principal",
    };

    return (
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "var(--font-body), sans-serif" }}>
        {/* Members sidebar */}
        <div className="chat-col-sidebar" style={{
          width: 240, flexShrink: 0, borderRight: "1px solid var(--pink-soft)",
          background: "linear-gradient(180deg, #fff 0%, #fffbfd 100%)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid var(--pink-soft)" }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "var(--pink)" }}>
              MENSAJES DIRECTOS
            </p>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{members.length} alumnas</p>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {members.map((m) => {
              const active = m.id === activeUserId;
              const name = m.full_name?.split(" ")[0] ?? m.email.split("@")[0];
              return (
                <a
                  key={m.id}
                  href={`/dashboard/chat?user=${m.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 12, marginBottom: 2,
                    background: active ? "linear-gradient(135deg, var(--pink-wash), var(--pink-soft))" : "transparent",
                    border: active ? "1px solid var(--pink-line)" : "1px solid transparent",
                    textDecoration: "none",
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: active ? "linear-gradient(135deg, var(--rose), var(--pink-mid))" : "var(--pink-wash)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: active ? "#fff" : "var(--pink)",
                  }}>{name[0]?.toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </p>
                    <p style={{ fontSize: 9.5, color: "var(--muted)" }}>
                      {TIER_BADGE[m.membership_tier] ?? "Sin plan"}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {activeRoom && activeMember ? (
            <>
              <div style={{
                padding: "16px 24px", borderBottom: "1px solid var(--pink-soft)",
                background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "linear-gradient(135deg, var(--pink-wash), var(--pink-soft))",
                  border: "1.5px solid var(--pink-line)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: "var(--pink)",
                }}>
                  {(activeMember.full_name ?? activeMember.email)[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                    {activeMember.full_name ?? activeMember.email.split("@")[0]}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{activeMember.email}</p>
                </div>
              </div>
              <ChatRoom
                roomId={activeRoom.id}
                userId={user.id}
                isAdmin={true}
                initialMessages={initialMessages}
                placeholder={`Escribirle a ${activeMember.full_name?.split(" ")[0] ?? "alumna"}...`}
              />
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 36 }}>💌</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Seleccioná una alumna para chatear</p>
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Los mensajes son privados entre vos y cada alumna</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── MEMBER VIEW ────────────────────────────────────────────────
  // Who the member is talking to.
  //
  // This CANNOT be a plain select on profiles: RLS lets a member read only
  // their own row, so `where is_admin = true` came back empty and the whole DM
  // block below was skipped -- which is why this page used to render
  // "Cargando chat..." forever for every member. get_studio_admin() is a
  // security-definer function that returns just the id and the display name,
  // and nothing else about anyone. See 20260730_chat_studio_admin_lookup.sql.
  const { data: studioAdmin, error: adminLookupError } = await supabase
    .rpc("get_studio_admin")
    .maybeSingle<{ admin_id: string; admin_name: string | null }>();

  const adminProfile = studioAdmin ? { id: studioAdmin.admin_id, full_name: studioAdmin.admin_name } : null;

  // Silent failure here is what produced the permanent fake "loading" screen.
  if (adminLookupError || !adminProfile) {
    console.error(
      "[chat] no se pudo resolver la admin del estudio:",
      adminLookupError?.message ?? "get_studio_admin() no devolvio filas"
    );
  }

  let dmRoom: DmRoom | null = null;
  let initialMessages: ChatMessage[] = [];

  // Is the member's tier allowed to START a DM with the admin?
  const dmAccess = await getDmAccess();
  const canStartDm = tierCanStartDm(dmAccess, profile?.membership_tier ?? "none");

  if (adminProfile) {
    const { data: existingRoom } = await supabase
      .from("chat_rooms")
      .select("id, type, participant_ids")
      .eq("type", "dm")
      .contains("participant_ids", [user.id, adminProfile.id])
      .maybeSingle<DmRoom>();

    if (existingRoom) {
      // An existing conversation (possibly started by the admin) stays open
      // regardless of the current plan.
      dmRoom = existingRoom;
    } else if (canStartDm) {
      const { data: newRoom } = await supabase
        .from("chat_rooms")
        .insert({
          type: "dm",
          name: `DM: Brunela — ${profile?.full_name ?? user.email}`,
          participant_ids: [user.id, adminProfile.id],
        })
        .select("id, type, participant_ids")
        .single<DmRoom>();
      dmRoom = newRoom;
    }
    // else: no room + not allowed -> render the upgrade gate below.

    if (dmRoom) {
      // Newest 100, re-sorted oldest-first for display. Ordering ascending and
      // then limiting would pin the room to its first 100 messages forever.
      const { data } = await supabase
        .from("chat_messages")
        .select("id, user_id, content, created_at, is_deleted, profiles(full_name, email, is_admin)")
        .eq("room_id", dmRoom.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(100);
      initialMessages = ((data ?? []) as unknown as ChatMessage[]).reverse();
    }
  }

  // Con quien habla la alumna. Sin esto los mensajes de Brunela se ven como
  // "Usuario": la RLS no deja a la alumna leer el perfil de la admin.
  const interlocutorDeLaAlumna = adminProfile
    ? { id: adminProfile.id, name: adminProfile.full_name ?? "Brunela", isAdmin: true }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "var(--font-body), sans-serif" }}>
      {/* Header */}
      <div style={{
        padding: "16px 32px", borderBottom: "1px solid var(--pink-soft)",
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg, var(--rose), var(--pink-mid))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 800, color: "#fff",
          boxShadow: "0 4px 12px rgba(190,24,93,0.3)",
        }}>B</div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Brunela</p>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
            Instructora · Responde en menos de 24hs
          </p>
        </div>
        {/* Antes habia un "EN LINEA" verde fijo. No hay sistema de presencia:
            decia que Brunela estaba conectada aunque no lo estuviera. */}
      </div>

      {dmRoom ? (
        <ChatRoom
          roomId={dmRoom.id}
          userId={user.id}
          isAdmin={false}
          initialMessages={initialMessages}
          placeholder="Escribile a Brunela..."
          // Sin esto los mensajes de Brunela se ven como "Usuario": la RLS no
          // deja a la alumna leer el perfil de la admin.
          interlocutor={interlocutorDeLaAlumna}
        />
      ) : !canStartDm ? (
        // Plan gate: this tier cannot start a direct chat with Brunela.
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{
            maxWidth: 420, textAlign: "center", background: "rgba(255,255,255,0.7)",
            border: "1px solid var(--pink-soft)", borderRadius: 24, padding: "40px 32px",
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔒</div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
              El chat directo con Brunela es exclusivo de tu plan superior
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 22 }}>
              Tu plan actual no incluye mensajes privados con Brunela. Actualizá tu plan
              para tener acompañamiento personalizado uno a uno.
            </p>
            <Link
              href="/dashboard/plan"
              style={{
                display: "inline-block", padding: "12px 26px", borderRadius: 99,
                background: "var(--pink)", color: "#fff", fontSize: 12, fontWeight: 700,
                textDecoration: "none", boxShadow: "0 4px 14px rgba(190,24,93,0.35)",
              }}
            >
              Ver planes
            </Link>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 18 }}>
              Mientras tanto, podés participar en los{" "}
              <Link href="/dashboard/community" style={{ color: "var(--pink)", fontWeight: 600, textDecoration: "none" }}>
                canales de comunidad
              </Link>.
            </p>
          </div>
        </div>
      ) : (
        // Last resort. This used to say "Cargando chat..." and never resolve,
        // which is how a hard failure spent months looking like a slow page.
        // If we land here the conversation genuinely could not be opened.
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{
            maxWidth: 420, textAlign: "center", background: "rgba(255,255,255,0.7)",
            border: "1px solid var(--pink-soft)", borderRadius: 24, padding: "40px 32px",
            backdropFilter: "blur(8px)",
          }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
              No pudimos abrir tu conversación
            </p>
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
              Volvé a cargar la página. Si sigue pasando, avisanos: es un problema nuestro,
              no de tu plan ni de tu cuenta.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
