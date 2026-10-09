import { Desplegable } from "@/components/desplegable";
import Link from "next/link";
import { requireAdmin } from "@/src/features/auth/guards";
import { Archive, ArchiveRestore, Gem, Plus, Shield, Users } from "lucide-react";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminBoton, AdminCabecera } from "@/components/admin-ui";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { ChatRoom, type ChatMessage } from "@/components/chat-room";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export const dynamic = "force-dynamic";

/*
 * LA COMUNIDAD, DEL LADO DE BRUNELA.
 *
 * Esto vivia mezclado en /dashboard/community: la misma pantalla le mostraba a
 * la admin el "+" para crear canales, archivar, las salas archivadas y las de
 * todos los planes, y moderar en cada mensaje. /dashboard/** es ahora SIEMPRE
 * la vista de alumna, identica para todas; gestionar vive aca.
 *
 * Es el mismo codigo que tenia la vista de admin de /dashboard/community, no
 * una reescritura: mismas acciones, mismo ChatRoom, ahora en modo moderacion
 * explicito (`canModerate`).
 */

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

type Room = {
  id: string;
  type: string;
  name: string;
  tier_required: MembershipTier;
  is_archived: boolean;
};

const BASE = "/admin/comunidad";

// ── Acciones ──────────────────────────────────────────────────────────────────

async function createRoomAction(formData: FormData) {
  "use server";
  // Una server action es un endpoint POST publico: que el formulario este en
  // /admin no impide que la llamen. Y esta corre con service_role, que saltea
  // RLS. La guarda va PRIMERO.
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
  if (!parsed.success) redirect(`${BASE}?create=1` as never);
  const { data: creada } = await supabase.from("chat_rooms").insert({
    name: parsed.data.name.trim(),
    type: parsed.data.type,
    tier_required: parsed.data.type === "community" ? "none" : parsed.data.tier_required,
    is_archived: false,
    participant_ids: [],
  }).select("id").maybeSingle<{ id: string }>();
  revalidatePath(BASE);
  revalidatePath("/dashboard/community");
  revalidatePath("/admin/chat");
  redirect((creada ? `${BASE}?room=${creada.id}` : BASE) as never);
}

async function archiveRoomAction(formData: FormData) {
  "use server";
  // Ver createRoomAction.
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  await supabase.from("chat_rooms").update({ is_archived: !archived }).eq("id", id);
  revalidatePath(BASE);
  revalidatePath("/dashboard/community");
  revalidatePath("/admin/chat");
  redirect(`${BASE}?room=${id}` as never);
}

// ── Pagina ────────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<string, string> = {
  none: "Todas", corps_de_ballet: "Corps", solista: "Solista", principal: "Principal",
};

function subtitulo(room: Room) {
  if (room.type === "community" || room.tier_required === "none") return "Para todas";
  return `Desde ${TIER_LABEL[room.tier_required]}`;
}

