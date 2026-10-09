import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Euro, Lock, MessageCircle, Settings2 } from "lucide-react";
import { AdminAviso, AdminCabecera } from "@/components/admin-ui";
import { requireAdmin } from "@/src/features/auth/guards";
import { BotonEnviar } from "@/components/boton-enviar";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { guardarAjusteDeReservasAction, guardarAjusteDeChatAction } from "@/src/features/admin/settings-actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type SiteSetting = {
  setting_key: string;
  category: string;
  description: string | null;
  value: unknown;
};

/**
 * Configuración del estudio.
 *
 * POR QUE ESTA PANTALLA CAMBIO POR COMPLETO
 *   Antes era un editor de JSON crudo sobre site_settings: siete claves, todas
 *   como texto libre, incluida `subscriptions.catalog` con los doce price ids
 *   de Stripe. Una coma de mas ahi y el cobro deja de funcionar; una edicion en
 *   `subscriptions.access_defaults` y alguien pierde el acceso o lo gana gratis.
 *   Los dos fallan en silencio: nada avisa, simplemente deja de andar.
 *
 *   Ahora Brunela edita las DOS que son suyas, con interruptores. Las otras
 *   cinco se ven -- sirve para entender el sistema -- pero no se editan desde
 *   aca. Las dos peligrosas ya tienen su lugar correcto: se cambian por
 *   migracion, que queda versionada y revisable.
 */

const EDITABLES = new Set(["live_sessions.booking", "chat.dm_access"]);

const TITULOS: Record<string, { titulo: string; ayuda: string }> = {
  "live_sessions.booking": {
    titulo: "Reservas de clases en vivo",
    ayuda: "Cómo funcionan las reservas de las clases en directo.",
  },
  "chat.dm_access": {
    titulo: "Quién puede escribirte",
    ayuda: "Qué planes pueden abrir un chat privado con vos.",
  },
  "subscriptions.catalog": {
    titulo: "Planes y precios",
    ayuda: "Los importes de cada plan y sus identificadores de cobro.",
  },
  "subscriptions.access_defaults": {
    titulo: "Reglas de acceso",
    ayuda: "Qué estados de suscripción dan acceso, y qué pasa si no hay ninguna.",
  },
  "content.access": {
    titulo: "Acceso al contenido",
    ayuda: "Reglas generales de qué se ve según el plan.",
  },
  "rewards.progress": {
    titulo: "Logros y constancia",
    ayuda: "Cada cuántas clases se marca un logro.",
  },
  "ui.locales": {
    titulo: "Idiomas de la aplicación",
    ayuda: "Los idiomas disponibles en la web pública.",
  },
};

const PLANES = [
  { key: "none", label: "Sin plan", sub: "Cuentas que todavía no pagan" },
  { key: "corps_de_ballet", label: "Corps de Ballet", sub: "El plan de entrada" },
  { key: "solista", label: "Solista", sub: "Con planes de trabajo" },
  { key: "principal", label: "Principal", sub: "La experiencia completa" },
] as const;

