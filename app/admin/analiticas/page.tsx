import Link from "next/link";
import { requireAdmin } from "@/src/features/auth/guards";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Download, ExternalLink, Hourglass, ListChecks, Moon, Package, PieChart, PlayCircle, Receipt, Repeat, Sparkles, Sprout, UserMinus, Users, Wallet } from "lucide-react";
import { AdminCabecera } from "@/components/admin-ui";
import {
  getAnalitica,
  type Umbral,
} from "@/src/features/admin/analitica/queries";
import { getFacturacion, type Facturacion } from "@/src/features/admin/analitica/facturacion";

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

/*
 * Colores de la paleta para las barras y las tarjetas: coral, melocoton,
 * salvia y lila palido. Las tarjetas van en pastel; las barras en el tono
 * medio, que se lee sobre blanco sin gritar.
 */
const TONOS = ["coral", "melo", "salvia", "lila"] as const;
type Tono = (typeof TONOS)[number];

function Tarjeta({
  valor, etiqueta, ayuda, tono = "normal", color, icono, extra,
}: {
  valor: string | number;
  etiqueta: string;
  ayuda: string;
  tono?: "normal" | "alerta";
  color: Tono;
  icono: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className={`aa-tarjeta aa-tarjeta--${color}` + (tono === "alerta" ? " es-alerta" : "")}>
      <span className="aa-tarjeta-ico" aria-hidden="true">{icono}</span>
      {extra && <span className="aa-tarjeta-extra">{extra}</span>}
      <p className="aa-tarjeta-num">{valor}</p>
      <p className="aa-tarjeta-etq">{etiqueta}</p>
      <p className="aa-tarjeta-ayuda">{ayuda}</p>
    </div>
  );
}

/** Lo que se muestra en vez del numero cuando la muestra es demasiado chica. */
function SinDatos({ umbral, explica }: { umbral: Umbral; explica?: string }) {
  return (
    <div className="aa-sindatos">
      <span className="aa-burbuja aa-burbuja--lila" aria-hidden="true"><Hourglass size={18} strokeWidth={2.2} /></span>
      <div>
        <p className="aa-sindatos-titulo">
          Todavía no hay suficientes datos
        </p>
        <p className="aa-txt">
          Este número necesita al menos <strong>{umbral.minimo} {umbral.que}</strong> para
          significar algo. Hoy {umbral.hoy === 1 ? "hay" : "hay"} <strong>{umbral.hoy}</strong>.
          {explica ? ` ${explica}` : ""}
        </p>
      </div>
    </div>
  );
}

