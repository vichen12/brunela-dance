import Link from "next/link";
import { requireUser } from "@/src/features/auth/guards";
import { AlertCircle, Lock, Mail } from "lucide-react";
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

/** Alumnas por tanda en la barra lateral de mensajes privados. */
const POR_PAGINA_MIEMBROS = 40;

export default async function ChatPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const selectedUserId = typeof params.user === "string" ? params.user : null;
  // Barra lateral de alumnas: acumulativa, como la biblioteca. Se recorre
  // buscando a alguien, asi que perder las anteriores al pedir mas seria peor.
  const paginaMiembros = Math.max(0, Math.min(200, Number(params.pmiembros) || 0));

  const profile = await getCurrentProfile(user.id);

  const isAdmin = profile?.is_admin ?? false;

  // ─── ADMIN VIEW ───────────────────────────────────────────────
  if (isAdmin) {
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_tier, is_admin")
      .eq("is_admin", false)
      .order("created_at", { ascending: false })
      // Fase D: la barra lateral traia TODAS las alumnas del estudio en cada
      // carga. Se pide una de mas para saber si hay siguiente sin contar.
      .range(0, POR_PAGINA_MIEMBROS * (paginaMiembros + 1));

    const crudas = (allProfiles ?? []) as Profile[];
    const hayMasMiembros = crudas.length > POR_PAGINA_MIEMBROS * (paginaMiembros + 1);
    const members = crudas.slice(0, POR_PAGINA_MIEMBROS * (paginaMiembros + 1));

    const activeUserId = selectedUserId ?? members[0]?.id ?? null;
    let activeRoom: DmRoom | null = null;

    if (activeUserId) {
      // Antes se traian TODAS las salas de DM -- una por alumna -- y se buscaba
      // la correcta en memoria. Ahora se pide directamente la que corresponde:
      // `.contains()` es un `@>` que va contra idx_chat_rooms_participant_ids,
      // el indice GIN que ya existe. Deja de importar cuantas salas haya.
      const { data: encontrada } = await supabase
        .from("chat_rooms")
        .select("id, type, participant_ids")
        .eq("type", "dm")
        .contains("participant_ids", [user.id, activeUserId])
        .limit(1)
        .maybeSingle<DmRoom>();

      activeRoom = encontrada ?? null;

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
        .select("*, profiles(full_name, email, is_admin)")
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
      <div className="dm">
        <style>{CSS_DM}</style>
        <aside className="chat-col-sidebar dm-lateral" aria-label="Alumnas">
          <div className="dm-lateral-cab">
            <p className="dm-eyebrow">Mensajes directos</p>
            <p className="dm-lateral-titulo">Alumnas</p>
            {/* "cargadas" y no "alumnas" a secas: la lista esta paginada, asi
                que este numero es lo que se ve, no el total del estudio. */}
            <p className="dm-cuenta">{members.length} {hayMasMiembros ? "cargadas" : members.length === 1 ? "alumna" : "alumnas"}</p>
          </div>
          <nav className="dm-lista">
            {members.map((m) => {
              const active = m.id === activeUserId;
              const name = m.full_name?.split(" ")[0] ?? m.email.split("@")[0];
              return (
                <Link key={m.id} href={`/dashboard/chat?user=${m.id}` as never} className={"dm-persona" + (active ? " es-activa" : "")} aria-current={active ? "page" : undefined}>
                  <span className="dm-ini">{name[0]?.toUpperCase()}</span>
                  <span className="dm-persona-txt">
                    <span className="dm-persona-nombre">{name}</span>
                    <span className="dm-persona-plan">{TIER_BADGE[m.membership_tier] ?? "Sin plan"}</span>
                  </span>
                </Link>
              );
            })}
            {hayMasMiembros && (
              <Link href={`/dashboard/chat?pmiembros=${paginaMiembros + 1}${activeUserId ? `&user=${activeUserId}` : ""}` as never} className="dm-mas">
                Ver más alumnas
              </Link>
            )}
          </nav>
        </aside>

        <div className="dm-chat">
          {activeRoom && activeMember ? (
            <>
              <header className="dm-cab">
                <span className="dm-cab-ini">{(activeMember.full_name ?? activeMember.email)[0]?.toUpperCase()}</span>
                <div style={{ minWidth: 0 }}>
                  <p className="dm-cab-nombre">{activeMember.full_name ?? activeMember.email.split("@")[0]}</p>
                  <p className="dm-cab-sub">{activeMember.email} · {TIER_BADGE[activeMember.membership_tier] ?? "Sin plan"}</p>
                </div>
              </header>
              <ChatRoom
                roomId={activeRoom.id}
                userId={user.id}
                isAdmin={true}
                initialMessages={initialMessages}
                placeholder={`Escribirle a ${activeMember.full_name?.split(" ")[0] ?? "alumna"}…`}
              />
            </>
          ) : (
            <div className="dm-vacio">
              <span className="dm-vacio-ico"><Mail size={28} strokeWidth={1.6} aria-hidden="true" /></span>
              <p className="dm-vacio-titulo">Elegí una alumna</p>
              <p>Los mensajes son privados entre vos y cada alumna.</p>
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
.dm-lateral { width: 270px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid #F6E7E1; background: #FFFAF6; }
.dm-lateral-cab { padding: 22px 18px 16px; border-bottom: 1px solid #F6E7E1; }
.dm-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--pink-deep); }
.dm-lateral-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.03em; color: var(--ink); }
.dm-cuenta { font-size: 12px; color: #B39189; margin-top: 2px; }
.dm-lista { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 10px; display: flex; flex-direction: column; gap: 2px; }
.dm-persona { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 14px; text-decoration: none; transition: background .2s; }
.dm-persona:hover { background: #FBF0EB; }
.dm-persona.es-activa { background: var(--pink-wash); }
.dm-ini { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #F6E7E1; font-weight: 800; color: var(--pink-deep); }
.dm-persona.es-activa .dm-ini { background: var(--pink); border-color: var(--pink); color: #fff; }
.dm-persona-txt { min-width: 0; display: flex; flex-direction: column; }
.dm-persona-nombre { font-size: 13.5px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-persona.es-activa .dm-persona-nombre { font-weight: 800; color: var(--pink-deep); }
.dm-persona-plan { font-size: 11.5px; color: #B39189; }
.dm-mas { margin: 8px 4px 4px; padding: 10px; border-radius: 12px; text-align: center; text-decoration: none; font-size: 12.5px; font-weight: 700; color: var(--pink-deep); border: 1.5px solid var(--pink-line); }
.dm-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dm-cab { display: flex; align-items: center; gap: 14px; padding: 16px 24px; border-bottom: 1px solid #F6E7E1; background: rgba(255,255,255,0.92); backdrop-filter: blur(10px); flex-shrink: 0; }
.dm-cab-ini { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--pink-wash); color: var(--pink-deep); font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 17px; }
.dm-cab-ini--brunela { background: var(--pink); color: #fff; box-shadow: 0 8px 18px -10px rgba(230,79,85,0.8); }
.dm-cab-nombre { margin: 0; font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 18px; letter-spacing: -0.025em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-cab-sub { font-size: 12.5px; color: #8A6F68; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-vacio { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 32px; text-align: center; color: #8A6F68; font-size: 14px; line-height: 1.6; }
.dm-vacio > p:not(.dm-vacio-titulo) { max-width: 44ch; }
.dm-vacio-ico { width: 64px; height: 64px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; background: var(--pink-wash); color: var(--pink-deep); margin-bottom: 8px; }
.dm-vacio-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.03em; color: var(--ink); }
.dm-vacio-acciones { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
`;

