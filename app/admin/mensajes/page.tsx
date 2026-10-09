import Link from "next/link";
import { requireAdmin } from "@/src/features/auth/guards";
import { Mail, Search } from "lucide-react";
import { AdminCabecera } from "@/components/admin-ui";
import { Paginacion } from "@/components/paginacion";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { ChatRoom, type ChatMessage } from "@/components/chat-room";

export const dynamic = "force-dynamic";

/*
 * MENSAJES DIRECTOS, DEL LADO DE BRUNELA.
 *
 * Antes era la rama `if (isAdmin)` de /dashboard/chat: la misma URL le
 * mostraba a la alumna su chat con Brunela y a la admin la bandeja con TODAS
 * las alumnas. /dashboard/** es ahora siempre la vista de alumna; la bandeja
 * se mudo aca tal cual -- buscador, filtro por plan, "Ver perfil" y la
 * paginacion acumulativa de alumnas. Mismos parametros: ?user=, ?buscar=,
 * ?plan=, ?pmiembros=.
 */

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

type Profile = { id: string; full_name: string | null; email: string; membership_tier: MembershipTier; is_admin: boolean };

type DmRoom = {
  id: string;
  type: string;
  participant_ids: string[];
};

const BASE = "/admin/mensajes";

/** Alumnas por pagina en la barra lateral de mensajes privados. */
const POR_PAGINA_MIEMBROS = 15;