export default async function AdminComunidadPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const activeRoomId = typeof params.room === "string" ? params.room : null;
  const showCreate = params.create === "1";

  // Como admin, RLS devuelve TODAS las salas: de todos los planes y archivadas.
  // Aca es justo lo que se quiere.
  const { data: roomsData } = await supabase
    .from("chat_rooms")
    .select("id, type, name, tier_required, is_archived")
    .in("type", ["community", "tier"])
    .order("created_at");

  const allRooms = (roomsData ?? []) as Room[];
  const activas = allRooms.filter((r) => !r.is_archived);
  const archivadas = allRooms.filter((r) => r.is_archived);

  const currentRoom = allRooms.find((r) => r.id === activeRoomId) ?? activas[0] ?? null;

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

  const fila = (room: Room) => {
    const active = room.id === currentRoom?.id;
    return (
      <div key={room.id} className={"cm-sala" + (active ? " es-activa" : "") + (room.is_archived ? " es-archivada" : "")}>
        <Link href={`${BASE}?room=${room.id}` as never} className="cm-sala-link" aria-current={active ? "page" : undefined}>
          <span className="cm-sala-ico">
            {room.type === "community" ? <Users size={15} strokeWidth={1.9} /> : <Gem size={15} strokeWidth={1.9} />}
          </span>
          <span className="cm-sala-txt">
            <span className="cm-sala-nombre">{room.name}</span>
            <span className={"cm-sala-sub" + (room.tier_required !== "none" ? " es-plan" : "")}>{subtitulo(room)}</span>
          </span>
        </Link>
        <form action={archiveRoomAction}>
          <input type="hidden" name="id" value={room.id} />
          <input type="hidden" name="archived" value={String(room.is_archived)} />
          <BotonEnviar className="cm-archivar" pendingLabel="…" title={room.is_archived ? "Desarchivar" : "Archivar"}>
            {room.is_archived ? <ArchiveRestore size={14} strokeWidth={2} /> : <Archive size={14} strokeWidth={2} />}
          </BotonEnviar>
        </form>
      </div>
    );
  };

  return (
    <main className="cmA">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Comunidad"
        titulo="Canales del estudio"
        lede="Abrí canales para todas o para un plan, escribí como Brunela y moderá los mensajes pasando el mouse por encima."
        acciones={
          <>
            <AdminBoton href={`${BASE}?create=1${currentRoom ? `&room=${currentRoom.id}` : ""}`} lleno><Plus size={16} strokeWidth={2.4} aria-hidden="true" /> Crear canal</AdminBoton>
            <AdminBoton href="/admin/chat"><Shield size={15} strokeWidth={2.2} aria-hidden="true" /> Baneos y muteos</AdminBoton>
          </>
        }
      />

      <div className="cm">
        {/* ── Canales ── */}
        <aside className="cm-lateral" aria-label="Canales">
          <div className="cm-lateral-cab">
            <div>
              <p className="cm-lateral-titulo">Canales</p>
              <p className="cm-lateral-cuenta">{activas.length} {activas.length === 1 ? "abierto" : "abiertos"}{archivadas.length > 0 ? ` · ${archivadas.length} ${archivadas.length === 1 ? "archivado" : "archivados"}` : ""}</p>
            </div>
            <Link
              href={(showCreate ? `${BASE}${currentRoom ? `?room=${currentRoom.id}` : ""}` : `${BASE}?create=1${currentRoom ? `&room=${currentRoom.id}` : ""}`) as never}
              className={"cm-nuevo" + (showCreate ? " es-abierto" : "")}
              aria-label={showCreate ? "Cerrar" : "Crear un canal"}
              title={showCreate ? "Cerrar" : "Crear un canal"}
            >
              <Plus size={16} strokeWidth={2.4} />
            </Link>
          </div>

          {showCreate && (
            <form action={createRoomAction} className="cm-crear">
              <label className="cm-campo">
                <span>Nombre</span>
                <input name="name" required placeholder="General · Ballet" autoFocus />
              </label>
              <label className="cm-campo">
                <span>Tipo</span>
                <Desplegable name="type" defaultValue="community" opciones={[
                  { value: "community", label: "Comunidad (todas)" },
                  { value: "tier", label: "Exclusiva de un plan" },
                ]} />
              </label>
              <label className="cm-campo">
                <span>Plan mínimo</span>
                <Desplegable name="tier_required" defaultValue="none" opciones={[
                  { value: "none", label: "Sin restricción" },
                  { value: "corps_de_ballet", label: "Corps de Ballet" },
                  { value: "solista", label: "Solista" },
                  { value: "principal", label: "Principal" },
                ]} />
              </label>
              <BotonEnviar className="cm-crear-btn" pendingLabel="Creando…"><Plus size={15} strokeWidth={2.4} aria-hidden="true" /> Crear canal</BotonEnviar>
            </form>
          )}

          <nav className="cm-salas">
            {activas.map(fila)}
            {allRooms.length === 0 && (
              <p className="cm-sin">Todavía no hay canales. Creá el primero con el <strong>+</strong>.</p>
            )}
            {/* Las archivadas, aparte y plegadas: no se ven del lado de la
                alumna, pero se pueden leer y desarchivar. Abiertas si la que
                se esta mirando es una de ellas. */}
            {archivadas.length > 0 && (
              <details className="cm-archivo" open={Boolean(currentRoom?.is_archived)}>
                <summary>Archivados <span>{archivadas.length}</span></summary>
                <div className="cm-archivo-lista">{archivadas.map(fila)}</div>
              </details>
            )}
          </nav>
        </aside>

        {/* ── Conversacion ── */}
        <div className="cm-chat">
          <header className="cm-chat-cab">
            <span className="cm-chat-ico">
              {currentRoom?.type === "tier" ? <Gem size={18} strokeWidth={1.9} /> : <Users size={18} strokeWidth={1.9} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="cm-chat-titulo">{currentRoom?.name ?? "Comunidad"}</p>
              <p className="cm-chat-sub">
                {!currentRoom
                  ? "Elegí un canal para empezar"
                  : currentRoom.is_archived
                    ? "Archivado · las alumnas no lo ven"
                    : currentRoom.type === "community"
                      ? "Canal abierto a todas las alumnas"
                      : `Exclusivo desde ${TIER_LABEL[currentRoom.tier_required]}`}
              </p>
            </div>
            {currentRoom && <span className="cm-modo"><Shield size={13} strokeWidth={2.2} aria-hidden="true" /> Modo moderación</span>}
          </header>

          {currentRoom ? (
            <ChatRoom
              key={currentRoom.id}
              roomId={currentRoom.id}
              userId={user.id}
              isAdmin
              canModerate
              initialMessages={initialMessages}
              placeholder={`Escribir en ${currentRoom.name} como Brunela…`}
            />
          ) : (
            <div className="cm-chat-vacio">
              <span className="cm-chat-vacio-ico"><Users size={28} strokeWidth={1.6} aria-hidden="true" /></span>
              <p className="cm-chat-vacio-titulo">Abrí el primer canal</p>
              <p>Con el + de la izquierda: un canal para todas, o uno exclusivo de un plan.</p>
              <Link href={`${BASE}?create=1` as never} className="ad-btn ad-btn--lleno"><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Crear canal</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const CSS = `
.cmA { display: flex; flex-direction: column; gap: 20px; }
.cm { display: flex; height: calc(100vh - 150px); min-height: 560px; overflow: hidden; background: #fff; border: 1px solid var(--linea); border-radius: 28px; box-shadow: var(--sombra); }
.cm-lateral { width: 290px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid var(--linea); background: linear-gradient(180deg, #FFF8F4 0%, #FFFCFA 100%); }
.cm-lateral-cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 20px 18px 12px; }
.cm-lateral-titulo { font-weight: 900; font-size: 22px; letter-spacing: -0.02em; color: var(--ink); }
.cm-lateral-cuenta { font-size: 12.5px; font-weight: 700; color: var(--muted); margin-top: 2px; }
.cm-nuevo {
  width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; text-decoration: none; flex-shrink: 0;
  background: var(--pink); color: #fff; box-shadow: 0 12px 22px -12px rgba(230,79,85,.85); transition: transform .4s var(--curva), background .2s, color .2s;
}
.cm-nuevo:hover { background: var(--pink-mid); transform: scale(1.06); }
.cm-nuevo.es-abierto { transform: rotate(45deg); background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); border: 1.5px solid var(--linea-fuerte); }
.cm-crear { display: flex; flex-direction: column; gap: 10px; margin: 0 12px 10px; padding: 14px; border-radius: 22px; border: 1px solid var(--linea); background: #fff; box-shadow: var(--sombra); }
.cm-campo { display: flex; flex-direction: column; gap: 5px; }
.cm-campo > span { font-size: 12.5px; font-weight: 800; color: var(--ink); }
.cm-campo input { border-radius: 14px; border: 1.5px solid var(--linea-fuerte); padding: 0.6rem 0.85rem; font-size: 14px; background: #fff; }
.cm-campo input:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); outline: 0; }
.cm-campo .dsp-boton { min-height: 42px; border-color: var(--linea-fuerte); font-size: 14px; }
.cm-crear-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 44px; border-radius: 99px; border: 0; cursor: pointer;
  background: var(--pink); color: #fff; font: inherit; font-size: 14px; font-weight: 800; margin-top: 4px; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85);
}
.cm-salas { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 4px; }
.cm-sala { display: flex; align-items: center; gap: 4px; border-radius: 18px; transition: background .2s, box-shadow .3s; }
.cm-sala:hover { background: rgba(255, 226, 211, 0.45); }
.cm-sala.es-activa { background: #fff; box-shadow: var(--sombra); }
.cm-sala.es-archivada .cm-sala-link { opacity: 0.6; }
.cm-sala form { display: contents; }
.cm-sala-link { flex: 1; min-width: 0; display: flex; align-items: center; gap: 11px; padding: 8px 10px; text-decoration: none; }
.cm-sala-ico { width: 36px; height: 36px; border-radius: 13px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); transition: transform .35s var(--curva); }
.cm-sala:hover .cm-sala-ico { transform: scale(1.06); }
.cm-sala.es-activa .cm-sala-ico { background: var(--pink); color: #fff; box-shadow: 0 8px 16px -8px rgba(230,79,85,.8); }
.cm-sala-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cm-sala-nombre { font-size: 14px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cm-sala.es-activa .cm-sala-nombre { font-weight: 900; }
.cm-sala-sub { align-self: flex-start; padding: 1px 8px; border-radius: 99px; background: #fff; border: 1px solid var(--linea); font-size: 11.5px; font-weight: 800; color: var(--muted); }
.cm-sala-sub.es-plan { background: var(--rubor); border-color: var(--pink-line); color: var(--pink-deep); }
.cm-archivar { width: 32px; height: 32px; margin-right: 6px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; border: 0; background: transparent; color: var(--muted); cursor: pointer; opacity: 0; transition: opacity .2s, background .2s, color .2s; }
.cm-sala:hover .cm-archivar, .cm-sala.es-activa .cm-archivar, .cm-archivar:focus-visible { opacity: 1; }
.cm-archivar:hover { background: var(--rubor); color: var(--pink-deep); }
.cm-sin { margin: 6px 2px; padding: 14px; border-radius: 18px; background: #fff; border: 1.5px dashed var(--linea-fuerte); font-size: 13.5px; line-height: 1.55; color: var(--muted); }
.cm-sin strong { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--pink); color: #fff; font-size: 13px; vertical-align: -3px; }
.cm-archivo { margin-top: 10px; border-top: 1px solid var(--linea); padding-top: 8px; }
.cm-archivo summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 14px; font-size: 13px; font-weight: 800; color: var(--muted); }
.cm-archivo summary::-webkit-details-marker { display: none; }
.cm-archivo summary:hover { background: rgba(255, 226, 211, 0.45); color: var(--pink-deep); }
.cm-archivo summary span { padding: 0 8px; border-radius: 99px; background: #FFF4E8; color: var(--melocoton-deep); font-size: 11.5px; }
.cm-archivo-lista { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }

.cm-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; background: radial-gradient(700px 300px at 100% 0%, rgba(255,226,211,.35), transparent 60%), #fff; }
.cm-chat-cab { display: flex; align-items: center; gap: 14px; padding: 14px 24px; border-bottom: 1px solid var(--linea); background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); flex-shrink: 0; }
.cm-chat-ico { width: 46px; height: 46px; border-radius: 16px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.cm-chat-titulo { font-weight: 900; font-size: 18px; letter-spacing: -0.015em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cm-chat-sub { font-size: 13px; font-weight: 600; color: var(--muted); }
.cm-modo { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; padding: 6px 12px; border-radius: 99px; background: #FFF4E8; color: var(--melocoton-deep); font-size: 12.5px; font-weight: 800; }
.cm-chat-vacio { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; text-align: center; color: var(--muted); font-size: 14.5px; line-height: 1.6; }
.cm-chat-vacio-ico { width: 72px; height: 72px; border-radius: 24px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); margin-bottom: 8px; box-shadow: var(--sombra); animation: cm-flota 4s ease-in-out infinite alternate; }
@keyframes cm-flota { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-6px) rotate(3deg); } }
.cm-chat-vacio-titulo { font-weight: 900; font-size: 23px; letter-spacing: -0.02em; color: var(--ink); }
.cm-chat-vacio .ad-btn { margin-top: 8px; }
@media (max-width: 900px) {
  .cm { flex-direction: column; height: auto; min-height: 0; }
  .cm-lateral { width: auto; border-right: 0; border-bottom: 1px solid var(--linea); max-height: 300px; }
  .cm-chat { height: 72vh; min-height: 460px; }
  .cm-archivar { opacity: 1; }
}
@media (max-width: 640px) { .cm-chat-cab { padding: 12px 16px; } .cm-modo { display: none; } }
@media (prefers-reduced-motion: reduce) { .cm-chat-vacio-ico { animation: none; } }
`;
