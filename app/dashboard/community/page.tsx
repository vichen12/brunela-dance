import { Desplegable } from "@/components/desplegable";
import Link from "next/link";
import { requireUser, requireAdmin } from "@/src/features/auth/guards";
import { Archive, ArchiveRestore, Gem, MessageCircle, Plus, Shield, Users } from "lucide-react";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminBoton, AdminCabecera, AdminGuia } from "@/components/admin-ui";
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
      <main className="cm-vacio">
        <style>{CSS}</style>
        <section className="cm-shell">
          {/* El chat de comunidad ESTA construido y funcionando: salas, tiempo
              real y moderacion. Lo unico que falta son los canales, que los
              abre Brunela desde /admin/chat. Decir "estara disponible pronto"
              era mentirle a la alumna sobre la causa. */}
          <AdminCabecera
            eyebrow="Comunidad"
            titulo="El chat del estudio"
            lede="Canales para escribir con las demás alumnas de tu plan. Todavía no hay ninguno abierto para el tuyo."
          />
          <AdminGuia
            rotuloEjemplo="Así se ve un canal"
            ejemplo={
              <div className="ad-guia-flota cm-ejemplo">
                <div className="cm-ejemplo-cab"><Users size={15} strokeWidth={2} /> General · Ballet</div>
                <div className="cm-burbuja" style={{ animationDelay: "0.3s" }}><strong>Sofía</strong>¿Alguien más con el día 3 de pies? Me cuesta el relevé 😅</div>
                <div className="cm-burbuja es-brunela" style={{ animationDelay: "0.6s" }}><strong>Brunela</strong>Apoyá bien el metatarso antes de subir, sin apuro.</div>
                <div className="cm-burbuja es-mia" style={{ animationDelay: "0.9s" }}>¡Gracias! Mañana lo pruebo.</div>
              </div>
            }
            eyebrow="Sin canales todavía"
            titulo="Cuando Brunela abra uno, aparece acá."
            pasos={[
              { icono: <Users size={18} strokeWidth={2} />, titulo: "Canales por plan", texto: "Escribís con las alumnas que entrenan en tu mismo nivel." },
              { icono: <MessageCircle size={18} strokeWidth={2} />, titulo: "En tiempo real", texto: "Los mensajes llegan al instante, sin recargar." },
              { icono: <Shield size={18} strokeWidth={2} />, titulo: "Moderado por Brunela", texto: "Un espacio cuidado para entrenar en compañía." },
            ]}
            cta={<AdminBoton href="/dashboard/chat" lleno><MessageCircle size={16} strokeWidth={2} aria-hidden="true" /> Mientras tanto, escribile a Brunela</AdminBoton>}
          />
        </section>
      </main>
    );
  }

  return (
    <div className="cm">
      <style>{CSS}</style>

      {/* ── Canales ── */}
      <aside className="chat-col-sidebar cm-lateral" aria-label="Canales">
        <div className="cm-lateral-cab">
          <div>
            <p className="cm-eyebrow">Comunidad</p>
            <p className="cm-lateral-titulo">Canales</p>
          </div>
          {isAdmin && (
            <Link
              href={(showCreate ? "/dashboard/community" : "/dashboard/community?create=1") as never}
              className={"cm-nuevo" + (showCreate ? " es-abierto" : "")}
              aria-label={showCreate ? "Cerrar" : "Crear un canal"}
              title={showCreate ? "Cerrar" : "Crear un canal"}
            >
              <Plus size={16} strokeWidth={2.4} />
            </Link>
          )}
        </div>

        {isAdmin && showCreate && (
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
          {accessibleRooms.map((room) => {
            const active = room.id === currentRoom?.id;
            return (
              <div key={room.id} className={"cm-sala" + (active ? " es-activa" : "") + (room.is_archived ? " es-archivada" : "")}>
                <Link href={`/dashboard/community?room=${room.id}` as never} className="cm-sala-link" aria-current={active ? "page" : undefined}>
                  <span className="cm-sala-ico">
                    {room.type === "community" ? <Users size={15} strokeWidth={1.9} /> : <Gem size={15} strokeWidth={1.9} />}
                  </span>
                  <span className="cm-sala-txt">
                    <span className="cm-sala-nombre">{room.name}</span>
                    {(isAdmin && room.tier_required !== "none") || room.is_archived ? (
                      <span className="cm-sala-sub">
                        {room.is_archived ? "Archivado" : `Desde ${TIER_LABEL[room.tier_required]}`}
                      </span>
                    ) : null}
                  </span>
                </Link>
                {isAdmin && (
                  <form action={archiveRoomAction}>
                    <input type="hidden" name="id" value={room.id} />
                    <input type="hidden" name="archived" value={String(room.is_archived)} />
                    <BotonEnviar className="cm-archivar" pendingLabel="…" title={room.is_archived ? "Desarchivar" : "Archivar"}>
                      {room.is_archived ? <ArchiveRestore size={14} strokeWidth={2} /> : <Archive size={14} strokeWidth={2} />}
                    </BotonEnviar>
                  </form>
                )}
              </div>
            );
          })}
          {isAdmin && accessibleRooms.length === 0 && (
            <p className="cm-sin">Todavía no hay canales. Creá el primero con el <strong>+</strong>.</p>
          )}
        </nav>
      </aside>

      {/* ── Conversación ── */}
      <div className="cm-chat">
        <header className="cm-chat-cab">
          <span className="cm-chat-ico">
            {currentRoom?.type === "tier" ? <Gem size={18} strokeWidth={1.9} /> : <Users size={18} strokeWidth={1.9} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="cm-chat-titulo">{currentRoom?.name ?? "Comunidad"}</p>
            {/* Sin canal elegido decia "Exclusivo Todas": tomaba el plan de un
                canal que no existe. */}
            <p className="cm-chat-sub">
              {!currentRoom
                ? "Elegí un canal para empezar"
                : currentRoom.type === "community"
                  ? "Canal abierto a todas las alumnas"
                  : `Exclusivo para ${TIER_LABEL[currentRoom.tier_required]}`}
            </p>
          </div>
          {isAdmin && (
            <Link href={"/admin/chat" as never} className="cm-moderar">
              <Shield size={14} strokeWidth={2} aria-hidden="true" /> Moderación
            </Link>
          )}
        </header>

        {currentRoom ? (
          <ChatRoom
            roomId={currentRoom.id}
            userId={user.id}
            isAdmin={isAdmin}
            initialMessages={initialMessages}
            placeholder={`Escribir en ${currentRoom.name}…`}
          />
        ) : (
          <div className="cm-chat-vacio">
            <span className="cm-chat-vacio-ico"><Users size={28} strokeWidth={1.6} aria-hidden="true" /></span>
            <p className="cm-chat-vacio-titulo">{isAdmin ? "Abrí el primer canal" : "Elegí un canal"}</p>
            <p>{isAdmin ? "Con el + de la izquierda: un canal para todas, o uno exclusivo de un plan." : "A la izquierda están los canales de tu plan."}</p>
            {isAdmin && (
              <Link href={"/dashboard/community?create=1" as never} className="ad-btn ad-btn--lleno"><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Crear canal</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.cm { display: flex; height: 100vh; overflow: hidden; background: #fff; }
.cm-lateral { width: 270px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid #f0eeec; background: #fcfbfa; }
.cm-lateral-cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 22px 18px 16px; border-bottom: 1px solid #f0eeec; }
.cm-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--pink-deep); }
.cm-lateral-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.03em; color: var(--ink); }
.cm-nuevo {
  width: 36px; height: 36px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;
  background: var(--pink); color: #fff; box-shadow: 0 8px 16px -10px rgba(230,79,85,0.8); transition: transform .3s cubic-bezier(.16,1,.3,1), background .2s;
}
.cm-nuevo:hover { background: var(--pink-mid); }
.cm-nuevo.es-abierto { transform: rotate(45deg); background: var(--ink); }
.cm-crear { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px 16px; border-bottom: 1px solid #f0eeec; background: #fff; }
.cm-campo { display: flex; flex-direction: column; gap: 5px; }
.cm-campo > span { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #78716c; }
.cm-campo input { border-radius: 11px; border: 1.5px solid #e7e5e4; padding: 0.6rem 0.8rem; font-size: 13.5px; }
.cm-campo input:focus { border-color: var(--pink); }
.cm-campo .dsp-boton { min-height: 40px; border-color: #e7e5e4; font-size: 13.5px; }
.cm-crear-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; border-radius: 99px; border: 0; cursor: pointer;
  background: var(--pink); color: #fff; font: inherit; font-size: 13.5px; font-weight: 700; margin-top: 2px;
}
.cm-salas { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 10px; display: flex; flex-direction: column; gap: 2px; }
.cm-sala { display: flex; align-items: center; gap: 4px; border-radius: 14px; transition: background .2s; }
.cm-sala:hover { background: #f5f5f4; }
.cm-sala.es-activa { background: var(--pink-wash); }
.cm-sala.es-archivada { opacity: 0.55; }
.cm-sala form { display: contents; }
.cm-sala-link { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 9px 10px; text-decoration: none; }
.cm-sala-ico { width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: #fff; color: #78716c; border: 1px solid #f0eeec; }
.cm-sala.es-activa .cm-sala-ico { background: var(--pink); color: #fff; border-color: var(--pink); }
.cm-sala-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cm-sala-nombre { font-size: 13.5px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cm-sala.es-activa .cm-sala-nombre { font-weight: 800; color: var(--pink-deep); }
.cm-sala-sub { font-size: 11.5px; color: #a8a29e; }
.cm-archivar { width: 30px; height: 30px; margin-right: 6px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; border: 0; background: transparent; color: #a8a29e; cursor: pointer; opacity: 0; transition: opacity .2s, background .2s, color .2s; }
.cm-sala:hover .cm-archivar, .cm-archivar:focus-visible { opacity: 1; }
.cm-archivar:hover { background: #fff; color: var(--ink); }
.cm-sin { font-size: 13px; line-height: 1.55; color: #78716c; padding: 10px; }

.cm-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cm-chat-cab { display: flex; align-items: center; gap: 14px; padding: 16px 24px; border-bottom: 1px solid #f0eeec; background: rgba(255,255,255,0.92); backdrop-filter: blur(10px); flex-shrink: 0; }
.cm-chat-ico { width: 44px; height: 44px; border-radius: 14px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--pink-wash); color: var(--pink-deep); }
.cm-chat-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 18px; letter-spacing: -0.025em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cm-chat-sub { font-size: 12.5px; color: #78716c; }
.cm-moderar { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 99px; text-decoration: none; font-size: 12.5px; font-weight: 700; color: var(--ink); border: 1.5px solid #e7e5e4; transition: border-color .2s; }
.cm-moderar:hover { border-color: var(--ink); }
.cm-chat-vacio { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; text-align: center; color: #78716c; font-size: 14px; }
.cm-chat-vacio-ico { width: 64px; height: 64px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; background: var(--pink-wash); color: var(--pink-deep); margin-bottom: 6px; }
.cm-chat-vacio-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.03em; color: var(--ink); }
.cm-chat-vacio .ad-btn { margin-top: 8px; }

.cm-vacio { padding-bottom: 80px; }
.cm-shell { max-width: 1320px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 0; display: flex; flex-direction: column; gap: 18px; }
.cm-ejemplo { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.cm-ejemplo-cab { display: flex; align-items: center; gap: 7px; padding-bottom: 10px; border-bottom: 1px solid #f5f5f4; font-weight: 800; font-size: 13px; color: var(--ink); }
.cm-burbuja { max-width: 85%; padding: 9px 13px; border-radius: 16px 16px 16px 4px; background: #f5f5f4; font-size: 13px; line-height: 1.45; color: var(--ink); animation: ad-entra .5s cubic-bezier(.16,1,.3,1) both; }
.cm-burbuja strong { display: block; font-size: 11px; color: #78716c; margin-bottom: 2px; }
.cm-burbuja.es-brunela { background: var(--pink-wash); }
.cm-burbuja.es-brunela strong { color: var(--pink-deep); }
.cm-burbuja.es-mia { align-self: flex-end; border-radius: 16px 16px 4px 16px; background: var(--pink-mid); color: #fff; }
@media (prefers-reduced-motion: reduce) { .cm-burbuja { animation: none; } }
`;
