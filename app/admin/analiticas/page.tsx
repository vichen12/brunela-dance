import Link from "next/link";
import { requireAdmin } from "@/src/features/auth/guards";
import {
  getAnalitica,
  type Umbral,
} from "@/src/features/admin/analitica/queries";

export const dynamic = "force-dynamic";

/**
 * Panel de analiticas -- primera mitad.
 *
 * Solo las metricas que funcionan con datos que YA existen. Las que necesitan
 * historia acumulada (frecuencia, franjas horarias, reproducciones) llegan
 * cuando activity_events tenga semanas encima.
 *
 * TRES REGLAS DE ESTA PANTALLA
 *   1. Los bloques se llaman como la PREGUNTA, no como la metrica. Brunela no
 *      es tecnica: "churn" no le dice nada, "cuantas se dieron de baja" si.
 *   2. Ningun numero sin una linea que lo interprete. Un 7% solo no significa
 *      nada; "es normal entre 5% y 10%" si.
 *   3. Ninguna cifra inventada. Cuando la muestra es chica se dice, no se
 *      dibuja igual. Por eso aca no hay sparklines: no hay serie historica
 *      todavia, y una linea de tendencia falsa es una mentira sobre la que se
 *      pueden tomar decisiones.
 */

// ── Piezas ───────────────────────────────────────────────────────────────────

function Tarjeta({
  valor, etiqueta, ayuda, tono = "normal",
}: {
  valor: string | number;
  etiqueta: string;
  ayuda: string;
  tono?: "normal" | "alerta";
}) {
  return (
    <div style={{
      background: "#fff", border: "1.5px solid #f0eeec", borderRadius: 20,
      padding: "22px 24px", display: "flex", flexDirection: "column", gap: 6,
    }}>
      <p className="display" style={{
        fontSize: 40, lineHeight: 1, margin: 0,
        color: tono === "alerta" ? "var(--pink-deep)" : "#1c1917",
      }}>{valor}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1917", margin: 0 }}>{etiqueta}</p>
      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>{ayuda}</p>
    </div>
  );
}

/** Lo que se muestra en vez del numero cuando la muestra es demasiado chica. */
function SinDatos({ umbral, explica }: { umbral: Umbral; explica?: string }) {
  return (
    <div style={{
      border: "1.5px dashed var(--pink-line)", borderRadius: 16,
      background: "#fffdfd", padding: "22px 24px",
    }}>
      <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pink-deep)", margin: 0 }}>
        Todavía no hay suficientes datos
      </p>
      <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.65, margin: "8px 0 0" }}>
        Este número necesita al menos <strong>{umbral.minimo} {umbral.que}</strong> para
        significar algo. Hoy {umbral.hoy === 1 ? "hay" : "hay"} <strong>{umbral.hoy}</strong>.
        {explica ? ` ${explica}` : ""}
      </p>
    </div>
  );
}