function Bloque({
  pregunta, children, accion, icono, color = "coral",
}: {
  pregunta: string;
  children: React.ReactNode;
  accion?: { href: string; texto: string };
  icono: React.ReactNode;
  color?: Tono;
}) {
  return (
    <section className="aa-bloque">
      <div className="aa-bloque-cab">
        <span className={`aa-burbuja aa-burbuja--${color}`} aria-hidden="true">{icono}</span>
        <h2 className="aa-bloque-titulo">
          {pregunta}
        </h2>
        {accion && (
          <Link href={accion.href as never} className="aa-bloque-accion">
            {accion.texto} <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Barras({ filas }: { filas: { etiqueta: string; cantidad: number }[] }) {
  const total = filas.reduce((s, f) => s + f.cantidad, 0) || 1;
  return (
    <div className="aa-barras">
      {filas.map((f, i) => (
        <div key={f.etiqueta} className={`aa-barra aa-barra--${TONOS[i % TONOS.length]}`}>
          <span className="aa-barra-etq">{f.etiqueta}</span>
          <div className="aa-barra-pista">
            <div className="aa-barra-relleno" style={{ width: `${Math.round((f.cantidad / total) * 100)}%` }} />
          </div>
          <span className="aa-barra-num">{f.cantidad}</span>
        </div>
      ))}
    </div>
  );
}

// ── Facturacion ──────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const EUR_REDONDO = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euros = (centimos: number) => EUR.format(centimos / 100);
const eurosRedondo = (centimos: number) => EUR_REDONDO.format(Math.round(centimos / 100));

const NOMBRE_PLAN: Record<string, string> = {
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal",
  otro: "Otros precios",
};

/** Los ultimos 12 meses, en barras. Una sola serie: no lleva leyenda. */
function GraficoMeses({ meses }: { meses: Extract<Facturacion, { estado: "ok" }>["meses"] }) {
  const max = Math.max(...meses.map((m) => m.netoCentimos), 1);
  const iMax = meses.findIndex((m) => m.netoCentimos === max);
  return (
    <figure className="aa-graf" aria-label="Facturado por mes, últimos 12 meses">
      <div className="aa-graf-zona">
        {meses.map((m, i) => {
          const alto = m.netoCentimos > 0 ? Math.max(2, (m.netoCentimos / max) * 100) : 0;
          const esActual = i === meses.length - 1;
          const conEtiqueta = (esActual || i === iMax) && m.netoCentimos !== 0;
          return (
            <div
              key={m.clave}
              className={"aa-graf-col" + (esActual ? " es-actual" : "")}
              tabIndex={0}
              aria-label={`${m.largo}: ${euros(m.netoCentimos)}`}
            >
              <span className="aa-graf-tip" aria-hidden="true">
                <strong>{euros(m.netoCentimos)}</strong> {m.largo}
              </span>
              <div className="aa-graf-pista">
                {conEtiqueta && <span className="aa-graf-valor" style={{ bottom: `calc(${alto}% + 6px)` }}>{eurosRedondo(m.netoCentimos)}</span>}
                <div className="aa-graf-barra" style={{ height: `${alto}%`, animationDelay: `${i * 0.03}s` }} />
              </div>
              <span className="aa-graf-mes">{m.corto}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="aa-graf-pie">Neto por mes, ya descontadas comisiones y reembolsos. Pasá el cursor por una barra para ver el importe.</figcaption>
    </figure>
  );
}

function BloqueFacturacion({ f }: { f: Facturacion }) {
  const abrirStripe = (
    <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="aa-bloque-accion">
      Abrir Stripe <ExternalLink size={13} strokeWidth={2.4} aria-hidden="true" />
    </a>
  );

  return (
    <section className="aa-bloque aa-fact">
      <div className="aa-bloque-cab">
        <span className="aa-burbuja aa-burbuja--coral" aria-hidden="true"><Wallet size={18} strokeWidth={2.2} /></span>
        <h2 className="aa-bloque-titulo">¿Cuánto facturé?</h2>
        {f.estado === "ok" && f.modo === "test" && <span className="aa-chip aa-chip--melo">Datos de prueba de Stripe</span>}
        {abrirStripe}
      </div>

      {f.estado !== "ok" ? (
        <div className="aa-sindatos">
          <span className="aa-burbuja aa-burbuja--lila" aria-hidden="true"><Wallet size={18} strokeWidth={2.2} /></span>
          <div>
            <p className="aa-sindatos-titulo">
              {f.estado === "sin_clave" ? "Stripe no está conectado acá" : "Ahora no pudimos leer Stripe"}
            </p>
            <p className="aa-txt">
              {f.estado === "sin_clave"
                ? "Falta la clave de Stripe en la configuración del servidor. Mientras tanto, las cifras están en el panel de Stripe."
                : "Puede ser un corte momentáneo. Probá recargar en unos minutos; mientras tanto, las cifras están en el panel de Stripe. El resto de esta página no depende de esto."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="aa-tarjetas">
            <Tarjeta
              color="coral"
              icono={<Wallet size={18} strokeWidth={2.2} />}
              valor={euros(f.esteMes.netoCentimos)}
              etiqueta="Facturado este mes"
              ayuda={`Cobraste ${euros(f.esteMes.brutoCentimos)}; se fueron ${euros(f.esteMes.comisionesCentimos)} en comisiones` +
                (f.esteMes.reembolsosCentimos > 0 ? ` y ${euros(f.esteMes.reembolsosCentimos)} en reembolsos.` : ".")}
              extra={f.variacionPct !== null && (
                <span className={"aa-var" + (f.variacionPct < 0 ? " es-baja" : "")}>
                  {f.variacionPct < 0
                    ? <ArrowDownRight size={13} strokeWidth={2.6} aria-hidden="true" />
                    : <ArrowUpRight size={13} strokeWidth={2.6} aria-hidden="true" />}
                  {f.variacionPct > 0 ? "+" : ""}{f.variacionPct}% vs. mes pasado
                </span>
              )}
            />
            <Tarjeta
              color="melo"
              icono={<CalendarDays size={18} strokeWidth={2.2} />}
              valor={euros(f.mesPasado.netoCentimos)}
              etiqueta="Facturado el mes pasado"
              ayuda="Neto, igual que el de este mes: lo que te queda después de comisiones y reembolsos."
            />
            <Tarjeta
              color="salvia"
              icono={<Repeat size={18} strokeWidth={2.2} />}
              valor={euros(f.mrrCentimos)}
              etiqueta="Ingreso mensual recurrente"
              ayuda={
                f.mrrDePruebaCentimos > 0
                  ? `Lo que suman tus suscripciones por mes (las anuales, divididas por 12). ${euros(f.mrrDePruebaCentimos)} son de alumnas en prueba que todavía no pagaron.`
                  : "Lo que suman tus suscripciones por mes. Las anuales cuentan divididas por 12."
              }
            />
            <Tarjeta
              color="lila"
              icono={<Receipt size={18} strokeWidth={2.2} />}
              valor={f.ticketPromedioCentimos !== null ? euros(f.ticketPromedioCentimos) : "—"}
              etiqueta="Pago promedio"
              ayuda={
                f.pagos12m > 0
                  ? `Sobre ${f.pagos12m} ${f.pagos12m === 1 ? "pago" : "pagos"} de los últimos 12 meses, antes de comisiones.`
                  : "Todavía no entró ningún pago en los últimos 12 meses."
              }
            />
          </div>

          <div className="aa-fact-cuerpo">
            <div className="aa-segmento aa-fact-graf">
              <p className="aa-segmento-titulo">Últimos 12 meses</p>
              <GraficoMeses meses={f.meses} />
            </div>

            <div className="aa-fact-lado">
              <div className="aa-segmento">
                <p className="aa-segmento-titulo">Suscripciones hoy</p>
                <div className="aa-filas">
                  {f.planes.map((p) => (
                    <div key={p.tier} className="aa-fila aa-fila--blanca">
                      <span className={"aa-plan aa-plan--" + p.tier}>{NOMBRE_PLAN[p.tier]}</span>
                      <span className="aa-fila-txt aa-fila-sub">
                        {p.enPrueba > 0 ? `${p.enPrueba} en prueba` : ""}
                      </span>
                      <span className="aa-fila-num">{p.activas}</span>
                    </div>
                  ))}
                </div>
                <p className="aa-txt aa-txt--chico">
                  <strong>{f.activasTotal}</strong> {f.activasTotal === 1 ? "activa" : "activas"}
                  {" · "}<strong>{f.enPruebaTotal}</strong> en prueba
                  {" · "}<strong>{f.canceladasEsteMes}</strong> {f.canceladasEsteMes === 1 ? "se dio" : "se dieron"} de baja este mes
                  {f.avisaronQueSeVan > 0 && <>{" · "}<strong>{f.avisaronQueSeVan}</strong> avisaron que no renuevan</>}
                </p>
              </div>

              <div className="aa-segmento">
                <p className="aa-segmento-titulo">De dónde viene, últimos 12 meses</p>
                <div className="aa-filas">
                  <div className="aa-fila aa-fila--blanca">
                    <span className="aa-fila-ini" aria-hidden="true"><Repeat size={16} strokeWidth={2.2} /></span>
                    <span className="aa-fila-txt aa-fila-titulo">Suscripciones</span>
                    <span className="aa-fila-num">{euros(f.suscripciones12m.netoCentimos)}</span>
                  </div>
                  <div className="aa-fila aa-fila--blanca">
                    <span className="aa-fila-ini aa-fila-ini--melo" aria-hidden="true"><Package size={16} strokeWidth={2.2} /></span>
                    <span className="aa-fila-txt">
                      <span className="aa-fila-titulo">Packs de clases</span>
                      <span className="aa-fila-sub aa-bloquecito">{f.packs12m.cantidad} {f.packs12m.cantidad === 1 ? "vendido" : "vendidos"}</span>
                    </span>
                    <span className="aa-fila-num">{euros(f.packs12m.netoCentimos)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="aa-txt aa-txt--sep aa-fact-nota">
            Todo sale de Stripe, que es donde se cobra: no hay un cálculo propio al
            lado que pueda dar otro número. Se actualiza cada pocos minutos.
            {f.otrasMonedas > 0 && ` Hay ${f.otrasMonedas} movimientos en otra moneda que no se sumaron.`}
          </p>
        </>
      )}
    </section>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default async function AnaliticasPage() {
  await requireAdmin();
  // En paralelo: Stripe no frena a la base ni al reves. getFacturacion nunca
  // tira: si Stripe falla devuelve un estado y el resto de la pagina sigue.
  const [a, facturacion] = await Promise.all([getAnalitica(), getFacturacion()]);

  return (
    <main className="aa">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Analíticas del estudio"
        titulo="Cómo va"
        lede="Quiénes entrenan, quiénes se están yendo y qué contenido no está usando nadie."
        acciones={
          <a href="/api/admin/export/alumnas" className="ad-btn ad-btn--lleno">
            <Download size={16} strokeWidth={2.4} aria-hidden="true" /> Descargar alumnas (CSV)
          </a>
        }
      />

      {/* La franja que evita que "todo en cero" parezca un sistema roto. */}
      {a.estudioVacio && (
        <div className="aa-arranca">
          <span className="aa-burbuja aa-burbuja--blanca" aria-hidden="true"><Sprout size={19} strokeWidth={2.2} /></span>
          <div>
            <p className="aa-arranca-titulo">
              El estudio recién arranca
            </p>
            <p className="aa-arranca-txt">
              Los números de abajo van a estar en cero hasta que haya clases
              publicadas y alumnas entrenando. No está roto: no hay nada que
              medir todavía. Cada bloque avisa cuánto hace falta para que su
              número signifique algo.
            </p>
          </div>
        </div>
      )}

      {/* ── Cuatro números ─────────────────────────────────────────────── */}
      <div className="aa-tarjetas">
        <Tarjeta
          color="coral"
          icono={<Users size={18} strokeWidth={2.2} />}
          valor={a.churn.activas}
          etiqueta="Alumnas con plan activo"
          ayuda="Incluye las que están en prueba y las que tienen un pago pendiente."
        />
        <Tarjeta
          color="melo"
          icono={<UserMinus size={18} strokeWidth={2.2} />}
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
          color="salvia"
          icono={<Sparkles size={18} strokeWidth={2.2} />}
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
          color="lila"
          icono={<Moon size={18} strokeWidth={2.2} />}
          valor={a.inactividad.alumnas.length}
          etiqueta={`Sin entrar hace más de ${a.inactividad.diasCorte} días`}
          ayuda="Sólo alumnas que están pagando. Son a las que conviene escribirles."
          tono={a.inactividad.alumnas.length > 0 ? "alerta" : "normal"}
        />
      </div>

      {/*
        ── Ingresos ──
        Los numeros salen de Stripe, la MISMA fuente donde se cobra, leidos en
        vivo (con unos minutos de cache). No hay una cuenta propia al lado: si
        la hubiera, tarde o temprano daria otro numero y no habria forma de
        saber cual mirar. Aca hay una sola verdad, la de Stripe, y el enlace
        para abrirla.
      */}
      <BloqueFacturacion f={facturacion} />

      <div className="aa-dos">
        {/* ── Inactividad ────────────────────────────────────────────────── */}
        <Bloque pregunta="¿Quiénes están dejando de entrenar?" icono={<Moon size={18} strokeWidth={2.2} />} color="lila">
          {!a.inactividad.umbral.suficiente ? (
            <SinDatos umbral={a.inactividad.umbral} />
          ) : a.inactividad.alumnas.length === 0 ? (
            <p className="aa-txt">
              Ninguna alumna con plan lleva más de {a.inactividad.diasCorte} días
              sin entrar. Es la mejor señal que puede dar este bloque.
            </p>
          ) : (
            <div className="aa-filas">
              {a.inactividad.alumnas.slice(0, 12).map((al) => (
                <Link key={al.id} href={`/admin/users/${al.id}` as never} className="aa-fila aa-fila--link">
                  <span className="aa-fila-ini" aria-hidden="true">{al.nombre[0]?.toUpperCase()}</span>
                  <div className="aa-fila-txt">
                    <p className="aa-fila-titulo">{al.nombre}</p>
                    <p className="aa-fila-sub">{al.plan}</p>
                  </div>
                  <span className="aa-chip aa-chip--coral">
                    {al.diasSinEntrar === null ? "Nunca entró" : `${al.diasSinEntrar} días`}
                  </span>
                </Link>
              ))}
              {a.inactividad.alumnas.length > 12 && (
                <p className="aa-txt">
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
          icono={<PlayCircle size={18} strokeWidth={2.2} />}
          color="melo"
        >
          {!a.sinUso.umbral.suficiente ? (
            <SinDatos
              umbral={a.sinUso.umbral}
              explica="Con pocas alumnas, que una clase no tenga uso no dice nada del contenido."
            />
          ) : a.sinUso.clases.length === 0 ? (
            <p className="aa-txt">
              Las {a.sinUso.totalPublicadas} clases publicadas tienen al menos una
              alumna que las empezó.
            </p>
          ) : (
            <>
              <p className="aa-txt aa-txt--intro">
                {a.sinUso.clases.length} de {a.sinUso.totalPublicadas} clases publicadas
                no las empezó ninguna alumna todavía.
              </p>
              <div className="aa-filas">
                {a.sinUso.clases.slice(0, 10).map((c) => (
                  <div key={c.id} className="aa-fila">
                    <span className="aa-fila-ini aa-fila-ini--melo" aria-hidden="true"><PlayCircle size={16} strokeWidth={2.2} /></span>
                    <p className="aa-fila-titulo aa-fila-txt">{c.titulo}</p>
                    <span className="aa-fila-sub aa-nowrap">
                      {c.publicadaHace !== null ? `publicada hace ${c.publicadaHace} días` : "sin fecha"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Bloque>
      </div>

      {/* ── Segmentacion ───────────────────────────────────────────────── */}
      <Bloque pregunta="¿Cómo se reparten tus alumnas?" icono={<PieChart size={18} strokeWidth={2.2} />} color="salvia">
        {!a.segmentacion.umbral.suficiente ? (
          <SinDatos umbral={a.segmentacion.umbral} />
        ) : (
          <div className="aa-segmentos">
            <div className="aa-segmento">
              <p className="aa-segmento-titulo">Por plan</p>
              <Barras filas={a.segmentacion.porPlan} />
            </div>
            <div className="aa-segmento">
              <p className="aa-segmento-titulo">Por nivel</p>
              <Barras filas={a.segmentacion.porNivel} />
            </div>
          </div>
        )}
      </Bloque>

      {/* ── Planes de trabajo ──────────────────────────────────────────── */}
        <Bloque
          pregunta="¿Terminan los planes de trabajo?"
          accion={{ href: "/admin/programs", texto: "Ir a planes de trabajo" }}
          icono={<ListChecks size={18} strokeWidth={2.2} />}
          color="coral"
        >
          {a.programas.length === 0 ? (
            <div className="aa-vacio">
              <span className="aa-burbuja aa-burbuja--coral" aria-hidden="true"><ListChecks size={17} strokeWidth={2.2} /></span>
              <p className="aa-txt">Todavía no hay planes de trabajo cargados.</p>
            </div>
          ) : (
            <div className="aa-filas">
              {a.programas.map((p) => (
                <div key={p.id} className="aa-programa">
                  <div className="aa-programa-cab">
                    <p className="aa-fila-titulo">{p.titulo}</p>
                    <span className="aa-chip aa-chip--melo">{p.dias} días</span>
                  </div>
                  {!p.umbral.suficiente ? (
                    <p className="aa-txt aa-txt--chico">
                      Lo empezaron {p.laEmpezaron}{" "}
                      {p.laEmpezaron === 1 ? "alumna" : "alumnas"}. Hacen falta{" "}
                      {p.umbral.minimo} para saber si el plan se termina o se abandona.
                    </p>
                  ) : (
                    <p className="aa-txt aa-txt--chico">
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

    </main>
  );
}

const CSS = `
.aa { display: flex; flex-direction: column; gap: 18px; padding-bottom: 60px; }
.aa .ad-mast { margin-bottom: 4px; }
.aa .ad-mast-acciones a { display: inline-flex; align-items: center; text-decoration: none; }

.aa-burbuja { width: 40px; height: 40px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; }
.aa-burbuja--coral { background: var(--rubor); color: var(--pink-deep); }
.aa-burbuja--melo { background: #FFEEDB; color: var(--melocoton-deep); }
.aa-burbuja--salvia { background: #FFF4E8; color: var(--melocoton-deep); }
.aa-burbuja--lila { background: #FFEDE6; color: #B4533A; }
.aa-burbuja--blanca { background: #fff; color: var(--melocoton-deep); box-shadow: var(--sombra); }

.aa-arranca { display: flex; align-items: flex-start; gap: 14px; padding: 18px 22px; border-radius: 24px; background: linear-gradient(120deg, #FFEEDB, #FFF7F0 70%); border: 1px solid #F6D9C6; }
.aa-arranca-titulo { font-size: 15px; font-weight: 900; color: var(--melocoton-deep); }
.aa-arranca-txt { margin-top: 4px; font-size: 14px; line-height: 1.65; color: #8A5A44; }

.aa-tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.aa-tarjeta { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 4px; padding: 20px 22px 22px; border-radius: var(--radio); border: 1px solid var(--linea); box-shadow: var(--sombra); transition: transform .35s var(--curva), box-shadow .35s var(--curva); }
.aa-tarjeta:hover { transform: translateY(-3px); box-shadow: var(--sombra-alta); }
.aa-tarjeta::after { content: ""; position: absolute; width: 140px; height: 140px; right: -50px; top: -60px; border-radius: 50%; opacity: .7; pointer-events: none; }
.aa-tarjeta--coral { background: linear-gradient(160deg, #FFE9E2, #FFF8F5 78%); }
.aa-tarjeta--coral::after { background: radial-gradient(circle, rgba(242,198,198,.8), transparent 70%); }
.aa-tarjeta--melo { background: linear-gradient(160deg, #FFEEDB, #FFFAF4 78%); }
.aa-tarjeta--melo::after { background: radial-gradient(circle, rgba(255,205,170,.75), transparent 70%); }
.aa-tarjeta--salvia { background: linear-gradient(160deg, #FFEFE3, #FFFAF6 78%); }
.aa-tarjeta--salvia::after { background: radial-gradient(circle, rgba(255,214,190,.75), transparent 70%); }
.aa-tarjeta--lila { background: linear-gradient(160deg, #FFEDE6, #FFFAF6 78%); }
.aa-tarjeta--lila::after { background: radial-gradient(circle, rgba(255,200,190,.7), transparent 70%); }
.aa-tarjeta-ico { position: relative; z-index: 1; width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: #fff; box-shadow: var(--sombra); margin-bottom: 10px; color: var(--pink-deep); }
.aa-tarjeta--melo .aa-tarjeta-ico { color: var(--melocoton-deep); }
.aa-tarjeta--salvia .aa-tarjeta-ico { color: var(--melocoton-deep); }
.aa-tarjeta--lila .aa-tarjeta-ico { color: #B4533A; }
.aa-tarjeta-num { position: relative; font-size: 40px; font-weight: 900; line-height: 1; letter-spacing: -0.03em; color: var(--ink); }
.aa-tarjeta.es-alerta .aa-tarjeta-num { color: var(--pink-deep); }
.aa-tarjeta-etq { margin-top: 6px; font-size: 14px; font-weight: 800; color: var(--ink); }
.aa-tarjeta-ayuda { font-size: 12.5px; line-height: 1.55; color: var(--muted); }

.aa-dos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; align-items: start; }
.aa-bloque { padding: clamp(20px, 2.6vw, 28px); border-radius: 28px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); min-width: 0; }
.aa-bloque-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
.aa-bloque-titulo { flex: 1 1 200px; font-size: 19px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.25; color: var(--ink); }
.aa-bloque-accion { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 13px; font-weight: 800; text-decoration: none; white-space: nowrap; transition: gap .25s var(--curva), background .2s; }
.aa-bloque-accion:hover { gap: 9px; background: var(--pink-soft); }

.aa-txt { font-size: 14px; line-height: 1.65; color: var(--muted); }
.aa-txt strong { color: var(--ink); }
.aa-txt--intro { margin-bottom: 14px; }
.aa-txt--chico { margin-top: 8px; font-size: 13px; }
.aa-txt--sep { margin-top: 10px; }
.aa-stripe { margin-top: 18px; display: inline-flex; align-items: center; text-decoration: none; }

.aa-sindatos { display: flex; align-items: flex-start; gap: 14px; padding: 18px; border-radius: 22px; background: #FFFAF6; border: 1.5px dashed #F3D9CF; }
.aa-sindatos-titulo { font-size: 14.5px; font-weight: 900; color: #B4533A; margin-bottom: 4px; }
.aa-vacio { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 20px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); }

.aa-filas { display: grid; gap: 8px; }
.aa-fila { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 18px; background: var(--crema); border: 1px solid var(--linea); text-decoration: none; transition: transform .3s var(--curva), border-color .2s, background .2s; }
.aa-fila--link:hover { transform: translateX(3px); border-color: var(--pink-line); background: var(--rubor); }
.aa-fila-ini { width: 36px; height: 36px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; background: #fff; color: var(--pink-deep); font-weight: 900; font-size: 14px; }
.aa-fila-ini--melo { color: var(--melocoton-deep); }
.aa-fila-txt { flex: 1; min-width: 0; }
.aa-fila-titulo { font-size: 14px; font-weight: 800; color: var(--ink); overflow-wrap: anywhere; }
.aa-fila-sub { margin-top: 1px; font-size: 12.5px; color: var(--muted); }
.aa-nowrap { white-space: nowrap; }
.aa-chip { padding: 4px 11px; border-radius: 99px; font-size: 12px; font-weight: 800; white-space: nowrap; }
.aa-chip--coral { background: #fff; color: var(--pink-deep); border: 1px solid var(--pink-line); }
.aa-chip--melo { background: #FFEEDB; color: var(--melocoton-deep); }
.aa-programa { padding: 14px 16px; border-radius: 18px; background: var(--crema); border: 1px solid var(--linea); }
.aa-programa-cab { display: flex; justify-content: space-between; align-items: center; gap: 12px; }

.aa-segmentos { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.aa-segmento { padding: 18px; border-radius: 22px; background: var(--crema); border: 1px solid var(--linea); }
.aa-segmento-titulo { margin-bottom: 14px; font-size: 13.5px; font-weight: 800; color: var(--muted); }
.aa-barras { display: grid; gap: 12px; }
.aa-barra { display: grid; grid-template-columns: 130px minmax(0, 1fr) 40px; align-items: center; gap: 12px; }
.aa-barra-etq { font-size: 13px; font-weight: 700; color: var(--ink); }
.aa-barra-pista { height: 14px; border-radius: 99px; background: #fff; border: 1px solid var(--linea); overflow: hidden; }
.aa-barra-relleno { height: 100%; border-radius: 99px; min-width: 4px; transform-origin: left; animation: aa-crece .9s var(--curva) both; }
.aa-barra--coral .aa-barra-relleno { background: linear-gradient(90deg, #F2A2A0, var(--pink)); }
.aa-barra--melo .aa-barra-relleno { background: linear-gradient(90deg, #FFCFAE, #F09A6C); }
.aa-barra--salvia .aa-barra-relleno { background: linear-gradient(90deg, #FFD3BD, #E89A72); }
.aa-barra--lila .aa-barra-relleno { background: linear-gradient(90deg, #FFD0C7, #E77A70); }
.aa-barra-num { font-size: 14px; font-weight: 900; color: var(--ink); text-align: right; }
@keyframes aa-crece { from { transform: scaleX(0); } to { transform: scaleX(1); } }

/* Facturacion */
.aa-fact .aa-tarjetas { margin-bottom: 16px; }
.aa-fact .aa-tarjeta-num { font-size: 34px; }
.aa-tarjeta-extra { position: absolute; z-index: 1; top: 22px; right: 18px; }
.aa-var { display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px 5px 8px; border-radius: 99px; font-size: 12px; font-weight: 800; background: #fff; color: var(--pink-deep); border: 1px solid var(--pink-line); white-space: nowrap; }
.aa-var.es-baja { color: var(--melocoton-deep); border-color: #F6D2BD; }
.aa-fact-cuerpo { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
.aa-fact-graf { display: flex; flex-direction: column; }
.aa-fact-graf .aa-graf { flex: 1; display: flex; flex-direction: column; }
.aa-fact-lado { display: grid; gap: 16px; }
.aa-fact-nota { margin-top: 16px; font-size: 13px; }
.aa-fila--blanca { background: #fff; padding: 10px 14px; }
.aa-fila-num { font-size: 15px; font-weight: 900; color: var(--ink); white-space: nowrap; }
.aa-bloquecito { display: block; }
.aa-plan { padding: 5px 12px; border-radius: 99px; font-size: 12.5px; font-weight: 800; white-space: nowrap; }
.aa-plan--principal { background: var(--pink); color: #fff; }
.aa-plan--solista { background: var(--rubor); color: var(--pink-deep); border: 1px solid var(--pink-line); }
.aa-plan--corps_de_ballet { background: #fff; color: var(--pink-deep); border: 1px solid var(--pink-line); }
.aa-plan--otro { background: #FFEEDB; color: var(--melocoton-deep); }

.aa-graf { margin: 0; }
.aa-graf-zona { flex: 1; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 8px; min-height: 230px; padding-top: 26px; }
.aa-graf-col { position: relative; display: flex; flex-direction: column; min-width: 0; outline: none; cursor: default; }
.aa-graf-pista { position: relative; flex: 1; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1.5px solid var(--linea-fuerte); }
.aa-graf-barra { width: min(100%, 34px); border-radius: 8px 8px 3px 3px; background: linear-gradient(180deg, #FFC9AE, #F7A88A); transform-origin: bottom; animation: aa-sube .9s var(--curva) both; transition: filter .2s; }
.aa-graf-col.es-actual .aa-graf-barra { background: linear-gradient(180deg, #F58A8E, var(--pink)); }
.aa-graf-col:hover .aa-graf-barra, .aa-graf-col:focus-visible .aa-graf-barra { filter: brightness(.94) saturate(1.1); }
.aa-graf-valor { position: absolute; left: 50%; transform: translateX(-50%); font-size: 11.5px; font-weight: 800; color: var(--ink); white-space: nowrap; }
.aa-graf-mes { margin-top: 8px; text-align: center; font-size: 12px; font-weight: 700; color: var(--muted); }
.aa-graf-col.es-actual .aa-graf-mes { color: var(--pink-deep); font-weight: 900; }
.aa-graf-tip { position: absolute; z-index: 3; bottom: calc(100% - 18px); left: 50%; transform: translate(-50%, 4px); padding: 7px 11px; border-radius: 12px; background: #fff; border: 1px solid var(--linea-fuerte); box-shadow: var(--sombra-alta); font-size: 12px; color: var(--muted); white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .2s, transform .25s var(--curva); }
.aa-graf-tip strong { color: var(--ink); font-weight: 900; }
.aa-graf-col:hover .aa-graf-tip, .aa-graf-col:focus-visible .aa-graf-tip { opacity: 1; transform: translate(-50%, 0); }
.aa-graf-col:first-child .aa-graf-tip { left: 0; transform: translate(0, 4px); }
.aa-graf-col:first-child:hover .aa-graf-tip, .aa-graf-col:first-child:focus-visible .aa-graf-tip { transform: none; }
.aa-graf-col:last-child .aa-graf-tip, .aa-graf-col:nth-last-child(2) .aa-graf-tip { left: auto; right: 0; transform: translate(0, 4px); }
.aa-graf-col:last-child:hover .aa-graf-tip, .aa-graf-col:last-child:focus-visible .aa-graf-tip,
.aa-graf-col:nth-last-child(2):hover .aa-graf-tip, .aa-graf-col:nth-last-child(2):focus-visible .aa-graf-tip { transform: none; }
.aa-graf-pie { margin-top: 12px; font-size: 12.5px; line-height: 1.5; color: var(--muted); }
@keyframes aa-sube { from { transform: scaleY(0); } to { transform: scaleY(1); } }

@media (max-width: 1100px) { .aa-dos, .aa-fact-cuerpo { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 560px) {
  .aa-graf-zona { gap: 4px; min-height: 190px; }
  .aa-graf-mes { font-size: 10.5px; }
  .aa-graf-valor { font-size: 10.5px; }
  .aa-fact .aa-tarjeta-num { font-size: 30px; }
}
@media (max-width: 560px) {
  .aa-barra { grid-template-columns: 96px minmax(0, 1fr) 32px; gap: 8px; }
  .aa-tarjeta-num { font-size: 34px; }
  .aa .ad-mast-acciones, .aa .ad-mast-acciones a { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .aa-barra-relleno, .aa-graf-barra { animation: none; } .aa-tarjeta { transition: none; } .aa-tarjeta:hover { transform: none; } }
`;