export default async function AdminMensajesPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const selectedUserId = typeof params.user === "string" ? params.user : null;
  // Barra lateral de alumnas: paginas numeradas, como el resto del sistema
  // (antes era "Ver más" acumulativo). Para encontrar a alguien esta el
  // buscador; las paginas son para recorrer.
  const paginaMiembros = Math.max(0, Math.min(200, Number(params.pmiembros) || 0));
  const buscar = (typeof params.buscar === "string" ? params.buscar : "").trim().slice(0, 80);
  const fPlan = ["none", "corps_de_ballet", "solista", "principal"].includes(String(params.plan)) ? String(params.plan) : "";

  let consultaMiembros = supabase
    .from("profiles")
    .select("id, full_name, email, membership_tier, is_admin", { count: "exact" })
    .eq("is_admin", false);
  if (buscar) {
    const t = buscar.replace(/[,()%]/g, " ");
    consultaMiembros = consultaMiembros.or(`full_name.ilike.%${t}%,email.ilike.%${t}%`);
  }
  if (fPlan) consultaMiembros = consultaMiembros.eq("membership_tier", fPlan as "none");
  const { data: allProfiles, count: totalMiembros } = await consultaMiembros
    .order("created_at", { ascending: false })
    // Fase D: la barra lateral traia TODAS las alumnas del estudio en cada
    // carga. Ahora trae solo la pagina, y `count` dice cuantas hay en total.
    .range(paginaMiembros * POR_PAGINA_MIEMBROS, paginaMiembros * POR_PAGINA_MIEMBROS + POR_PAGINA_MIEMBROS - 1);

  const members = (allProfiles ?? []) as Profile[];
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
    return BASE + (t ? "?" + t : "");
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
    <main className="dmA">
      <style>{CSS_DM}</style>
      <AdminCabecera
        eyebrow="Mensajes"
        titulo="Chat con tus alumnas"
        lede="Conversaciones privadas, una por alumna. Buscala por nombre o correo, o filtrá por plan."
      />
    <div className="dm">
      <aside className="dm-lateral" aria-label="Alumnas">
        <div className="dm-lateral-cab">
          <p className="dm-eyebrow">Mensajes directos</p>
          <p className="dm-lateral-titulo">Alumnas</p>
          {/* El total, no la pagina: `count` cuenta todas las que coinciden. */}
          <p className="dm-cuenta">{totalMiembros ?? members.length} {(totalMiembros ?? members.length) === 1 ? "alumna" : "alumnas"}{filtrando ? " encontradas" : ""}</p>
          <form method="get" action={BASE} className="dm-buscar" role="search">
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
                <Link key={k || "todas"} href={(BASE + (t ? "?" + t : "")) as never} className={"dm-plan" + (fPlan === k ? " es-activo" : "")}>{l}</Link>
              );
            })}
          </nav>
        </div>
        <nav className="dm-lista">
          {members.length === 0 && (
            <div className="dm-sin">
              <p>Ninguna alumna coincide.</p>
              <Link href={BASE} className="dm-mas">Ver todas</Link>
            </div>
          )}
          {members.map((m) => {
            const active = m.id === activeUserId;
            const name = m.full_name?.split(" ")[0] ?? m.email.split("@")[0];
            return (
              <Link key={m.id} href={conFiltros({ user: m.id, pmiembros: paginaMiembros > 0 ? String(paginaMiembros) : "" }) as never} className={"dm-persona" + (active ? " es-activa" : "")} aria-current={active ? "page" : undefined}>
                <span className="dm-ini">{name[0]?.toUpperCase()}</span>
                <span className="dm-persona-txt">
                  <span className="dm-persona-nombre">{name}</span>
                  <span className="dm-persona-plan">{TIER_BADGE[m.membership_tier] ?? "Sin plan"}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        {(totalMiembros ?? 0) > POR_PAGINA_MIEMBROS && (
          <div className="dm-paginas">
            <Paginacion
              compacta
              etiqueta="Páginas de alumnas"
              pagina={paginaMiembros}
              total={totalMiembros ?? 0}
              porPagina={POR_PAGINA_MIEMBROS}
              href={(n) => conFiltros({ pmiembros: n > 0 ? String(n) : "", user: activeUserId ?? "" })}
            />
          </div>
        )}
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
              key={activeRoom.id}
              roomId={activeRoom.id}
              userId={user.id}
              isAdmin
              // Como estaba en /dashboard/chat para la admin: puede borrar,
              // mutear o banear desde la conversacion.
              canModerate
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
    </main>
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
.dmA { display: flex; flex-direction: column; gap: 20px; }
.dm { display: flex; height: calc(100vh - 150px); min-height: 560px; overflow: hidden; background: #fff; border: 1px solid var(--linea); border-radius: 28px; box-shadow: var(--sombra); }
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
.dm-paginas { padding: 10px 12px 12px; border-top: 1px solid var(--linea); display: flex; justify-content: center; }
.dm-mas:hover { background: var(--rubor); border-color: var(--pink-line); }
.dm-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; background: radial-gradient(700px 300px at 100% 0%, rgba(255,226,211,.35), transparent 60%), #fff; }
.dm-cab { display: flex; align-items: center; gap: 14px; padding: 14px 24px; border-bottom: 1px solid var(--linea); background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); flex-shrink: 0; }
.dm-perfil { margin-left: auto; flex-shrink: 0; padding: 9px 16px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 13px; font-weight: 800; text-decoration: none; transition: background .2s; }
.dm-perfil:hover { background: var(--pink-wash); }
.dm-cab-ini { width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: linear-gradient(135deg, var(--melocoton), var(--pink-soft)); color: var(--pink-deep); font-weight: 900; font-size: 18px; border: 3px solid #fff; box-shadow: var(--sombra); }
.dm-cab-nombre { margin: 0; font-weight: 900; font-size: 18px; letter-spacing: -0.015em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-cab-sub { font-size: 13px; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-vacio { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 32px; text-align: center; color: var(--muted); font-size: 14.5px; line-height: 1.6; }
.dm-vacio > p:not(.dm-vacio-titulo) { max-width: 44ch; }
.dm-vacio-ico { width: 72px; height: 72px; border-radius: 24px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); margin-bottom: 10px; box-shadow: var(--sombra); animation: dm-flota 4s ease-in-out infinite alternate; }
@keyframes dm-flota { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-6px) rotate(3deg); } }
.dm-vacio-titulo { font-weight: 900; font-size: 23px; letter-spacing: -0.02em; color: var(--ink); }
@media (max-width: 900px) {
  .dm { flex-direction: column; height: auto; min-height: 0; }
  .dm-lateral { width: auto; border-right: 0; border-bottom: 1px solid var(--linea); max-height: 520px; }
  .dm-chat { height: 72vh; min-height: 460px; }
}
@media (max-width: 640px) { .dm-cab { padding: 12px 16px; } .dm-perfil { padding: 8px 12px; } }
@media (prefers-reduced-motion: reduce) { .dm-vacio-ico { animation: none; } }
`;