function Bloque({
  pregunta, children, accion,
}: {
  pregunta: string;
  children: React.ReactNode;
  accion?: { href: string; texto: string };
}) {
  return (
    <section style={{
      background: "#fff", border: "1.5px solid #f0eeec", borderRadius: 20,
      padding: "24px 26px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 21, color: "#1c1917", margin: 0, lineHeight: 1.25 }}>
          {pregunta}
        </h2>
        {accion && (
          <Link href={accion.href as never} style={{
            fontSize: 12, fontWeight: 700, color: "var(--pink-deep)",
            textDecoration: "none", whiteSpace: "nowrap",
          }}>{accion.texto}</Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Barras({ filas }: { filas: { etiqueta: string; cantidad: number }[] }) {
  const total = filas.reduce((s, f) => s + f.cantidad, 0) || 1;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {filas.map((f) => (
        <div key={f.etiqueta} style={{ display: "grid", gridTemplateColumns: "130px 1fr 44px", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12.5, color: "#57534e" }}>{f.etiqueta}</span>
          <div style={{ height: 10, borderRadius: 99, background: "var(--pink-wash)", overflow: "hidden" }}>
            <div style={{
              width: `${Math.round((f.cantidad / total) * 100)}%`, height: "100%",
              background: "var(--pink)", borderRadius: 99,
            }} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1c1917", textAlign: "right" }}>{f.cantidad}</span>
        </div>
      ))}
    </div>
  );
}

const vacio: React.CSSProperties = {
  fontSize: 12.5, color: "var(--muted)", lineHeight: 1.65, margin: 0,
};

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default async function AnaliticasPage() {
  await requireAdmin();
  const a = await getAnalitica();

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">

        <header className="hero-stage">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div style={{ minWidth: 280, flex: 1 }}>
              <p className="eyebrow">Analíticas del estudio</p>
              <h1 className="display mt-5 text-5xl leading-none md:text-7xl">
                Cómo va<span style={{ color: "var(--pink)" }}>.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
                Quiénes entrenan, quiénes se están yendo y qué contenido no está
                usando nadie.
              </p>
            </div>
            <a href="/api/admin/export/alumnas" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "13px 22px", borderRadius: 999, textDecoration: "none",
              background: "var(--pink)", color: "#fff",
              fontSize: 13, fontWeight: 700,
              boxShadow: "0 4px 14px rgba(230, 79, 85,0.35)",
            }}>Descargar alumnas (CSV)</a>
          </div>
        </header>

        {/* La franja que evita que "todo en cero" parezca un sistema roto. */}
        {a.estudioVacio && (
          <div style={{
            border: "1.5px solid var(--pink-soft)", borderRadius: 18,
            background: "var(--pink-wash)", padding: "18px 22px",
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pink-deep)", margin: 0 }}>
              El estudio recién arranca
            </p>
            <p style={{ fontSize: 12.5, color: "var(--pink-muted)", lineHeight: 1.7, margin: "8px 0 0" }}>
              Los números de abajo van a estar en cero hasta que haya clases
              publicadas y alumnas entrenando. No está roto: no hay nada que
              medir todavía. Cada bloque avisa cuánto hace falta para que su
              número signifique algo.
            </p>
          </div>
        )}

        {/* ── Cuatro números ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          <Tarjeta
            valor={a.churn.activas}
            etiqueta="Alumnas con plan activo"
            ayuda="Incluye las que están en prueba y las que tienen un pago pendiente."
          />
          <Tarjeta
            valor={a.churn.bajasEsteMes}
            etiqueta="Se dieron de baja este mes"
            ayuda={
              a.churn.umbral.suficiente && a.churn.porcentaje !== null
                ? `Es el ${a.churn.porcentaje}% de tus alumnas. Entre 5% y 10% al mes es lo habitual.`
                : "Todavía son muy pocas para sacar un porcentaje."
            }
            tono={a.churn.bajasEsteMes > 0 ? "alerta" : "normal"}
          />
          <Tarjeta
            valor={
              a.conversion.umbral.suficiente && a.conversion.deCada10 !== null
                ? `${a.conversion.deCada10} de 10`
                : `${a.conversion.conPlan} de ${a.conversion.registradas}`
            }
            etiqueta="De las que se registran, cuántas pagan"
            ayuda={
              a.conversion.umbral.suficiente
                ? "Se cuenta sobre todas las que crearon cuenta alguna vez."
                : `Necesita ${a.conversion.umbral.minimo} registradas para ser un porcentaje confiable.`
            }
          />
          <Tarjeta
            valor={a.inactividad.alumnas.length}
            etiqueta={`Sin entrar hace más de ${a.inactividad.diasCorte} días`}
            ayuda="Sólo alumnas que están pagando. Son a las que conviene escribirles."
            tono={a.inactividad.alumnas.length > 0 ? "alerta" : "normal"}
          />
        </div>

        {/* ── Inactividad ────────────────────────────────────────────────── */}
        <Bloque pregunta="¿Quiénes están dejando de entrenar?">
          {!a.inactividad.umbral.suficiente ? (
            <SinDatos umbral={a.inactividad.umbral} />
          ) : a.inactividad.alumnas.length === 0 ? (
            <p style={vacio}>
              Ninguna alumna con plan lleva más de {a.inactividad.diasCorte} días
              sin entrar. Es la mejor señal que puede dar este bloque.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {a.inactividad.alumnas.slice(0, 12).map((al) => (
                <Link key={al.id} href={`/admin/users/${al.id}` as never} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 14, padding: "13px 16px", borderRadius: 14,
                  background: "#fafaf9", border: "1.5px solid #f0eeec", textDecoration: "none",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1917", margin: 0 }}>{al.nombre}</p>
                    <p style={{ fontSize: 11, color: "#a8a29e", margin: "2px 0 0" }}>{al.plan}</p>
                  </div>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, color: "var(--pink-deep)",
                    background: "var(--pink-wash)", padding: "5px 11px", borderRadius: 99,
                    whiteSpace: "nowrap",
                  }}>
                    {al.diasSinEntrar === null ? "Nunca entró" : `${al.diasSinEntrar} días`}
                  </span>
                </Link>
              ))}
              {a.inactividad.alumnas.length > 12 && (
                <p style={{ ...vacio, marginTop: 4 }}>
                  Y {a.inactividad.alumnas.length - 12} más.
                </p>
              )}
            </div>
          )}
        </Bloque>

        {/* ── Contenido sin uso ──────────────────────────────────────────── */}
        <Bloque
          pregunta="¿Qué clases no está usando nadie?"
          accion={{ href: "/admin/videos", texto: "Ir a clases" }}
        >
          {!a.sinUso.umbral.suficiente ? (
            <SinDatos
              umbral={a.sinUso.umbral}
              explica="Con pocas alumnas, que una clase no tenga uso no dice nada del contenido."
            />
          ) : a.sinUso.clases.length === 0 ? (
            <p style={vacio}>
              Las {a.sinUso.totalPublicadas} clases publicadas tienen al menos una
              alumna que las empezó.
            </p>
          ) : (
            <>
              <p style={{ ...vacio, marginBottom: 14 }}>
                {a.sinUso.clases.length} de {a.sinUso.totalPublicadas} clases publicadas
                no las empezó ninguna alumna todavía.
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                {a.sinUso.clases.slice(0, 10).map((c) => (
                  <div key={c.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 14, padding: "12px 16px", borderRadius: 14,
                    background: "#fafaf9", border: "1.5px solid #f0eeec",
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1c1917", margin: 0 }}>{c.titulo}</p>
                    <span style={{ fontSize: 11, color: "#a8a29e", whiteSpace: "nowrap" }}>
                      {c.publicadaHace !== null ? `publicada hace ${c.publicadaHace} días` : "sin fecha"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Bloque>

        {/* ── Segmentacion ───────────────────────────────────────────────── */}
        <Bloque pregunta="¿Cómo se reparten tus alumnas?">
          {!a.segmentacion.umbral.suficiente ? (
            <SinDatos umbral={a.segmentacion.umbral} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 26 }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 12 }}>Por plan</p>
                <Barras filas={a.segmentacion.porPlan} />
              </div>
              <div>
                <p className="eyebrow" style={{ marginBottom: 12 }}>Por nivel</p>
                <Barras filas={a.segmentacion.porNivel} />
              </div>
            </div>
          )}
        </Bloque>

        {/* ── Programas ──────────────────────────────────────────────────── */}
        <Bloque
          pregunta="¿Terminan los programas?"
          accion={{ href: "/admin/programs", texto: "Ir a programas" }}
        >
          {a.programas.length === 0 ? (
            <p style={vacio}>Todavía no hay programas cargados.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {a.programas.map((p) => (
                <div key={p.id} style={{
                  padding: "14px 16px", borderRadius: 14,
                  background: "#fafaf9", border: "1.5px solid #f0eeec",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "baseline" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1917", margin: 0 }}>{p.titulo}</p>
                    <span style={{ fontSize: 11, color: "#a8a29e" }}>{p.dias} días</span>
                  </div>
                  {!p.umbral.suficiente ? (
                    <p style={{ ...vacio, marginTop: 8, fontSize: 11.5 }}>
                      Lo empezaron {p.laEmpezaron}{" "}
                      {p.laEmpezaron === 1 ? "alumna" : "alumnas"}. Hacen falta{" "}
                      {p.umbral.minimo} para saber si el programa se termina o se abandona.
                    </p>
                  ) : (
                    <p style={{ ...vacio, marginTop: 8, fontSize: 12 }}>
                      Lo empezaron <strong>{p.laEmpezaron}</strong> y lo terminaron{" "}
                      <strong>{p.laTerminaron}</strong>.
                      {p.diaDeAbandono !== null && (
                        <> La mayoría de las que lo dejaron se quedó en el{" "}
                        <strong>día {p.diaDeAbandono}</strong>.</>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Bloque>

        {/* ── Ingresos: se enlaza, no se recalcula ───────────────────────── */}
        <Bloque pregunta="¿Cuánto facturé?">
          <p style={vacio}>
            Los ingresos están en <strong>Stripe</strong>, que es donde se cobran
            los pagos. Ahí ves cuánto entró este mes, cómo viene contra el
            anterior, y los reembolsos e impuestos ya descontados.
          </p>
          <p style={{ ...vacio, marginTop: 10 }}>
            No lo repetimos acá a propósito: un cálculo propio daría un número
            distinto al de Stripe, y no habría forma de saber cuál de los dos
            mirar.
          </p>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16,
              padding: "11px 20px", borderRadius: 999, textDecoration: "none",
              background: "#fff", color: "var(--pink-deep)",
              border: "1.5px solid var(--pink-line)", fontSize: 12.5, fontWeight: 700,
            }}
          >Abrir Stripe</a>
        </Bloque>

      </section>
    </main>
  );
}