export default async function AdminSettingsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const { data } = await supabase
    .from("site_settings")
    .select("setting_key, category, description, value")
    .order("setting_key");
  const settings = (data ?? []) as SiteSetting[];

  const buscar = (k: string) => settings.find((s) => s.setting_key === k);

  const reservas = (buscar("live_sessions.booking")?.value ?? {}) as {
    allow_waitlist?: boolean;
    reveal_link_only_to_booked_users?: boolean;
  };
  const dm = (buscar("chat.dm_access")?.value ?? {}) as Record<string, boolean>;
  // `subscriptions.catalog` sale de la lista de bloqueadas: desde el 2026-08-05
  // SI se edita, en /admin/precios y con campos de verdad en vez de JSON crudo.
  // Dejarlo aca diciendo "no se edita desde acá" seria mentirle a Brunela.
  const bloqueadas = settings.filter(
    (s) => !EDITABLES.has(s.setting_key) && s.setting_key !== "subscriptions.catalog"
  );

  return (
    <main className="cf">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Ajustes"
        titulo="Configuración"
        lede="Lo que podés cambiar vos, y lo que conviene que toque tu equipo técnico."
      />

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      {/* ── 01 Reservas ── */}
      <form action={guardarAjusteDeReservasAction} className="cf-bloque">
        <div className="cf-cab">
          <span className="cf-ico cf-ico--coral" aria-hidden="true"><CalendarDays size={19} strokeWidth={2.2} /></span>
          <div>
            <h2>{TITULOS["live_sessions.booking"].titulo}</h2>
            <p>{TITULOS["live_sessions.booking"].ayuda}</p>
          </div>
        </div>
        <div className="cf-filas">
          {[
            { name: "allowWaitlist", activo: reservas.allow_waitlist !== false, titulo: "Lista de espera cuando se llena", texto: "Si lo apagás, al completarse el cupo nadie más puede anotarse." },
            { name: "revealOnlyToBooked", activo: reservas.reveal_link_only_to_booked_users !== false, titulo: "El enlace de la clase solo lo ve quien reservó", texto: "Recomendado. Si lo apagás, cualquier alumna con acceso a la clase ve el enlace de Zoom." },
          ].map((f) => (
            <label key={f.name} className="cf-fila">
              <span className="cf-fila-txt">
                <span className="cf-fila-titulo">{f.titulo}</span>
                <span className="cf-fila-sub">{f.texto}</span>
              </span>
              <span className="pf-switch">
                <input type="checkbox" role="switch" name={f.name} defaultChecked={f.activo} />
                <span className="pf-switch-pista" aria-hidden="true"><span /></span>
              </span>
            </label>
          ))}
        </div>
        <div className="cf-pie">
          <BotonEnviar className="pf-guardar" pendingLabel="Guardando…"><Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar reservas</BotonEnviar>
        </div>
      </form>

      {/* ── 02 Chat privado ── */}
      <form action={guardarAjusteDeChatAction} className="cf-bloque">
        <div className="cf-cab">
          <span className="cf-ico cf-ico--melo" aria-hidden="true"><MessageCircle size={19} strokeWidth={2.2} /></span>
          <div>
            <h2>{TITULOS["chat.dm_access"].titulo}</h2>
            <p>{TITULOS["chat.dm_access"].ayuda} Podés elegir varios.</p>
          </div>
        </div>
        <div className="pf-planes cf-planes" role="group" aria-label="Planes que pueden escribirte">
          {PLANES.map((p) => (
            <label key={p.key} className="pf-plan">
              <input type="checkbox" name={`dm_${p.key}`} defaultChecked={dm[p.key] === true} />
              <span className="pf-plan-caja">
                <span className="pf-plan-titulo">{p.label}</span>
                <span className="pf-plan-sub">{p.sub}</span>
                <span className="pf-plan-tilde" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
              </span>
            </label>
          ))}
        </div>
        <div className="cf-pie">
          <BotonEnviar className="pf-guardar" pendingLabel="Guardando…"><Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar chat</BotonEnviar>
        </div>
      </form>

      {/* ── 03 Solo lectura ── */}
      <section className="cf-bloque cf-bloque--tecnico">
        <div className="cf-cab">
          <span className="cf-ico cf-ico--lila" aria-hidden="true"><Settings2 size={19} strokeWidth={2.2} /></span>
          <div>
            <h2>Ajustes técnicos</h2>
            <p>
              Los cambia tu equipo técnico. Se muestran para que sepas qué hay configurado, pero no se editan
              desde acá: un error en las reglas de acceso puede dejar a una alumna sin sus clases.
            </p>
          </div>
        </div>

        <Link href="/admin/precios" className="cf-precios">
          <span className="cf-precios-ico"><Euro size={18} strokeWidth={2} aria-hidden="true" /></span>
          <span className="cf-fila-txt">
            <span className="cf-fila-titulo">Planes y precios</span>
            <span className="cf-fila-sub">Los importes y los identificadores de cobro se cambian en Precios.</span>
          </span>
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </Link>

        <ul className="cf-tecnicos">
          {bloqueadas.map((s) => {
            const meta = TITULOS[s.setting_key];
            return (
              <li key={s.setting_key}>
                <Lock size={14} strokeWidth={2} aria-hidden="true" />
                {/* La `description` de la base esta en ingles y se veia tal
                    cual en pantalla. Se usa la de aca, en el idioma del panel. */}
                <span className="cf-fila-txt">
                  <span className="cf-fila-titulo">{meta?.titulo ?? s.setting_key}</span>
                  <span className="cf-fila-sub">{meta?.ayuda ?? s.setting_key}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

const CSS = `
.cf { display: flex; flex-direction: column; gap: 18px; padding-bottom: 40px; }
.cf .ad-mast { margin-bottom: 4px; }
.cf-bloque { border: 1px solid var(--linea); border-radius: 28px; background: #fff; padding: clamp(18px, 2.6vw, 30px); box-shadow: var(--sombra); }
.cf-bloque--tecnico { background: linear-gradient(150deg, #FBF8FD, #FFFAF6 65%); box-shadow: none; border-color: #EFE3F4; }
.cf-cab { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
.cf-ico { width: 44px; height: 44px; border-radius: 15px; flex-shrink: 0; display: grid; place-items: center; }
.cf-ico--coral { background: var(--rubor); color: var(--pink-deep); }
.cf-ico--melo { background: #FFEEDB; color: var(--melocoton-deep); }
.cf-ico--lila { background: #FFEDE6; color: #B4533A; }
.cf-cab h2 { font-family: var(--font-display), sans-serif; font-weight: 900; font-size: 20px; letter-spacing: -0.02em; color: var(--ink); }
.cf-cab p { margin-top: 3px; max-width: 68ch; font-size: 14px; line-height: 1.6; color: var(--muted); }
.cf-filas { display: flex; flex-direction: column; gap: 10px; }
.cf-fila { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 18px; border-radius: 20px; background: var(--crema); border: 1.5px solid var(--linea); cursor: pointer; transition: border-color .2s, background .2s; }
.cf-fila:hover { border-color: var(--linea-fuerte); }
.cf-fila:has(input:checked) { background: var(--rubor); border-color: var(--pink-line); }
.cf-fila-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cf-fila-titulo { font-size: 15px; font-weight: 800; color: var(--ink); }
.cf-fila-sub { font-size: 13px; line-height: 1.5; color: var(--muted); }
.cf-planes { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 0; }
.cf-planes .pf-plan-caja { border-radius: 20px; }
.cf-pie { display: flex; justify-content: flex-end; margin-top: 20px; }
.cf-precios {
  display: flex; align-items: center; gap: 14px; padding: 14px 18px; margin-bottom: 12px; border-radius: 20px; text-decoration: none;
  background: #fff; border: 1.5px solid var(--pink-line); color: var(--pink-deep); box-shadow: var(--sombra);
  transition: border-color .2s, transform .35s var(--curva), box-shadow .35s var(--curva);
}
.cf-precios:hover { border-color: var(--pink); transform: translateY(-2px); box-shadow: var(--sombra-alta); }
.cf-precios .cf-fila-txt { flex: 1; }
.cf-precios-ico { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--pink); color: #fff; box-shadow: 0 10px 20px -10px rgba(230,79,85,.8); }
.cf-tecnicos { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
.cf-tecnicos li { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 20px; background: #fff; border: 1px solid var(--linea); }
.cf-tecnicos li > svg { box-sizing: content-box; padding: 7px; border-radius: 11px; background: #FFEDE6; color: #B4533A; flex-shrink: 0; }
@media (max-width: 560px) {
  .cf-fila { padding: 14px; gap: 14px; }
  .cf-pie .pf-guardar { width: 100%; justify-content: center; }
}
`;
