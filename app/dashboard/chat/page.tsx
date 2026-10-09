import Link from "next/link";
import { requireUser } from "@/src/features/auth/guards";
import { AlertCircle, Lock, Mail, Search } from "lucide-react";
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
  // Buscador y filtro de plan de la barra de alumnas (vista admin).
  const buscar = (typeof params.buscar === "string" ? params.buscar : "").trim().slice(0, 80);
  const fPlan = ["none", "corps_de_ballet", "solista", "principal"].includes(String(params.plan)) ? String(params.plan) : "";

  const profile = await getCurrentProfile(user.id);

  const isAdmin = profile?.is_admin ?? false;

  // ─── ADMIN VIEW ───────────────────────────────────────────────
  if (isAdmin) {
    let consultaMiembros = supabase
      .from("profiles")
      .select("id, full_name, email, membership_tier, is_admin")
      .eq("is_admin", false);
    if (buscar) {
      const t = buscar.replace(/[,()%]/g, " ");
      consultaMiembros = consultaMiembros.or(`full_name.ilike.%${t}%,email.ilike.%${t}%`);
    }
    if (fPlan) consultaMiembros = consultaMiembros.eq("membership_tier", fPlan as "none");
    const { data: allProfiles } = await consultaMiembros
      .order("created_at", { ascending: false })
      // Fase D: la barra lateral traia TODAS las alumnas del estudio en cada
      // carga. Se pide una de mas para saber si hay siguiente sin contar.
      .range(0, POR_PAGINA_MIEMBROS * (paginaMiembros + 1));

    const crudas = (allProfiles ?? []) as Profile[];
    const hayMasMiembros = crudas.length > POR_PAGINA_MIEMBROS * (paginaMiembros + 1);
    const members = crudas.slice(0, POR_PAGINA_MIEMBROS * (paginaMiembros + 1));
    // La conversacion abierta sigue abierta aunque la busqueda no la incluya:
    // si no, escribir en el buscador cerraba el chat que estaba leyendo.
    if (selectedUserId && !members.some((m) => m.id === selectedUserId)) {
      const { data: abierta } = await supabase
        .from("profiles")
        .select("id, full_name, email, membership_tier, is_admin")
        .eq("id", selectedUserId).eq("is_admin", false).maybeSingle();
      if (abierta) members.push(abierta as Profile);
    }
    const filtrando = Boolean(buscar || fPlan);
    const conFiltros = (extra: Record<string, string>) => {
      const u = new URLSearchParams();
      if (buscar) u.set("buscar", buscar);
      if (fPlan) u.set("plan", fPlan);
      for (const [k, v] of Object.entries(extra)) if (v) u.set(k, v);
      const t = u.toString();
      return "/dashboard/chat" + (t ? "?" + t : "");
    };

    const activeUserId = selectedUserId ?? (filtrando ? null : members[0]?.id ?? null);
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
        // Si hubiera duplicadas (se crearon al cargar la pagina en paralelo),
        // siempre la mas vieja: es la que tiene la conversacion.
        .order("created_at", { ascending: true })
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
            <p className="dm-cuenta">{members.length} {hayMasMiembros ? "cargadas" : members.length === 1 ? "alumna" : "alumnas"}{filtrando ? " encontradas" : ""}</p>
            <form method="get" action="/dashboard/chat" className="dm-buscar" role="search">
              {activeUserId && <input type="hidden" name="user" value={activeUserId} />}
              {fPlan && <input type="hidden" name="plan" value={fPlan} />}
              <Search size={16} strokeWidth={2} aria-hidden="true" />
              <input type="search" name="buscar" defaultValue={buscar} placeholder="Buscar alumna o correo" aria-label="Buscar alumna" />
            </form>
            <nav className="dm-planes" aria-label="Filtrar por plan">
              {[["", "Todas"], ["principal", "Principal"], ["solista", "Solista"], ["corps_de_ballet", "Corps"], ["none", "Sin plan"]].map(([k, l]) => {
                const u = new URLSearchParams();
                if (buscar) u.set("buscar", buscar);
                if (k) u.set("plan", k);
                if (activeUserId) u.set("user", activeUserId);
                const t = u.toString();
                return (
                  <Link key={k || "todas"} href={("/dashboard/chat" + (t ? "?" + t : "")) as never} className={"dm-plan" + (fPlan === k ? " es-activo" : "")}>{l}</Link>
                );
              })}
            </nav>
          </div>
          <nav className="dm-lista">
            {members.length === 0 && (
              <div className="dm-sin">
                <p>Ninguna alumna coincide.</p>
                <Link href="/dashboard/chat" className="dm-mas">Ver todas</Link>
              </div>
            )}
            {members.map((m) => {
              const active = m.id === activeUserId;
              const name = m.full_name?.split(" ")[0] ?? m.email.split("@")[0];
              return (
                <Link key={m.id} href={conFiltros({ user: m.id }) as never} className={"dm-persona" + (active ? " es-activa" : "")} aria-current={active ? "page" : undefined}>
                  <span className="dm-ini">{name[0]?.toUpperCase()}</span>
                  <span className="dm-persona-txt">
                    <span className="dm-persona-nombre">{name}</span>
                    <span className="dm-persona-plan">{TIER_BADGE[m.membership_tier] ?? "Sin plan"}</span>
                  </span>
                </Link>
              );
            })}
            {hayMasMiembros && (
              <Link href={conFiltros({ pmiembros: String(paginaMiembros + 1), user: activeUserId ?? "" }) as never} className="dm-mas">
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
                {/* Su perfil: progreso, reservas, plan, invitaciones. */}
                <Link href={`/admin/users/${activeMember.id}` as never} className="dm-perfil">Ver perfil</Link>
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
.dm-buscar { display: flex; align-items: center; gap: 8px; height: 42px; margin-top: 12px; padding: 0 14px; border-radius: 99px; background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--muted); transition: border-color .2s, box-shadow .2s; }
.dm-buscar:focus-within { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); color: var(--pink-deep); }
.dm-buscar input { flex: 1; min-width: 0; border: 0; outline: none; background: none; font: inherit; font-size: 13.5px; color: var(--ink); }
.dm-planes { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.dm-plan { padding: 5px 11px; border-radius: 99px; font-size: 12px; font-weight: 800; text-decoration: none; color: var(--muted); background: #fff; border: 1px solid var(--linea); transition: background .2s, color .2s; }
.dm-plan:hover { background: var(--rubor); color: var(--pink-deep); }
.dm-plan.es-activo { background: var(--pink); border-color: var(--pink); color: #fff; }
.dm-sin { padding: 18px 8px; text-align: center; font-size: 13.5px; color: var(--muted); display: flex; flex-direction: column; gap: 6px; }
.dm { display: flex; height: 100vh; overflow: hidden; background: #fff; }
.dm-lateral { width: 280px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid var(--linea); background: linear-gradient(180deg, #FFF8F4 0%, #FFFCFA 100%); }
.dm-lateral-cab { padding: 22px 18px 14px; }
.dm-eyebrow { display: inline-flex; padding: 4px 11px; border-radius: 99px; background: #fff; box-shadow: var(--sombra); font-size: 12px; font-weight: 800; color: var(--pink-deep); }
.dm-lateral-titulo { margin-top: 10px; font-weight: 900; font-size: 24px; letter-spacing: -0.02em; color: var(--ink); }
.dm-cuenta { font-size: 12.5px; font-weight: 700; color: var(--muted); margin-top: 2px; }
.dm-lista { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 4px; }
.dm-persona { display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: 18px; text-decoration: none; transition: background .2s, box-shadow .3s, transform .3s var(--curva); }
.dm-persona:hover { background: rgba(255, 226, 211, 0.45); }
.dm-persona.es-activa { background: #fff; box-shadow: var(--sombra); }
.dm-ini { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: linear-gradient(135deg, var(--melocoton), var(--pink-soft)); font-weight: 900; color: var(--pink-deep); }
.dm-persona.es-activa .dm-ini { background: var(--pink); color: #fff; box-shadow: 0 8px 16px -8px rgba(230,79,85,.8); }
.dm-persona-txt { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.dm-persona-nombre { font-size: 14px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-persona.es-activa .dm-persona-nombre { font-weight: 900; }
.dm-persona-plan { align-self: flex-start; padding: 1px 8px; border-radius: 99px; background: var(--rubor); font-size: 11.5px; font-weight: 800; color: var(--pink-deep); }
.dm-mas { margin: 8px 4px 4px; height: 42px; display: grid; place-items: center; border-radius: 99px; text-decoration: none; font-size: 13.5px; font-weight: 800; color: var(--ink); background: #fff; border: 1.5px solid var(--linea-fuerte); transition: background .2s, border-color .2s; }
.dm-mas:hover { background: var(--rubor); border-color: var(--pink-line); }
.dm-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; background: radial-gradient(700px 300px at 100% 0%, rgba(255,226,211,.35), transparent 60%), #fff; }
.dm-cab { display: flex; align-items: center; gap: 14px; padding: 14px 24px; border-bottom: 1px solid var(--linea); background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); flex-shrink: 0; }
.dm-perfil { margin-left: auto; flex-shrink: 0; padding: 9px 16px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 13px; font-weight: 800; text-decoration: none; transition: background .2s; }
.dm-perfil:hover { background: var(--pink-wash); }
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

