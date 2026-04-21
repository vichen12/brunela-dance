import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { ChatRoom, type ChatMessage } from "@/components/chat-room";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export const dynamic = "force-dynamic";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

const TIER_ORDER: Record<MembershipTier, number> = {
  none: 0, corps_de_ballet: 1, solista: 2, principal: 3,
};

type Room = {
  id: string;
  type: string;
  name: string;
  tier_required: MembershipTier;
  is_archived: boolean;
};

// ── Admin inline actions ──────────────────────────────────────────────────────

async function createRoomAction(formData: FormData) {
  "use server";
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
  if (!parsed.success) redirect("/dashboard/community" as never);
  await supabase.from("chat_rooms").insert({
    name: parsed.data.name.trim(),
    type: parsed.data.type,
    tier_required: parsed.data.type === "community" ? "none" : parsed.data.tier_required,
    is_archived: false,
    participant_ids: [],
  });
  revalidatePath("/dashboard/community");
  revalidatePath("/admin/chat");
  redirect("/dashboard/community" as never);
}

async function archiveRoomAction(formData: FormData) {
  "use server";
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  await supabase.from("chat_rooms").update({ is_archived: !archived }).eq("id", id);
  revalidatePath("/dashboard/community");
  revalidatePath("/admin/chat");
  redirect("/dashboard/community" as never);
}

// ── Page ─────────────────────────────────────────────────────────────────────

const inp = "w-full rounded-xl border border-black/8 bg-white/80 px-3 py-2 text-xs outline-none focus:border-pink-400 transition";
const lbl = "block text-[9px] font-bold uppercase tracking-widest text-[color:var(--muted)] mb-1";

const TIER_LABEL: Record<string, string> = {
  none: "Todas", corps_de_ballet: "Corps", solista: "Solista", principal: "Principal",
};

