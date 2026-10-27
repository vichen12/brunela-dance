import Link from "next/link";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { AdminCabecera, AdminCifras } from "@/components/admin-ui";

export const dynamic = "force-dynamic";

/**
 * Referidos, del lado de Brunela: quien invito a quien y que premios se dieron.
 * El premio (un mes gratis para la que invita, cuando la amiga paga por
 * primera vez) lo da solo el webhook: aca solo se mira.
 */
export default async function AdminReferidosPage() {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("referidos")
    .select("referida_id, referente_id, created_at, estado, premio_cents, premiado_at, detalle")
    .order("created_at", { ascending: false })
    .limit(500);
  const falta = !!error;
  type Fila = { referida_id: string; referente_id: string; created_at: string; estado: string; premio_cents: number | null; premiado_at: string | null; detalle: string | null };
  const filas = (data ?? []) as Fila[];
  const ids = [...new Set(filas.flatMap((f) => [f.referida_id, f.referente_id]))];
  const { data: perfiles } = ids.length
    ? await db.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };
  const quien = new Map(((perfiles ?? []) as { id: string; full_name: string | null; email: string }[]).map((p) => [p.id, p]));
  const nombre = (id: string) => quien.get(id)?.full_name?.trim() || quien.get(id)?.email || "—";
  const otorgados = filas.filter((f) => f.estado === "otorgado");
  const euros = otorgados.reduce((n, f) => n + (f.premio_cents ?? 0), 0) / 100;
  const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" });

  return (
    <main className="arf">
      <style>{CSS}</style>
      <AdminCabecera
        eyebrow="Comunidad"
        titulo="Referidos"
        lede="Cada alumna tiene su enlace en «Invitá a una amiga». Cuando una amiga que entró con ese enlace paga por primera vez, la que la invitó gana un mes gratis: se le descuenta solo de su próximo cobro."
      />
      {falta ? (
        <p className="arf-aviso">Para activar los referidos falta correr la migración 20261026_4_referidos.sql en Supabase.</p>
      ) : (
        <>
          <AdminCifras items={[
            { label: "Amigas que se sumaron", value: filas.length, sub: "con un enlace de invitación" },
            { label: "Meses gratis dados", value: otorgados.length, sub: "ya pagaron su primer mes" },
            { label: "Descontado", value: `${euros.toLocaleString("es-ES")} €`, sub: "en créditos de Stripe" },
          ]} />
          {filas.length === 0 ? (
            <p className="arf-vacio">Todavía no se sumó nadie con un enlace de invitación.</p>
          ) : (
            <ul className="arf-lista">
              {filas.map((f) => (
                <li key={f.referida_id}>
                  <span className="arf-txt">
                    <strong><Link href={`/admin/users/${f.referente_id}` as never}>{nombre(f.referente_id)}</Link></strong> invitó a{" "}
                    <strong><Link href={`/admin/users/${f.referida_id}` as never}>{nombre(f.referida_id)}</Link></strong>
                    <small>se sumó el {fecha(f.created_at)}{f.detalle ? ` · ${f.detalle}` : ""}</small>
                  </span>
                  <span className={"arf-estado arf-estado--" + f.estado}>
                    {f.estado === "otorgado"
                      ? `Mes gratis dado (${((f.premio_cents ?? 0) / 100).toLocaleString("es-ES")} €)`
                      : f.estado === "error" ? "No se pudo dar: se reintenta" : "Esperando su primer pago"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

const CSS = `
.arf { display: flex; flex-direction: column; gap: 14px; }
.arf-aviso { margin: 0; padding: 16px 18px; border-radius: 18px; background: #FFF4E8; color: var(--melocoton-deep); font-weight: 700; }
.arf-vacio { margin: 0; padding: 22px; border-radius: 22px; border: 1.5px dashed var(--linea-fuerte); background: var(--crema); color: var(--muted); text-align: center; }
.arf-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.arf-lista li { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-radius: 20px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.arf-txt { flex: 1; min-width: 0; font-size: 14.5px; color: var(--muted); }
.arf-txt strong a { color: var(--ink); text-decoration: none; }
.arf-txt strong a:hover { color: var(--pink-deep); }
.arf-txt small { display: block; font-size: 12.5px; margin-top: 2px; }
.arf-estado { font-size: 12.5px; font-weight: 800; padding: 5px 12px; border-radius: 99px; white-space: nowrap; background: #FFF4E8; color: var(--melocoton-deep); }
.arf-estado--otorgado { background: var(--pink); color: #fff; }
.arf-estado--error { background: #FDE2E2; color: var(--pink-deep); }
`;
