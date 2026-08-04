import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { getFichaAlumna } from "@/src/features/admin/analitica/alumna";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

const tarjeta: React.CSSProperties = {
  background: "#fff", border: "1.5px solid #f0eeec", borderRadius: 20, padding: "22px 24px",
};

function Dato({ valor, etiqueta }: { valor: string | number; etiqueta: string }) {
  return (
    <div>
      <p className="display" style={{ fontSize: 30, lineHeight: 1, margin: 0, color: "#1c1917" }}>{valor}</p>
      <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "4px 0 0" }}>{etiqueta}</p>
    </div>
  );
}

/**
 * Ficha individual de una alumna.
 *
 * Es la pantalla que Brunela abre cuando alguien le escribe o cuando quiere
 * entender por que una alumna dejo de entrenar. Por eso todo lo que muestra
 * termina en una accion posible: escribirle, ver su plan, mirar sus clases.
 */
export default async function FichaAlumnaPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  if (!UUID.test(id)) notFound();

  const f = await getFichaAlumna(id);
  if (!f) notFound();

  const inactiva = f.actividad.diasSinEntrar !== null && f.actividad.diasSinEntrar > 14;

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">

        <header className="hero-stage">
          <Link href={"/admin/users" as never} style={{
            fontSize: 12, fontWeight: 700, color: "var(--pink-deep)", textDecoration: "none",
          }}>← Volver a alumnas</Link>

          <h1 className="display mt-4 text-4xl leading-none md:text-6xl">
            {f.perfil.nombre}<span style={{ color: "var(--pink)" }}>.</span>
          </h1>
          <p className="mt-4 text-base text-[color:var(--ink-soft)]">{f.perfil.email}</p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            <span style={{
              fontSize: 11.5, fontWeight: 700, padding: "6px 13px", borderRadius: 99,
              background: "var(--pink-wash)", color: "var(--pink-deep)",
            }}>{f.perfil.plan}</span>
            <span style={{
              fontSize: 11.5, fontWeight: 700, padding: "6px 13px", borderRadius: 99,
              background: "#f5f5f4", color: "#57534e",
            }}>{f.perfil.nivel}</span>
            {inactiva && (
              <span style={{
                fontSize: 11.5, fontWeight: 700, padding: "6px 13px", borderRadius: 99,
                background: "#1c1917", color: "var(--pink-wash)",
              }}>Sin entrar hace {f.actividad.diasSinEntrar} días</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
            <Link href={"/admin/chat" as never} style={{
              padding: "11px 20px", borderRadius: 999, textDecoration: "none",
              background: "var(--pink)", color: "#fff", fontSize: 12.5, fontWeight: 700,
            }}>Escribirle</Link>
            <Link href={"/admin/users" as never} style={{
              padding: "11px 20px", borderRadius: 999, textDecoration: "none",
              background: "#fff", color: "var(--pink-deep)",
              border: "1.5px solid var(--pink-line)", fontSize: 12.5, fontWeight: 700,
            }}>Cambiar su plan</Link>
          </div>
        </header>

        {/* Numeros de un vistazo */}
        <div style={{ ...tarjeta, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 20 }}>
          <Dato valor={f.actividad.clasesEmpezadas} etiqueta="Clases empezadas" />
          <Dato valor={f.actividad.clasesTerminadas} etiqueta="Clases terminadas" />
          <Dato valor={f.reservas.total} etiqueta="Sesiones reservadas" />
          <Dato valor={f.reservas.asistio} etiqueta="A las que asistió" />
          <Dato valor={f.mensajes} etiqueta="Mensajes enviados" />
        </div>

        {/* Suscripcion */}
        <div style={tarjeta}>
          <h2 className="display" style={{ fontSize: 19, margin: "0 0 14px", color: "#1c1917" }}>Su plan</h2>
          {!f.suscripcion ? (
            <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
              No tiene ninguna suscripción registrada. Se registró el {fecha(f.perfil.registradaEl)}
              {!f.perfil.onboardingCompleto && " y no llegó a terminar el registro"}.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8, fontSize: 12.5, color: "#57534e", lineHeight: 1.7 }}>
              <p style={{ margin: 0 }}>
                <strong>{f.suscripcion.plan}</strong> — {f.suscripcion.etiquetaEstado}
              </p>
              {f.suscripcion.seDaDeBaja && (
                <p style={{ margin: 0, color: "var(--pink-deep)", fontWeight: 700 }}>
                  Pidió darse de baja. Mantiene el acceso hasta el {fecha(f.suscripcion.finDePeriodo)}.
                </p>
              )}
              {f.suscripcion.canceladaEl && (
                <p style={{ margin: 0 }}>Se dio de baja el {fecha(f.suscripcion.canceladaEl)}.</p>
              )}
              <p style={{ margin: 0, color: "#a8a29e" }}>
                Alumna desde el {fecha(f.perfil.registradaEl)}.
              </p>
            </div>
          )}
        </div>

        {/* Objetivos: lo que ella dijo que buscaba */}
        <div style={tarjeta}>
          <h2 className="display" style={{ fontSize: 19, margin: "0 0 6px", color: "#1c1917" }}>Qué buscaba</h2>
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 14px" }}>
            Lo eligió ella cuando se registró.
          </p>
          {f.perfil.objetivos.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>No completó esta parte.</p>
          ) : (
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {f.perfil.objetivos.map((o) => (
                <span key={o} style={{
                  fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 99,
                  background: "var(--pink-wash)", color: "var(--pink-deep)",
                }}>{o}</span>
              ))}
            </div>
          )}
        </div>

        {/* Clases */}
        <div style={tarjeta}>
          <h2 className="display" style={{ fontSize: 19, margin: "0 0 14px", color: "#1c1917" }}>
            Sus últimas clases
          </h2>
          {f.clases.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
              Todavía no empezó ninguna clase.
              {f.suscripcion && " Tiene plan activo, así que puede ser un buen momento para escribirle."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {f.clases.map((c) => (
                <div key={c.videoId} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 14, padding: "12px 16px", borderRadius: 14,
                  background: "#fafaf9", border: "1.5px solid #f0eeec",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1c1917", margin: 0 }}>{c.titulo}</p>
                    <p style={{ fontSize: 11, color: "#a8a29e", margin: "2px 0 0" }}>{fecha(c.cuando)}</p>
                  </div>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
                    padding: "5px 11px", borderRadius: 99,
                    background: c.terminada ? "#dcfce7" : "var(--pink-wash)",
                    color: c.terminada ? "#166534" : "var(--pink-deep)",
                  }}>
                    {c.terminada ? "Terminada" : `${c.porcentaje}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </section>
    </main>
  );
}