export default async function CommunityPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const activeRoomId = typeof params.room === "string" ? params.room : null;
  const showCreate = params.create === "1";

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, membership_tier, is_admin")
    .eq("id", user.id)
    .single<{ full_name: string | null; membership_tier: MembershipTier; is_admin: boolean }>();

  const tier = profile?.membership_tier ?? "none";
  const isAdmin = profile?.is_admin ?? false;

  const { data: roomsData } = await supabase
    .from("chat_rooms")
    .select("id, type, name, tier_required, is_archived")
    .in("type", ["community", "tier"])
    .order("created_at");

  const allRooms = (roomsData ?? []) as Room[];

  const accessibleRooms = isAdmin
    ? allRooms
    : allRooms.filter((r) =>
        !r.is_archived && (r.type === "community" || TIER_ORDER[tier] >= TIER_ORDER[r.tier_required])
      );

  const currentRoom = accessibleRooms.find((r) => r.id === activeRoomId) ?? accessibleRooms.find((r) => !r.is_archived) ?? accessibleRooms[0];

  let initialMessages: ChatMessage[] = [];
  if (currentRoom) {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, user_id, content, created_at, is_deleted, profiles(full_name, email, is_admin)")
      .eq("room_id", currentRoom.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(100);
    initialMessages = (data ?? []) as unknown as ChatMessage[];
  }

  if (!isAdmin && accessibleRooms.length === 0) {
    return (
      <main className="pb-20 pt-6">
        <section className="page-shell">
          <div className="hero-stage">
            <p className="eyebrow">Comunidad</p>
            <h1 className="display mt-5 text-5xl">Chat del estudio.</h1>
            <p className="mt-4 text-base text-[color:var(--ink-soft)]">
              Los chats de comunidad estarán disponibles pronto.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "var(--font-body), sans-serif" }}>

      {/* Sidebar */}
      <div className="chat-col-sidebar" style={{
        width: 230, flexShrink: 0, borderRight: "1px solid #fce7f3",
        background: "linear-gradient(180deg, #fff 0%, #fffbfd 100%)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid #fce7f3", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "var(--pink)" }}>CANALES</p>
          {isAdmin && (
            <a
              href={showCreate ? "/dashboard/community" : "/dashboard/community?create=1"}
              style={{
                width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
                background: showCreate ? "var(--pink)" : "#fdf2f8", color: showCreate ? "#fff" : "var(--pink)",
                fontSize: 14, fontWeight: 700, textDecoration: "none", border: "1px solid #fce7f3",
              }}
            >{showCreate ? "×" : "+"}</a>
          )}
        </div>

        {/* Admin create form */}
        {isAdmin && showCreate && (
          <form action={createRoomAction} style={{ padding: "12px 12px 8px", borderBottom: "1px solid #fce7f3", background: "#fdf2f8" }}>
            <div style={{ marginBottom: 8 }}>
              <label className={lbl}>Nombre</label>
              <input className={inp} name="name" required placeholder="General Ballet..." autoFocus/>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label className={lbl}>Tipo</label>
              <select className={inp} name="type" defaultValue="community">
                <option value="community">Comunidad</option>
                <option value="tier">Exclusiva</option>
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label className={lbl}>Tier mínimo</label>
              <select className={inp} name="tier_required" defaultValue="none">
                <option value="none">Sin restricción</option>
                <option value="corps_de_ballet">Corps de Ballet</option>
                <option value="solista">Solista</option>
                <option value="principal">Principal</option>
              </select>
            </div>
            <button type="submit" style={{
              width: "100%", padding: "7px 0", borderRadius: 10, border: "none", cursor: "pointer",
              background: "var(--pink)", color: "#fff", fontSize: 11, fontWeight: 700,
            }}>Crear sala</button>
          </form>
        )}

        {/* Room list */}
        <nav style={{ padding: "8px", flex: 1, overflowY: "auto" }}>
          {accessibleRooms.map((room) => {
            const active = room.id === currentRoom?.id;
            return (
              <div key={room.id} style={{ marginBottom: 2 }}>
                <a
                  href={`/dashboard/community?room=${room.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 10px", borderRadius: 10,
                    background: active ? "linear-gradient(135deg, #fdf2f8, #fce7f3)" : "transparent",
                    border: active ? "1px solid #fbcfe8" : "1px solid transparent",
                    textDecoration: "none",
                    opacity: room.is_archived ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{room.type === "community" ? "🌸" : "💎"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 12, fontWeight: active ? 700 : 500,
                      color: active ? "var(--pink)" : "var(--ink)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
                    }}>{room.name}</span>
                    {isAdmin && room.tier_required !== "none" && (
                      <span style={{ fontSize: 9, color: "var(--muted)" }}>{TIER_LABEL[room.tier_required]}</span>
                    )}
                  </div>
                  {isAdmin && room.is_archived && (
                    <span style={{ fontSize: 8, background: "#fef3c7", color: "#92400e", padding: "1px 5px", borderRadius: 99, fontWeight: 700, flexShrink: 0 }}>ARC</span>
                  )}
                </a>
                {/* Admin archive toggle */}
                {isAdmin && (
                  <form action={archiveRoomAction} style={{ paddingLeft: 34 }}>
                    <input type="hidden" name="id" value={room.id}/>
                    <input type="hidden" name="archived" value={String(room.is_archived)}/>
                    <button type="submit" style={{
                      fontSize: 9, color: "#a8a29e", background: "none", border: "none",
                      cursor: "pointer", padding: "2px 0 4px", fontWeight: 600,
                    }}>{room.is_archived ? "Desarchivar" : "Archivar"}</button>
                  </form>
                )}
              </div>
            );
          })}
          {isAdmin && accessibleRooms.length === 0 && (
            <p style={{ fontSize: 11, color: "var(--muted)", padding: "8px 10px" }}>Tocá + para crear la primera sala.</p>
          )}
        </nav>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid #fce7f3",
          background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #fce7f3, #f9a8d4)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>
            {currentRoom?.type === "community" ? "🌸" : "💎"}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{currentRoom?.name ?? "Comunidad"}</p>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
              {currentRoom?.type === "community"
                ? "Canal abierto a todas las alumnas"
                : `Exclusivo ${TIER_LABEL[currentRoom?.tier_required ?? "none"]}`}
            </p>
          </div>
          {isAdmin && (
            <a href="/admin/chat" style={{
              padding: "6px 14px", borderRadius: 99, textDecoration: "none",
              fontSize: 10, fontWeight: 700, background: "#fdf2f8", color: "var(--pink)",
              border: "1px solid #fce7f3",
            }}>Panel de moderación →</a>
          )}
        </div>

        {currentRoom ? (
          <ChatRoom
            roomId={currentRoom.id}
            userId={user.id}
            isAdmin={isAdmin}
            initialMessages={initialMessages}
            placeholder={`Escribir en ${currentRoom.name}...`}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 32 }}>🌸</p>
            <p style={{ color: "var(--ink)", fontSize: 14, fontWeight: 600 }}>
              {isAdmin ? "Creá la primera sala con el botón +" : "Seleccioná un canal"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
