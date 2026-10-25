import { Desplegable } from "@/components/desplegable";
import Link from "next/link";
import { BotonEnviar } from "@/components/boton-enviar";
import { ChatRoom, type ChatMessage } from "@/components/chat-room";
import { requireAdmin } from "@/src/features/auth/guards";
import { Users, Gem, MessageSquare, Plus, Ban, Check, ChevronDown, MessageCircle, VolumeX } from "lucide-react";
import { AdminAviso, AdminCabecera } from "@/components/admin-ui";
import { Paginacion, hrefConPagina } from "@/components/paginacion";

/** Filas por pagina en cada pestana (salas, baneos, muteos). */
const POR_PAGINA = 10;
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { invalidarAjustes } from "@/src/lib/settings";
import {
  DM_ACCESS_DEFAULT,
  DM_TIER_LABEL,
  DM_TIER_ORDER,
  getDmAccess,
  type DmAccessMap,
  type MembershipTier,
} from "@/src/features/admin/chat-settings";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Maps a moderation duration choice to an absolute expiry (null = permanent).
const DURATION_TO_MS: Record<string, number | null> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  permanent: null,
};

function resolveExpiry(duration: string): string | null {
  const ms = DURATION_TO_MS[duration];
  if (ms == null) return null;
  return new Date(Date.now() + ms).toISOString();
}

type Ban = {
  id: string;
  user_id: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

type Mute = {
  id: string;
  user_id: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

// ── Server actions ────────────────────────────────────────────────────────────

// Las salas (crear, archivar) se manejan en /admin/comunidad. Antes estaban
// las dos pantallas haciendo lo mismo, y aca ademas "canales de categoria" que
// ninguna pantalla de alumna usaba. Esta queda para moderar: quien puede
// escribirle a Brunela, baneos y muteos.

async function unbanUserAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("chat_bans").delete().eq("id", id);
  revalidatePath("/admin/chat");
  redirect("/admin/chat?tab=bans&success=Usuario+desbaneado" as never);
}

async function unmuteUserAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("chat_mutes").delete().eq("id", id);
  revalidatePath("/admin/chat");
  redirect("/admin/chat?tab=mutes&success=Usuario+desmuteado" as never);
}


async function saveDmAccessAction(formData: FormData) {
  "use server";
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  // Each tier checkbox is present only when toggled on.
  const value: DmAccessMap = {
    none: formData.get("dm_none") === "on",
    corps_de_ballet: formData.get("dm_corps_de_ballet") === "on",
    solista: formData.get("dm_solista") === "on",
    principal: formData.get("dm_principal") === "on",
  };

  invalidarAjustes();

  const { error } = await supabase.from("site_settings").upsert(
    {
      setting_key: "chat.dm_access",
      category: "chat",
      // Se veia tal cual en pantalla, en ingles.
      description: "Qué planes pueden abrir un chat privado con el estudio.",
      is_public: false,
      value,
      updated_by: user.id,
    },
    { onConflict: "setting_key" }
  );

  if (error) redirect(`/admin/chat?tab=dm&error=${encodeURIComponent(error.message)}` as never);

  revalidatePath("/admin/chat");
  revalidatePath("/dashboard/chat");
  redirect("/admin/chat?tab=dm&success=Permisos+de+chat+actualizados" as never);
}


// ── UI helpers ────────────────────────────────────────────────────────────────


// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminChatPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user: adminUser } = await requireAdmin();
  const adminUserId = adminUser.id;
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const tabPedida = typeof params.tab === "string" ? params.tab : "dm";
  const tab = ["dm", "bans", "mutes"].includes(tabPedida) ? tabPedida : "dm";
  const success = typeof params.success === "string" ? decodeURIComponent(params.success) : null;
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;
  // Consultas independientes en paralelo: encadenadas eran un viaje tras otro
  // a Supabase (medido antes: 1728 ms de espera pura en esta pantalla).
  const [
    { data: bansData },
    { data: mutesData },
    dmAccess,
  ] = await Promise.all([
    supabase
      .from("chat_bans")
      .select("id, user_id, reason, expires_at, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false }),
    supabase
      .from("chat_mutes")
      .select("id, user_id, reason, expires_at, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false }),
    getDmAccess(),
  ]);

  const bans = (bansData ?? []) as unknown as Ban[];
  const mutes = (mutesData ?? []) as unknown as Mute[];

  // Paginas por pestana. Las tres listas llegan enteras (son chicas y las
  // pestanas muestran el total), asi que se cortan aca. Un solo `pagina`:
  // cambiar de pestana vuelve a la primera.
  const paginaPedida = Math.max(0, Math.min(1000, Math.floor(Number(params.pagina)) || 0));
  const cortar = <T,>(lista: T[]) => {
    const p = Math.min(paginaPedida, Math.max(1, Math.ceil(lista.length / POR_PAGINA)) - 1);
    return { pagina: p, filas: lista.slice(p * POR_PAGINA, p * POR_PAGINA + POR_PAGINA) };
  };
  const pagBans = cortar(bans);
  const pagMutes = cortar(mutes);
  const hrefPagina = hrefConPagina("/admin/chat", { tab });

  const TABS = [
    { key: "dm", label: "Chat directo" },
    { key: "bans", label: `Baneos (${bans.length})` },
    { key: "mutes", label: `Muteos (${mutes.length})` },
  ];

  return (
    <main className="ch">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Comunidad"
        titulo="Moderación"
        lede="Quién puede escribirte por chat directo, y las alumnas baneadas o muteadas."
      />

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      {/* Tab nav */}
      <nav className="ch-tabs" aria-label="Secciones del chat">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/chat?tab=${t.key}` as never}
            className={"ch-tab" + (tab === t.key ? " es-activa" : "")}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.key === "rooms" && <Users size={15} strokeWidth={2.2} aria-hidden="true" />}
            {t.key === "dm" && <MessageCircle size={15} strokeWidth={2.2} aria-hidden="true" />}
            {t.key === "bans" && <Ban size={15} strokeWidth={2.2} aria-hidden="true" />}
            {t.key === "mutes" && <VolumeX size={15} strokeWidth={2.2} aria-hidden="true" />}
            {t.label}
          </Link>
        ))}
      </nav>

      {/* ── ROOMS TAB ── */}
      <p className="ch-nota">
        Los canales de la comunidad se crean y se archivan en{" "}
        <Link href={"/admin/comunidad" as never}>Comunidad</Link>.
      </p>

      {tab === "dm" && (
        <div className="ch-panel ch-panel--angosto">
          <div className="ch-panel-cab">
            <span className="ch-burbuja"><MessageCircle size={19} strokeWidth={2.2} aria-hidden="true" /></span>
            <div>
              <h2 className="ch-panel-titulo">Chat directo con Brunela</h2>
              <p className="ch-panel-txt">
                Elegí qué planes pueden <strong>iniciar</strong> un chat privado con vos.
                Vos siempre podés escribirle a cualquier alumna desde la pestaña de mensajes,
                sin importar su plan.
              </p>
            </div>
          </div>

          <form action={saveDmAccessAction} className="ch-dm-form">
            {DM_TIER_ORDER.map((tier) => {
              const enabled = dmAccess[tier as MembershipTier];
              return (
                <label key={tier} className="ch-dm">
                  <div>
                    <p className="ch-dm-plan">
                      {DM_TIER_LABEL[tier as MembershipTier]}
                    </p>
                    <p className="ch-dm-estado">
                      {enabled ? "Puede iniciar chat directo" : "No puede iniciar chat directo"}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    name={`dm_${tier}`}
                    defaultChecked={enabled}
                  />
                  <span className="pf-switch-pista" aria-hidden="true"><span /></span>
                </label>
              );
            })}
            <p className="ch-nota">
              Por defecto solo el plan <strong>Principal</strong> tiene chat directo (coincide con la landing).
            </p>
            <BotonEnviar className="pf-guardar"><Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar permisos</BotonEnviar>
          </form>
        </div>
      )}

      {/* ── BANS TAB ── */}
      {tab === "bans" && (
        <div className="ch-panel">
          <h2 className="ch-panel-titulo ch-panel-titulo--cuenta">Usuarios baneados <span>{bans.length}</span></h2>
          {bans.length === 0 ? (
            <div className="ch-vacio">
              <span className="ch-burbuja ch-burbuja--rubor"><Ban size={20} strokeWidth={2.2} aria-hidden="true" /></span>
              <p>No hay usuarios baneados. Los baneos se aplican desde el chat del miembro.</p>
            </div>
          ) : (
            <ul className="ch-mod-lista">
              {pagBans.filas.map((ban) => {
                const name = ban.profiles?.full_name ?? ban.profiles?.email ?? ban.user_id;
                return (
                  <li key={ban.id} className="ch-mod ch-mod--ban">
                    <span className="ch-mod-ini" aria-hidden="true">{String(name)[0]?.toUpperCase()}</span>
                    <div className="ch-mod-txt">
                      <p className="ch-mod-nombre">{name}</p>
                      {ban.reason && <p className="ch-mod-motivo">Motivo: {ban.reason}</p>}
                      <div className="ch-mod-fechas">
                        <span>
                          Baneado: {new Date(ban.created_at).toLocaleDateString("es-AR")}
                        </span>
                        {ban.expires_at && (
                          <span className="ch-mod-expira">
                            Expira: {new Date(ban.expires_at).toLocaleDateString("es-AR")}
                          </span>
                        )}
                      </div>
                    </div>
                    <form action={unbanUserAction}>
                      <input type="hidden" name="id" value={ban.id} />
                      <BotonEnviar className="ch-btn-sec">Desbanear</BotonEnviar>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
          <Paginacion pagina={pagBans.pagina} total={bans.length} porPagina={POR_PAGINA} href={hrefPagina} />
        </div>
      )}

      {/* ── MUTES TAB ── */}
      {tab === "mutes" && (
        <div className="ch-panel">
          <h2 className="ch-panel-titulo ch-panel-titulo--cuenta">Usuarios muteados <span>{mutes.length}</span></h2>
          {mutes.length === 0 ? (
            <div className="ch-vacio">
              <span className="ch-burbuja ch-burbuja--rubor"><VolumeX size={20} strokeWidth={2.2} aria-hidden="true" /></span>
              <p>No hay usuarios muteados. Los muteos se aplican desde el chat del miembro.</p>
            </div>
          ) : (
            <ul className="ch-mod-lista">
              {pagMutes.filas.map((mute) => {
                const name = mute.profiles?.full_name ?? mute.profiles?.email ?? mute.user_id;
                return (
                  <li key={mute.id} className="ch-mod ch-mod--mute">
                    <span className="ch-mod-ini" aria-hidden="true">{String(name)[0]?.toUpperCase()}</span>
                    <div className="ch-mod-txt">
                      <p className="ch-mod-nombre">{name}</p>
                      {mute.reason && <p className="ch-mod-motivo">Motivo: {mute.reason}</p>}
                      <div className="ch-mod-fechas">
                        <span>
                          Muteado: {new Date(mute.created_at).toLocaleDateString("es-AR")}
                        </span>
                        {mute.expires_at && (
                          <span className="ch-mod-expira">
                            Expira: {new Date(mute.expires_at).toLocaleDateString("es-AR")}
                          </span>
                        )}
                      </div>
                    </div>
                    <form action={unmuteUserAction}>
                      <input type="hidden" name="id" value={mute.id} />
                      <BotonEnviar className="ch-btn-sec">Desmutear</BotonEnviar>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
          <Paginacion pagina={pagMutes.pagina} total={mutes.length} porPagina={POR_PAGINA} href={hrefPagina} />
        </div>
      )}
    </main>
  );
}

const CSS = `
.ch { display: flex; flex-direction: column; gap: 20px; }
.ch .ad-mast { margin-bottom: 0; }

.ch-nota { margin: 12px 0 0; font-size: 13.5px; color: var(--muted); }
.ch-nota a { color: var(--pink-deep); font-weight: 800; }
.ch-tabs { display: flex; gap: 6px; flex-wrap: wrap; width: fit-content; max-width: 100%; padding: 6px; border-radius: 99px; background: var(--rubor); border: 1px solid var(--linea); }
.ch-tab { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 16px; border-radius: 99px; text-decoration: none; font-size: 13.5px; font-weight: 800; color: var(--muted); transition: background .2s, color .2s, box-shadow .3s; }
.ch-tab:hover { color: var(--pink-deep); background: rgba(255,255,255,.6); }
.ch-tab.es-activa { background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }

.ch-salas { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; }
.ch-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.ch-caja { padding: 18px; border-radius: var(--radio); background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.ch-caja-titulo { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 16px; font-weight: 900; color: var(--ink); }
.ch-caja-titulo span { padding: 2px 10px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 12.5px; font-weight: 800; }
.ch-lista { display: flex; flex-direction: column; gap: 6px; }
.ch-sala { border-radius: 18px; border: 1.5px solid transparent; transition: background .2s, border-color .2s; }
.ch-sala:hover { background: var(--crema); }
.ch-sala.es-activa { background: var(--rubor); border-color: var(--pink-line); }
.ch-sala-link { display: flex; align-items: center; gap: 10px; padding: 10px 10px 4px; text-decoration: none; }
.ch-sala-ico { width: 34px; height: 34px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.ch-sala.es-activa .ch-sala-ico { background: var(--pink); color: #fff; }
.ch-sala-txt { flex: 1; min-width: 0; }
.ch-sala-nombre { font-size: 14px; font-weight: 800; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-sala-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; font-size: 12px; color: var(--muted); }
.ch-sala-plan { color: var(--pink-deep); font-weight: 800; }
.ch-sala-arch { padding: 0 8px; border-radius: 99px; background: #FFF4E8; color: var(--melocoton-deep); font-weight: 800; }
.ch-sala-form { padding: 0 10px 8px 54px; }
.ch-sala-archivar { padding: 0; border: 0; background: none; cursor: pointer; font: inherit; font-size: 12px; font-weight: 800; color: var(--muted); }
.ch-sala-archivar:hover { color: var(--pink-deep); text-decoration: underline; text-underline-offset: 3px; }
.ch-lista-vacia { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 18px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); font-size: 13.5px; color: var(--muted); }

.ch-crear { border-radius: var(--radio); background: #fff; border: 1.5px dashed var(--linea-fuerte); transition: border-color .2s, box-shadow .3s; }
.ch-crear[open] { border-style: solid; border-color: var(--pink-line); box-shadow: var(--sombra); }
.ch-crear > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 14px 16px; user-select: none; }
.ch-crear > summary::-webkit-details-marker { display: none; }
.ch-crear-ico { width: 34px; height: 34px; border-radius: 12px; display: grid; place-items: center; background: var(--pink); color: #fff; box-shadow: 0 8px 16px -8px rgba(230,79,85,.8); }
.ch-crear-txt { flex: 1; font-size: 14.5px; font-weight: 800; color: var(--ink); }
.ch-crear-flecha { color: var(--muted); transition: transform .3s var(--curva); }
.ch-crear[open] .ch-crear-flecha { transform: rotate(180deg); }
.ch-crear-cuerpo { display: flex; flex-direction: column; gap: 12px; padding: 0 14px 14px; }
.ch-form-caja { padding: 16px; border-radius: 20px; background: var(--crema); border: 1px solid var(--linea); }
.ch-form-titulo { font-size: 15px; font-weight: 900; color: var(--ink); margin-bottom: 12px; }
.ch-form-sub { margin: -8px 0 12px; font-size: 12.5px; line-height: 1.5; color: var(--muted); }
.ch-form { display: flex; flex-direction: column; gap: 12px; }
.ch-inp { width: 100%; height: 46px; padding: 0 14px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 14px; outline: none; transition: border-color .2s, box-shadow .2s; }
.ch-inp:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.ch-ancho { width: 100%; justify-content: center; }
.ch-btn-sec { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 42px; padding: 0 18px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 800; transition: background .2s, border-color .2s, transform .3s var(--curva); }
.ch-btn-sec:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateY(-1px); }

.ch-mensajes { min-width: 0; }
.ch-sala-abierta { height: calc(100vh - 220px); min-height: 420px; border: 1px solid var(--linea); border-radius: 28px; overflow: hidden; background: #fff; box-shadow: var(--sombra); }
.ch-elegir { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 340px; padding: 40px 24px; text-align: center; border-radius: 28px; background: linear-gradient(140deg, #FFF6F2, #fff 60%); border: 1px solid var(--linea); box-shadow: var(--sombra); }
.ch-elegir-burbujas { display: flex; gap: 10px; margin-bottom: 10px; }
.ch-elegir-burbujas span { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }
.ch-elegir-burbujas span:nth-child(2) { width: 58px; height: 58px; border-radius: 20px; transform: translateY(-8px); background: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.ch-elegir-titulo { font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.ch-elegir-txt { font-size: 14px; color: var(--muted); }

.ch-burbuja { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.ch-burbuja--rubor { background: var(--rubor); color: var(--pink-deep); }
.ch-panel { padding: clamp(20px, 3vw, 30px); border-radius: 28px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.ch-panel--angosto { max-width: 620px; }
.ch-panel-cab { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 18px; }
.ch-panel-titulo { font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.ch-panel-titulo--cuenta { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.ch-panel-titulo--cuenta span { padding: 2px 10px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 13px; font-weight: 800; letter-spacing: 0; }
.ch-panel-txt { margin-top: 4px; font-size: 14px; line-height: 1.6; color: var(--muted); }
.ch-panel-txt strong { color: var(--ink); }
.ch-dm-form { display: flex; flex-direction: column; gap: 10px; }
.ch-dm { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; border-radius: 20px; background: var(--crema); border: 1.5px solid var(--linea); cursor: pointer; transition: background .2s, border-color .2s; }
.ch-dm:hover { border-color: var(--linea-fuerte); }
.ch-dm:has(input:checked) { background: var(--rubor); border-color: var(--pink-line); }
.ch-dm input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.ch-dm input:checked + .pf-switch-pista { background: var(--pink); }
.ch-dm input:checked + .pf-switch-pista span { transform: translateX(18px); }
.ch-dm input:focus-visible + .pf-switch-pista { box-shadow: 0 0 0 4px rgba(230,79,85,.22); }
.ch-dm-plan { font-size: 15px; font-weight: 800; color: var(--ink); }
.ch-dm-estado { margin-top: 2px; font-size: 12.5px; color: var(--muted); }
.ch-nota { padding: 4px 4px 8px; font-size: 13px; color: var(--muted); }
.ch-nota strong { color: var(--ink); }
.ch-dm-form .pf-guardar { align-self: flex-start; }

.ch-vacio { display: flex; align-items: center; gap: 14px; padding: 20px; border-radius: 20px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); font-size: 14px; line-height: 1.55; color: var(--muted); }
.ch-mod-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ch-mod { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 20px; border: 1px solid var(--linea); }
.ch-mod--ban { background: linear-gradient(140deg, var(--rubor), #fff 70%); }
.ch-mod--mute { background: linear-gradient(140deg, #FFF4E8, #fff 70%); }
.ch-mod-ini { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: #fff; color: var(--pink-deep); font-weight: 900; box-shadow: var(--sombra); }
.ch-mod-txt { flex: 1; min-width: 0; }
.ch-mod-nombre { font-size: 14.5px; font-weight: 800; color: var(--ink); overflow-wrap: anywhere; }
.ch-mod-motivo { margin-top: 2px; font-size: 13px; color: var(--muted); }
.ch-mod-fechas { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; font-size: 12px; color: var(--muted); }
.ch-mod-expira { color: var(--melocoton-deep); font-weight: 700; }

@media (max-width: 900px) {
  .ch-salas { grid-template-columns: minmax(0, 1fr); }
  .ch-sala-abierta { height: 70vh; }
}
@media (max-width: 560px) {
  .ch-tabs { border-radius: 24px; width: 100%; }
  .ch-tab { flex: 1 1 auto; justify-content: center; padding: 0 12px; }
  .ch-mod { flex-wrap: wrap; }
  .ch-elegir { min-height: 260px; }
}
`;
