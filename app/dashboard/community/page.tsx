import Link from "next/link";
import { requireUser, requireAdmin } from "@/src/features/auth/guards";
import { Users, Gem } from "lucide-react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
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
  // Una server action es un endpoint POST publico: que el formulario se
  // renderice bajo {isAdmin && ...} no impide que la llamen. Y esta corre con
  // service_role, que saltea RLS.
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
  // Ver createRoomAction.
  await requireAdmin();
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

  const profile = await getCurrentProfile(user.id);

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
    // Newest 100, re-sorted oldest-first for display. Ordering ascending and
    // then limiting would pin the room to its first 100 messages forever.
    const { data } = await supabase
      .from("chat_messages")
      .select("*, profiles(full_name, email, is_admin)")
      .eq("room_id", currentRoom.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(100);
    initialMessages = ((data ?? []) as unknown as ChatMessage[]).reverse();
  }

  if (!isAdmin && accessibleRooms.length === 0) {
    return (
      <main className="pb-20 pt-6 md:pb-28 md:pt-10">
        <section className="page-shell space-y-6">
          <div className="hero-stage">
            <p className="eyebrow">Comunidad</p>
            <h1 className="display mt-5 text-5xl leading-none md:text-6xl">
              Chat <span style={{ color: "var(--pink)", fontStyle: "italic" }}>del estudio.</span>
            </h1>
            {/* El chat de comunidad ESTA construido y funcionando: salas, tiempo
                real y moderacion. Lo unico que falta son los canales, que los
                abre Brunela desde /admin/chat. Decir "estara disponible pronto"
                era mentirle a la alumna sobre la causa. */}
            <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
              Todavía no hay canales abiertos para tu plan.
            </p>
          </div>

          <div style={{
            borderRadius: 26, border: "1.5px dashed var(--pink-soft)",
            background: "#fff", padding: "56px 32px", textAlign: "center",
          }}>
            <div style={{
              width: 96, height: 96, borderRadius: "50%", margin: "0 auto 26px",
              background: "var(--pink-wash)", color: "var(--pink)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="42" height="42" viewBox="0 0 16 16" fill="none">
                <path d="M2.5 3.5h11c.28 0 .5.22.5.5v6c0 .28-.22.5-.5.5H7L4 13V10.5H2.5c-.28 0-.5-.22-.5-.5V4c0-.28.22-.5.5-.5z"
                  stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
              </svg>
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "var(--pink)", textTransform: "uppercase", marginBottom: 14 }}>
              Sin canales
            </p>
            <h2 className="display" style={{ fontSize: 30, lineHeight: 1.25, color: "var(--ink)" }}>
              Acá van a estar<br />
              <span style={{ color: "var(--pink)", fontStyle: "italic" }}>los canales del estudio.</span>
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 14, lineHeight: 1.7 }}>
              Cuando Brunela abra un canal para tu plan, lo vas a ver acá<br />
              y vas a poder escribir con las demás alumnas.
            </p>

            {/* En vez de "te avisaremos": una salida que SI existe hoy. */}
            <Link href={"/dashboard/chat" as never} style={{
              display: "inline-flex", alignItems: "center", gap: 9, marginTop: 26,
              background: "var(--pink)", color: "#fff", textDecoration: "none",
              padding: "13px 26px", borderRadius: 999, fontSize: 13.5, fontWeight: 700,
            }}>
              Mientras tanto, escribile a Brunela
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "var(--font-body), sans-serif" }}>

      {/* Sidebar */}
      <div className="chat-col-sidebar" style={{
        width: 230, flexShrink: 0, borderRight: "1px solid var(--pink-soft)",
        background: "linear-gradient(180deg, #fff 0%, #fffbfd 100%)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid var(--pink-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "var(--pink)" }}>CANALES</p>
          {isAdmin && (
            <Link
              href={showCreate ? "/dashboard/community" : "/dashboard/community?create=1"}
              style={{
                width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
                background: showCreate ? "var(--pink)" : "var(--pink-wash)", color: showCreate ? "#fff" : "var(--pink)",
                fontSize: 14, fontWeight: 700, textDecoration: "none", border: "1px solid var(--pink-soft)",
              }}
            >{showCreate ? "×" : "+"}</Link>
          )}
        </div>

        {/* Admin create form */}
        {isAdmin && showCreate && (
          <form action={createRoomAction} style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--pink-soft)", background: "var(--pink-wash)" }}>
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
                <Link
                  href={`/dashboard/community?room=${room.id}` as never}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 10px", borderRadius: 10,
                    background: active ? "linear-gradient(135deg, var(--pink-wash), var(--pink-soft))" : "transparent",
                    border: active ? "1px solid var(--pink-line)" : "1px solid transparent",
                    textDecoration: "none",
                    opacity: room.is_archived ? 0.5 : 1,
                  }}
                >
                  {room.type === "community" ? <Users size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} /> : <Gem size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />}
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
                </Link>
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
          padding: "16px 24px", borderBottom: "1px solid var(--pink-soft)",
          background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, var(--pink-soft), var(--rose))",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>
            {currentRoom?.type === "community" ? <Users size={16} strokeWidth={1.8} /> : <Gem size={16} strokeWidth={1.8} />}
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
            <Link href={"/admin/chat" as never} style={{
              padding: "6px 14px", borderRadius: 99, textDecoration: "none",
              fontSize: 10, fontWeight: 700, background: "var(--pink-wash)", color: "var(--pink)",
              border: "1px solid var(--pink-soft)",
            }}>Panel de moderación →</Link>
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
            <Users size={30} strokeWidth={1.5} style={{ color: "var(--pink)" }} />
            <p style={{ color: "var(--ink)", fontSize: 14, fontWeight: 600 }}>
              {isAdmin ? "Creá la primera sala con el botón +" : "Seleccioná un canal"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
