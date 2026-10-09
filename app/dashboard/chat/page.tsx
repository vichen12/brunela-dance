import Link from "next/link";
import { requireUser } from "@/src/features/auth/guards";
import { AlertCircle, Lock, MessageCircleHeart } from "lucide-react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getDmAccess, tierCanStartDm } from "@/src/features/admin/chat-settings";
import { ChatRoom, type ChatMessage } from "@/components/chat-room";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";


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
  // Los enlaces viejos del panel apuntaban a /dashboard/chat?user=<id>. Si una
  // admin llega con uno, se la lleva a la conversacion en /admin/mensajes.
  const selectedUserId = typeof params.user === "string" ? params.user : null;

  const profile = await getCurrentProfile(user.id);

  const isAdmin = profile?.is_admin ?? false;

  if (isAdmin && selectedUserId) {
    redirect(`/admin/mensajes?user=${encodeURIComponent(selectedUserId)}` as never);
  }

  // /dashboard/** ES LA VISTA DE ALUMNA, identica para todas -- admin incluida.
  //
  // Antes, si era admin, esta pantalla mostraba la bandeja con TODAS las
  // alumnas. Esa bandeja se mudo entera a /admin/mensajes. Del lado de alumna
  // la admin no tiene una "Brunela" con quien hablar, asi que se le dice donde
  // estan sus mensajes en vez de abrirle un DM consigo misma.
  if (isAdmin) {
    return (
      <div className="dm dm--alumna">
        <style>{CSS_DM}</style>
        <div className="dm-chat">
          <div className="dm-vacio">
            <span className="dm-vacio-ico"><MessageCircleHeart size={28} strokeWidth={1.7} aria-hidden="true" /></span>
            <h1 className="dm-vacio-titulo">Los mensajes con tus alumnas están en el panel</h1>
            <p>Acá cada alumna habla con vos. Para leerlas y responderles, entrá a Mensajes en el panel de admin.</p>
            <div className="dm-vacio-acciones">
              <Link href={"/admin/mensajes" as never} className="ad-btn ad-btn--lleno"><MessageCircleHeart size={16} strokeWidth={2} aria-hidden="true" /> Ir a Mensajes</Link>
            </div>
          </div>
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
      // limit(1) y la mas vieja. Con maybeSingle() a secas, si ya habia DOS
      // salas la consulta daba error, se leia como "no hay sala" y se creaba
      // una TERCERA: cada visita agrandaba el problema.
      .order("created_at", { ascending: true })
      .limit(1)
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
        .select("*, profiles(full_name, email, is_admin)")
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
    <div className="dm dm--alumna">
      <style>{CSS_DM}</style>
      <div className="dm-chat">
        <header className="dm-cab">
          <span className="dm-cab-ini dm-cab-ini--brunela">B</span>
          <div style={{ minWidth: 0 }}>
            {/* h1: es el encabezado de la pantalla. Un lector de pantalla
                entraba al chat sin saber donde estaba. */}
            <h1 className="dm-cab-nombre">Brunela</h1>
            {/* Antes habia un "EN LINEA" verde fijo. No hay sistema de
                presencia: decia que Brunela estaba conectada aunque no. */}
            <p className="dm-cab-sub">Tu instructora · responde en menos de 24 h</p>
          </div>
        </header>

        {dmRoom ? (
          <ChatRoom
            roomId={dmRoom.id}
            userId={user.id}
            isAdmin={false}
            initialMessages={initialMessages}
            placeholder="Escribile a Brunela…"
            // Sin esto los mensajes de Brunela se ven como "Usuario": la RLS no
            // deja a la alumna leer el perfil de la admin.
            interlocutor={interlocutorDeLaAlumna}
          />
        ) : !canStartDm ? (
          // Este plan no puede iniciar un chat directo con Brunela.
          <div className="dm-vacio">
            <span className="dm-vacio-ico"><Lock size={26} strokeWidth={1.7} aria-hidden="true" /></span>
            {/* Que planes pueden escribir lo decide Brunela en Configuracion: el texto
                no nombra ninguno para no quedar desactualizado. */}
            <p className="dm-vacio-titulo">El chat directo no está en tu plan</p>
            <p>Con un plan superior le escribís a Brunela uno a uno, con acompañamiento personalizado. Mientras tanto, podés escribir en la comunidad.</p>
            <div className="dm-vacio-acciones">
              <Link href="/dashboard/plan" className="ad-btn ad-btn--lleno">Ver planes</Link>
              <Link href={"/dashboard/community" as never} className="ad-btn">Ir a la comunidad</Link>
            </div>
          </div>
        ) : (
          // Ultimo recurso. Antes decia "Cargando chat..." para siempre, que es
          // como un fallo real paso meses pareciendo una pagina lenta.
          <div className="dm-vacio">
            <span className="dm-vacio-ico"><AlertCircle size={26} strokeWidth={1.7} aria-hidden="true" /></span>
            <p className="dm-vacio-titulo">No pudimos abrir tu conversación</p>
            <p>Volvé a cargar la página. Si sigue pasando, es un problema nuestro, no de tu plan ni de tu cuenta.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const CSS_DM = `
.dm { display: flex; height: 100vh; overflow: hidden; background: #fff; }
.dm-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; background: radial-gradient(700px 300px at 100% 0%, rgba(255,226,211,.35), transparent 60%), #fff; }
.dm-cab { display: flex; align-items: center; gap: 14px; padding: 14px 24px; border-bottom: 1px solid var(--linea); background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); flex-shrink: 0; }
.dm-cab-ini { width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: linear-gradient(135deg, var(--melocoton), var(--pink-soft)); color: var(--pink-deep); font-weight: 900; font-size: 18px; border: 3px solid #fff; box-shadow: var(--sombra); }
.dm-cab-ini--brunela { background: linear-gradient(135deg, #F38A6C, var(--pink)); color: #fff; box-shadow: 0 10px 20px -10px rgba(230,79,85,0.85); }
.dm-cab-nombre { margin: 0; font-weight: 900; font-size: 18px; letter-spacing: -0.015em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-cab-sub { font-size: 13px; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-vacio { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 32px; text-align: center; color: var(--muted); font-size: 14.5px; line-height: 1.6; }
.dm-vacio > p:not(.dm-vacio-titulo) { max-width: 44ch; }
.dm-vacio-ico { width: 72px; height: 72px; border-radius: 24px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); margin-bottom: 10px; box-shadow: var(--sombra); animation: dm-flota 4s ease-in-out infinite alternate; }
@keyframes dm-flota { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-6px) rotate(3deg); } }
.dm-vacio-titulo { font-weight: 900; font-size: 23px; letter-spacing: -0.02em; color: var(--ink); }
.dm-vacio-acciones { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 14px; }
@media (max-width: 640px) { .dm-cab { padding: 12px 16px; } }
@media (prefers-reduced-motion: reduce) { .dm-vacio-ico { animation: none; } }
`;

