import { Desplegable } from "@/components/desplegable";
import { revalidatePath } from "next/cache";
import { BotonEnviar } from "@/components/boton-enviar";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { AdminAviso, AdminCabecera, AdminCifras } from "@/components/admin-ui";
import { Bell, Heart, Megaphone, Send } from "lucide-react";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────────

type Announcement = {
  id: string;
  title: string;
  content: string;
  tier_target: string;
  is_active: boolean;
  published_at: string;
  expires_at: string | null;
};

// ── Server actions ─────────────────────────────────────────────────────────────

async function createAnnouncementAction(fd: FormData) {
  "use server";
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("studio_announcements").insert({
    title: (fd.get("title") as string).trim(),
    content: (fd.get("content") as string).trim(),
    tier_target: (fd.get("tierTarget") as string) || "all",
    is_active: true,
    expires_at: fd.get("expiresAt") ? new Date(fd.get("expiresAt") as string).toISOString() : null,
    created_by: user.id,
  });

  if (error) redirect(`/admin/announcements?error=${encodeURIComponent(error.message)}` as never);

  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
  redirect("/admin/announcements?success=Anuncio+publicado" as never);
}

async function deactivateAnnouncementAction(fd: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  await supabase.from("studio_announcements").update({ is_active: false }).eq("id", id);
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
  redirect("/admin/announcements?success=Anuncio+desactivado" as never);
}

async function deleteAnnouncementAction(fd: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  await supabase.from("studio_announcements").delete().eq("id", id);
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
  redirect("/admin/announcements?success=Anuncio+eliminado" as never);
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  all: "Todas las alumnas",
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal",
};

