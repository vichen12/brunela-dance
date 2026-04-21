import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, membership_tier, is_admin")
    .eq("id", user.id)
    .single<Profile>();

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
      const { data } = await supabase
        .from("chat_messages")
        .select("id, user_id, content, created_at, is_deleted, profiles(full_name, email, is_admin)")
        .eq("room_id", activeRoom.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(100);
      initialMessages = (data ?? []) as unknown as ChatMessage[];
    }

    const activeMember = members.find((m) => m.id === activeUserId);

    const TIER_BADGE: Record<string, string> = {
      none: "Sin plan", corps_de_ballet: "Corps", solista: "Solista", principal: "Principal",
    };

    return (
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "var(--font-body), sans-serif" }}>
        {/* Members sidebar */}
        <div style={{
          width: 240, flexShrink: 0, borderRight: "1px solid #fce7f3",
          background: "linear-gradient(180deg, #fff 0%, #fffbfd 100%)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #fce7f3" }}>
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
                    background: active ? "linear-gradient(135deg, #fdf2f8, #fce7f3)" : "transparent",
                    border: active ? "1px solid #fbcfe8" : "1px solid transparent",
                    textDecoration: "none",
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: active ? "linear-gradient(135deg, #f9a8d4, #be185d)" : "#fdf2f8",
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
                padding: "16px 24px", borderBottom: "1px solid #fce7f3",
                background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "linear-gradient(135deg, #fdf2f8, #fce7f3)",
                  border: "1.5px solid #fbcfe8",
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
  // Find admin user
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_admin", true)
    .limit(1)
    .maybeSingle<{ id: string; full_name: string | null; email: string }>();

  let dmRoom: DmRoom | null = null;
  let initialMessages: ChatMessage[] = [];

  if (adminProfile) {
    const { data: existingRoom } = await supabase
      .from("chat_rooms")
      .select("id, type, participant_ids")
      .eq("type", "dm")
      .contains("participant_ids", [user.id, adminProfile.id])
      .maybeSingle<DmRoom>();

    if (existingRoom) {
      dmRoom = existingRoom;
    } else {
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

    if (dmRoom) {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, user_id, content, created_at, is_deleted, profiles(full_name, email, is_admin)")
        .eq("room_id", dmRoom.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(100);
      initialMessages = (data ?? []) as unknown as ChatMessage[];
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "var(--font-body), sans-serif" }}>
      {/* Header */}
      <div style={{
        padding: "16px 32px", borderBottom: "1px solid #fce7f3",
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg, #f9a8d4, #be185d)",
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
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }}/>
          <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, letterSpacing: "0.08em" }}>EN LÍNEA</span>
        </div>
      </div>

      {dmRoom ? (
        <ChatRoom
          roomId={dmRoom.id}
          userId={user.id}
          isAdmin={false}
          initialMessages={initialMessages}
          placeholder="Escribile a Brunela..."
        />
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--muted)" }}>Cargando chat...</p>
        </div>
      )}
    </div>
  );
}
