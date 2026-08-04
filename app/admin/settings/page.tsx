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
  { key: "none", label: "Sin plan" },
  { key: "corps_de_ballet", label: "Corps de Ballet" },
  { key: "solista", label: "Solista" },
  { key: "principal", label: "Principal" },
] as const;

function Flash({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;
  return (
    <div style={{
      borderRadius: 14, padding: "11px 16px", fontSize: 13, fontWeight: 600,
      background: tone === "success" ? "#f0fdf4" : "#fef2f2",
      color: tone === "success" ? "#166534" : "#991b1b",
      border: `1px solid ${tone === "success" ? "#bbf7d0" : "#fecaca"}`,
    }}>{message}</div>
  );
}

const caja: React.CSSProperties = {
  borderRadius: 22, border: "1.5px solid var(--pink-line)",
  background: "#fff", padding: "22px 24px",
};

const filaCheck: React.CSSProperties = {
  display: "flex", gap: 12, alignItems: "flex-start",
  cursor: "pointer", minHeight: 44,
};

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
  const bloqueadas = settings.filter((s) => !EDITABLES.has(s.setting_key));

  return (
    <main style={{ fontFamily: "inherit" }}>
      <header className="hero-stage">
        <p className="eyebrow">Configuración</p>
        <h1 className="display mt-5 text-5xl leading-none md:text-6xl">Ajustes del estudio.</h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
          Lo que podés cambiar vos, y lo que conviene que toque tu equipo técnico.
        </p>
      </header>

      <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
        <Flash message={success} tone="success" />
        <Flash message={error} tone="error" />

        {/* ── Reservas ─────────────────────────────────────────────────── */}
        <section style={caja}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
            {TITULOS["live_sessions.booking"].titulo}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 18px", lineHeight: 1.6 }}>
            {TITULOS["live_sessions.booking"].ayuda}
          </p>

          <form action={guardarAjusteDeReservasAction} style={{ display: "grid", gap: 12 }}>
            <label style={filaCheck}>
              <input type="checkbox" name="allowWaitlist" defaultChecked={reservas.allow_waitlist !== false}
                style={{ accentColor: "var(--pink)", width: 17, height: 17, marginTop: 2 }} />
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                  Lista de espera cuando se llena
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
                  Si lo apagás, al completarse el cupo nadie más puede anotarse.
                </span>
              </span>
            </label>

            <label style={filaCheck}>
              <input type="checkbox" name="revealOnlyToBooked" defaultChecked={reservas.reveal_link_only_to_booked_users !== false}
                style={{ accentColor: "var(--pink)", width: 17, height: 17, marginTop: 2 }} />
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                  El link de la clase sólo lo ve quien reservó
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
                  Recomendado. Si lo apagás, cualquier alumna con acceso a la clase ve el enlace.
                </span>
              </span>
            </label>

            <BotonEnviar className="button-primary" style={{ justifySelf: "start", marginTop: 4 }}>Guardar</BotonEnviar>
          </form>
        </section>

        {/* ── Chat privado ─────────────────────────────────────────────── */}
        <section style={caja}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
            {TITULOS["chat.dm_access"].titulo}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 18px", lineHeight: 1.6 }}>
            {TITULOS["chat.dm_access"].ayuda}
          </p>

          <form action={guardarAjusteDeChatAction} style={{ display: "grid", gap: 10 }}>
            {PLANES.map((p) => (
              <label key={p.key} style={{ ...filaCheck, alignItems: "center" }}>
                <input type="checkbox" name={`dm_${p.key}`} defaultChecked={dm[p.key] === true}
                  style={{ accentColor: "var(--pink)", width: 17, height: 17 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{p.label}</span>
              </label>
            ))}
            <BotonEnviar className="button-primary" style={{ justifySelf: "start", marginTop: 4 }}>Guardar</BotonEnviar>
          </form>
        </section>

        {/* ── Solo lectura ─────────────────────────────────────────────── */}
        <section style={{ ...caja, background: "var(--pink-wash)", borderStyle: "dashed" }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
            Ajustes técnicos
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 4px", lineHeight: 1.6 }}>
            Esto lo cambia tu equipo técnico. Te lo mostramos para que sepas qué
            hay configurado, pero no se edita desde acá: un error en los precios
            deja el cobro sin funcionar, y uno en las reglas de acceso puede
            dejar a una alumna sin sus clases.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {bloqueadas.map((s) => {
              const meta = TITULOS[s.setting_key];
              return (
                <div key={s.setting_key} style={{
                  borderRadius: 14, border: "1px solid var(--pink-line)",
                  background: "rgba(255,255,255,0.7)", padding: "13px 16px",
                }}>
                  <p style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
                    {meta?.titulo ?? s.setting_key}
                  </p>
                  {/* La `description` de la base esta en ingles y se veia tal
                      cual en pantalla. Se usa la de aca, en el idioma del panel. */}
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "3px 0 0", lineHeight: 1.5 }}>
                    {meta?.ayuda ?? s.setting_key}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