const TIER_STYLE: Record<string, string> = {
  all:             "an-plan--todas",
  corps_de_ballet: "an-plan--corps",
  solista:         "an-plan--solista",
  principal:       "an-plan--principal",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? decodeURIComponent(params.success) : null;
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;

  const { data } = await supabase
    .from("studio_announcements")
    .select("id, title, content, tier_target, is_active, published_at, expires_at")
    .order("published_at", { ascending: false });

  const announcements = (data ?? []) as Announcement[];
  const active = announcements.filter((a) => a.is_active).length;

  return (
    <main className="an">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Comunicación"
        titulo="Anuncios"
        lede="Avisos que ven las alumnas al entrar al estudio. Podés dirigirlos a un plan concreto y darlos de baja cuando dejan de aplicar."
      />

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      {/* Stats */}
      <AdminCifras items={[
        { value: announcements.length, label: "Total",  sub: "anuncios creados" },
        { value: active,               label: "Activos", sub: "visibles en el studio" },
        { value: announcements.length - active, label: "Inactivos", sub: "desactivados o vencidos" },
      ]} />

      {/* Create form */}
      <section className="an-nuevo">
        <div className="an-nuevo-cab">
          <span className="an-burbuja"><Megaphone size={19} strokeWidth={2.2} aria-hidden="true" /></span>
          <div>
            <h2 className="an-h2">Nuevo anuncio</h2>
            <p className="an-sub">Aparece en el inicio de cada alumna a la que va dirigido.</p>
          </div>
        </div>
        <form action={createAnnouncementAction} className="an-form">
          <div className="an-grilla">
            <label className="pf-campo">
              <span className="pf-etq">Título</span>
              <input className="an-inp" name="title" required placeholder="Nuevos horarios disponibles" />
            </label>
            <label className="pf-campo">
              <span className="pf-etq">Destinatarias</span>
              <Desplegable
                name="tierTarget" defaultValue="all"
                opciones={[
                  { value: "all", label: "Todas las alumnas" },
                  { value: "corps_de_ballet", label: "Corps de Ballet y superiores" },
                  { value: "solista", label: "Solista y superiores" },
                  { value: "principal", label: "Solo Principal" },
                ]}
              />
            </label>
          </div>
          <label className="pf-campo">
            <span className="pf-etq">Mensaje</span>
            <textarea
              className="an-inp an-inp--area"
              name="content"
              required
              placeholder="El mensaje que van a ver las alumnas en su dashboard..."
            />
          </label>
          <div className="an-pie">
            <label className="pf-campo an-vence">
              <span className="pf-etq">Vence el <small>opcional</small></span>
              <input className="an-inp" name="expiresAt" type="datetime-local" />
            </label>
            <BotonEnviar className="pf-guardar">
              <Send size={15} strokeWidth={2.4} aria-hidden="true" /> Publicar anuncio
            </BotonEnviar>
          </div>
        </form>
      </section>

      {/* Announcement list */}
      <section>
        <h2 className="an-h2 an-h2--lista">Historial <span>{announcements.length}</span></h2>
        {announcements.length === 0 ? (
          <div className="an-vacio">
            <div className="an-vacio-burbujas" aria-hidden="true">
              <span><Bell size={20} strokeWidth={2.2} /></span>
              <span><Megaphone size={24} strokeWidth={2.2} /></span>
              <span><Heart size={20} strokeWidth={2.2} /></span>
            </div>
            <p className="an-vacio-titulo">Todavía no hay anuncios.</p>
            <p className="an-vacio-txt">No hay anuncios. Crea el primero arriba.</p>
          </div>
        ) : (
          <ul className="an-lista">
            {announcements.map((a) => {
              const tierClase = TIER_STYLE[a.tier_target] ?? TIER_STYLE.all;
              const pubDate = new Date(a.published_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
              const isExpired = a.expires_at ? new Date(a.expires_at) < new Date() : false;

              return (
                <li key={a.id} className={"an-fila" + (!a.is_active ? " es-inactivo" : "")}>
                  <span className="an-fila-ico" aria-hidden="true"><Megaphone size={18} strokeWidth={2.2} /></span>
                  {/* Left: content */}
                  <div className="an-fila-txt">
                    <div className="an-fila-cab">
                      {a.title && (
                        <span className="an-titulo">{a.title}</span>
                      )}
                      <span className={"an-chip " + tierClase}>{TIER_LABELS[a.tier_target] ?? a.tier_target}</span>
                      {a.is_active && !isExpired ? (
                        <span className="an-chip an-chip--ok">Activo</span>
                      ) : (
                        <span className="an-chip an-chip--off">
                          {isExpired ? "Vencido" : "Inactivo"}
                        </span>
                      )}
                    </div>
                    <p className="an-contenido">{a.content}</p>
                    <p className="an-fecha">
                      Publicado: {pubDate}
                      {a.expires_at && ` · Vence: ${new Date(a.expires_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`}
                    </p>
                  </div>

                  {/* Right: actions */}
                  <div className="an-acciones">
                    {a.is_active && (
                      <form action={deactivateAnnouncementAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <BotonEnviar className="an-accion an-accion--pausar">Desactivar</BotonEnviar>
                      </form>
                    )}
                    <form action={deleteAnnouncementAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <BotonEnviar pendingLabel="Borrando…" confirmar="¿Borrar este anuncio? No se puede deshacer." className="an-accion an-accion--borrar">Eliminar</BotonEnviar>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

const CSS = `
.an { display: flex; flex-direction: column; }
.an > section + section { margin-top: 26px; }
.an-burbuja { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }
.an-h2 { font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.an-h2--lista { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.an-h2--lista span { padding: 2px 10px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 13px; font-weight: 800; letter-spacing: 0; }
.an-sub { margin-top: 2px; font-size: 13.5px; color: var(--muted); }

.an-nuevo { padding: clamp(20px, 3vw, 30px); border-radius: 28px; background: linear-gradient(140deg, #FFF6F2, #fff 62%); border: 1px solid var(--linea); box-shadow: var(--sombra); }
.an-nuevo-cab { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.an-form { display: flex; flex-direction: column; gap: 14px; }
.an-grilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px 16px; }
.an-inp { width: 100%; height: 48px; padding: 0 16px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 14px; outline: none; transition: border-color .2s, box-shadow .2s; }
.an-inp:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.an-inp--area { height: auto; min-height: 104px; padding: 12px 16px; resize: vertical; line-height: 1.55; }
.an-pie { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.an-vence { flex: 0 1 300px; }
.an-vence small { margin-left: 4px; font-weight: 600; color: var(--muted); }

.an-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.an-fila { display: flex; align-items: flex-start; gap: 14px; padding: 18px 20px; border-radius: var(--radio); background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); transition: transform .35s var(--curva), box-shadow .35s var(--curva); }
.an-fila:hover { transform: translateY(-2px); box-shadow: var(--sombra-alta); }
.an-fila.es-inactivo { background: var(--crema); box-shadow: none; }
.an-fila.es-inactivo .an-fila-txt { opacity: .7; }
.an-fila-ico { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.an-fila.es-inactivo .an-fila-ico { background: #fff; color: var(--muted); }
.an-fila-txt { flex: 1; min-width: 0; }
.an-fila-cab { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.an-titulo { font-size: 15.5px; font-weight: 800; color: var(--ink); }
.an-chip { padding: 3px 11px; border-radius: 99px; font-size: 12px; font-weight: 800; }
.an-plan--todas { background: #F7F0FA; color: #7A4F8C; }
.an-plan--corps { background: #fff; color: var(--pink-deep); border: 1px solid var(--pink-line); }
.an-plan--solista { background: var(--rubor); color: var(--pink-deep); border: 1px solid var(--pink-line); }
.an-plan--principal { background: var(--pink); color: #fff; }
.an-chip--ok { background: var(--salvia); color: var(--salvia-deep); }
.an-chip--off { background: #FFF4E8; color: var(--melocoton-deep); }
.an-contenido { font-size: 14px; line-height: 1.6; color: var(--ink); margin-bottom: 8px; overflow-wrap: anywhere; }
.an-fecha { font-size: 12.5px; color: var(--muted); }
.an-acciones { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
.an-accion { height: 36px; padding: 0 14px; border-radius: 99px; border: 1.5px solid transparent; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 800; transition: transform .25s var(--curva), background .2s; }
.an-accion:hover { transform: translateY(-1px); }
.an-accion--pausar { background: #FFF4E8; color: var(--melocoton-deep); border-color: #F6D9C6; }
.an-accion--borrar { background: #fff; color: var(--pink-deep); border-color: var(--pink-line); }
.an-accion--borrar:hover { background: var(--rubor); }

.an-vacio { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 46px 24px; text-align: center; border-radius: 28px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); }
.an-vacio-burbujas { display: flex; gap: 10px; margin-bottom: 8px; }
.an-vacio-burbujas span { width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }
.an-vacio-burbujas span:nth-child(2) { width: 56px; height: 56px; border-radius: 20px; transform: translateY(-8px); background: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.an-vacio-titulo { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.an-vacio-txt { font-size: 14px; color: var(--muted); }
@media (max-width: 640px) {
  .an-fila { flex-wrap: wrap; padding: 16px; }
  .an-fila-ico { display: none; }
  .an-acciones { width: 100%; }
  .an-pie .pf-guardar { width: 100%; justify-content: center; }
  .an-vence { flex: 1 1 100%; }
}
@media (prefers-reduced-motion: reduce) { .an-fila { transition: none; } .an-fila:hover { transform: none; } }
`;
