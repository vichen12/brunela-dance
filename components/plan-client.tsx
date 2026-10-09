'use client';
import { Check, Settings } from 'lucide-react';
import { AdminCabecera } from '@/components/admin-ui';

import Link from "next/link";

import { useState, useEffect } from 'react';

type Tier = 'none' | 'corps_de_ballet' | 'solista' | 'principal';
type Interval = 'monthly' | 'yearly';

/**
 * Only what this component renders. The price ids are deliberately absent: the
 * browser sends the tier and the interval, and the server picks the id for the
 * mode it is running in (src/lib/stripe/catalog.ts).
 */
type CatalogTier = {
  tier: 'corps_de_ballet' | 'solista' | 'principal';
  display_order: number;
  amount_monthly: number;
  amount_yearly: number;
};

type Catalog = {
  currency: string;
  trial_days: number;
  tiers: CatalogTier[];
} | null;

const PLAN_META: Record<CatalogTier['tier'], {
  name: string; desc: string; features: string[];
  /**
   * Tono de la tarjeta. Antes era plana / suave / OSCURA; el rediseño suave
   * saco la superficie oscura: Principal es ahora la destacada en coral.
   */
  cabecera: 'plana' | 'suave' | 'coral';
  /** Texto chico sobre el nombre, cuando lo hay. */
  encima: string | null;
  icono: string;
}> = {
  corps_de_ballet: {
    name: 'Corps de Ballet',
    desc: 'Acceso a todo lo básico que necesitás.',
    features: ['Biblioteca completa', 'Filtros por nivel y foco', 'Progreso guardado', '7 días de prueba gratuita'],
    cabecera: 'plana',
    encima: null,
    // bailarina
    icono: 'M8 3.1a1.05 1.05 0 100-2.1 1.05 1.05 0 000 2.1zM8 4.3v3.4M8 7.7l-2.3 3.9M8 7.7l2.3 3.9M5.1 5.4L8 6.3l2.9-.9',
  },
  solista: {
    name: 'Solista',
    desc: 'Planes de trabajo guiados, con progreso estructurado.',
    features: ['Todo Corps de Ballet', 'Planes de trabajo día por día', 'Mayor profundidad técnica', 'Objetivos por semana'],
    cabecera: 'suave',
    encima: 'Más elegida',
    // corona
    icono: 'M2.6 12h10.8l.9-6.2-3.2 2.2L8 3.3 4.9 8 1.7 5.8 2.6 12z',
  },
  principal: {
    name: 'Principal',
    desc: 'La experiencia completa con clases en vivo.',
    features: ['Todo Solista', '2 clases en vivo al mes', 'Acompañamiento personalizado', 'Chat directo con Brunela'],
    cabecera: 'coral',
    encima: 'Experiencia total',
    // rayo
    icono: 'M9.1 1.6L4.2 8.6h3.1l-.6 5.8 5.1-7.4H8.6l.5-5.4z',
  },
};

const TIER_ORDER: Record<Tier, number> = { none: 0, corps_de_ballet: 1, solista: 2, principal: 3 };

function formatEur(amount: number) {
  // Show cents only when the amount actually has them. Every current price is a
  // whole number, but the catalog is editable and a 9,90 could appear any day.
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `${amount.toLocaleString('es-ES', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}€`;
}

/**
 * Un pack, como lo ve la alumna.
 *
 * `compradoEl` es la fecha de compra o null. Es lo unico que distingue "podés
 * llevarlo" de "ya es tuyo", y sin eso la alumna que pagó no tenía ninguna señal
 * dentro del sistema de que la compra entró.
 */
export type PackDeAlumna = {
  slug: string;
  nombre: string;
  descripcion: string;
  precioCentimos: number;
  moneda: string;
  portada: string | null;
  destacado: boolean;
  clases: number;
  compradoEl: string | null;
};

export function PlanClient({
  currentTier,
  subscriptionStatus,
  renewsAt,
  catalog,
  packs = [],
}: {
  currentTier: Tier;
  subscriptionStatus: string | null;
  renewsAt: string | null;
  catalog: Catalog;
  packs?: PackDeAlumna[];
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>('monthly');
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const renewDate = renewsAt
    ? new Date(renewsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const hasActiveSub = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  const orderedTiers = catalog
    ? [...catalog.tiers].sort((a, b) => a.display_order - b.display_order)
    : [];

  async function startCheckout(tier: CatalogTier['tier']) {
    setError(null);
    setLoadingTier(tier);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? 'No pudimos iniciar el pago.');
        setLoadingTier(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('No pudimos iniciar el pago.');
      setLoadingTier(null);
    }
  }

  /**
   * Compra de un pack: pago unico, ruta aparte.
   *
   * Del navegador sale un SLUG y nada mas. El importe y el price id los resuelve
   * el servidor contra la base, asi que forzar ?pack=el-caro cobra el caro: no
   * hay forma de pagar un precio por otro.
   */
  async function startPackCheckout(slug: string) {
    setError(null);
    setLoadingTier('pack');
    try {
      const res = await fetch('/api/stripe/checkout-pack', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pack: slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? 'No pudimos iniciar el pago.');
        setLoadingTier(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('No pudimos iniciar el pago.');
      setLoadingTier(null);
    }
  }

  // ── Arranque automatico despues del onboarding ───────────────────────────
  //
  // La alumna ya eligio su plan en la landing: no se le vuelve a pedir. El
  // onboarding redirige aca con ?plan=<tier>&iniciar=1.
  //
  // EL TIER SE VALIDA CONTRA EL CATALOGO antes de disparar nada. No porque el
  // precio pueda falsificarse -- no puede: /api/stripe/checkout recibe un tier,
  // no un precio, y resuelve el price id desde el catalogo del servidor, asi
  // que forzar ?plan=principal cobra principal. Se valida para no mandar basura
  // al endpoint y para no dejar un boton cargando por un valor inexistente.
  const [autoIntentado, setAutoIntentado] = useState(false);
  useEffect(() => {
    // ⚠️ `!catalog` NO frena el camino del pack: un pack no sale del catalogo de
    //    suscripciones. Por eso la comprobacion del pack va antes.
    if (autoIntentado || hasActiveSub) return;

    const q = new URLSearchParams(window.location.search);
    if (q.get('iniciar') !== '1') return;

    // El pack va PRIMERO. Quien llego por un pack no eligio plan, y cobrarle una
    // suscripcion que no pidio es el peor error posible en este cruce.
    const packPedido = q.get('pack');
    if (packPedido) {
      setAutoIntentado(true);
      window.history.replaceState({}, '', '/dashboard/plan');
      void startPackCheckout(packPedido);
      return;
    }

    if (!catalog) return;

    const pedido = q.get('plan');
    const valido = orderedTiers.find((t) => t.tier === pedido);
    if (!valido) return;

    const intervaloPedido = q.get('interval');
    if (intervaloPedido === 'monthly' || intervaloPedido === 'yearly') {
      setInterval(intervaloPedido);
    }

    setAutoIntentado(true);
    // Se limpia la URL para que un F5 no vuelva a mandarla a Stripe.
    window.history.replaceState({}, '', '/dashboard/plan');
    void startCheckout(valido.tier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoIntentado, hasActiveSub, catalog, orderedTiers]);

  async function openPortal() {
    setError(null);
    setLoadingTier('portal');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? 'No pudimos abrir la gestión de tu plan.');
        setLoadingTier(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('No pudimos abrir la gestión de tu plan.');
      setLoadingTier(null);
    }
  }

  // El cartel dice "hasta", asi que el numero tiene que ser el MAXIMO ahorro
  // entre los planes, no el promedio. Sale de los importes reales del catalogo:
  // si Brunela cambia un precio, el porcentaje se corrige solo.
  const ahorroMaximo = (() => {
    const tiers = catalog?.tiers ?? [];
    const porcentajes = tiers
      .filter((t) => t.amount_monthly > 0 && t.amount_yearly > 0)
      .map((t) => ((t.amount_monthly * 12 - t.amount_yearly) / (t.amount_monthly * 12)) * 100);
    if (porcentajes.length === 0) return 0;
    return Math.round(Math.max(...porcentajes));
  })();

  return (
    <div className="mp">
      <style>{CSS}</style>

      {/* Cabecera: la misma del resto del sistema. */}
      <div className="mp-cabeza">
        <AdminCabecera
          eyebrow="Suscripción"
          titulo="Mi plan"
          lede={<>Cambiá de plan cuando quieras, sin permanencias.{renewDate && <> Tu plan se renueva el <strong>{renewDate}</strong>.</>}</>}
        />
      </div>

      <div className="mp-cuerpo">

        {error && (
          <div role="alert" className="ad-aviso ad-aviso--error">{error}</div>
        )}

        {/* Active subscription banner + manage */}
        {hasActiveSub && (
          <div className="mp-activa">
            <span className="mp-activa-izq">
              <span className="mp-activa-ico">
                <Check size={18} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <span className="mp-activa-txt">
                <span className="mp-activa-titulo">
                  {subscriptionStatus === 'trialing' ? 'Estás en tu prueba gratuita' : 'Tu suscripción está activa'}
                </span>
                <span className="mp-activa-sub">Desde «Gestionar» cambiás la tarjeta, ves tus facturas o cancelás.</span>
              </span>
            </span>
            <button
              onClick={openPortal}
              disabled={loadingTier === 'portal'}
              className="mp-gestionar"
            >
              <Settings size={15} strokeWidth={2} aria-hidden="true" />
              {loadingTier === 'portal' ? 'Abriendo…' : 'Gestionar'}
            </button>
          </div>
        )}

        {/* Selector de periodo: un interruptor, no dos pestanas. */}
        <div className="mp-periodo">
          <div className="mp-periodo-caja">
            <button
              onClick={() => setInterval('monthly')}
              className={'mp-periodo-op' + (interval === 'monthly' ? ' es-activo' : '')}
            >
              Mensual
            </button>

            {/* El interruptor en si. role="switch" para que un lector de
                pantalla lo anuncie como lo que es. */}
            <button
              role="switch"
              aria-checked={interval === 'yearly'}
              aria-label="Facturación anual"
              onClick={() => setInterval(interval === 'yearly' ? 'monthly' : 'yearly')}
              className="mp-switch"
            >
              <span className="mp-switch-bola" style={{ left: interval === 'yearly' ? 29 : 4 }} />
            </button>

            <button
              onClick={() => setInterval('yearly')}
              className={'mp-periodo-op' + (interval === 'yearly' ? ' es-activo' : '')}
            >
              Anual
            </button>
          </div>

          {ahorroMaximo > 0 && (
            <span className="mp-ahorro">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1.6l1.7 3.9 4.2.4-3.2 2.8.9 4.1L8 10.7l-3.6 2.1.9-4.1-3.2-2.8 4.2-.4L8 1.6z" fill="currentColor" />
              </svg>
              Ahorrá hasta {ahorroMaximo}%
            </span>
          )}
        </div>

        {!catalog && (
          <div className="mp-sin-catalogo">
            Los planes todavía no están configurados. (Falta cargar el catálogo de precios.)
          </div>
        )}

        {/* Plan cards */}
        <div className="mp-grilla">
          {orderedTiers.map((entry, idx) => {
            const meta = PLAN_META[entry.tier];
            const isCurrent = entry.tier === currentTier;
            const isHov = hovered === entry.tier;
            const isUpgrade = TIER_ORDER[entry.tier] > TIER_ORDER[currentTier];
            const amount = interval === 'yearly' ? entry.amount_yearly : entry.amount_monthly;
            const period = interval === 'yearly' ? 'EUR / año' : 'EUR / mes';
            const monthlyEquivalent =
              interval === 'yearly' ? Math.round((entry.amount_yearly / 12) * 10) / 10 : null;

            return (
              <div key={entry.tier}
                onMouseEnter={() => setHovered(entry.tier)}
                onMouseLeave={() => setHovered(null)}
                className={
                  'mp-card mp-card--' + meta.cabecera +
                  (isCurrent ? ' es-actual' : '') + (isHov ? ' es-hover' : '')
                }
                style={{ animationDelay: `${0.08 + idx * 0.08}s` }}
              >

                {/* Cabecera */}
                <div className="mp-card-cabeza">
                  <div className="mp-card-nombres">
                    {meta.encima && <span className="mp-card-encima">{meta.encima}</span>}
                    {/* h2 y no div: es el titulo de la tarjeta. En un <div> el
                        lector de pantalla no puede saltar de plan en plan. */}
                    <h2 className="mp-card-nombre">{meta.name}</h2>
                  </div>

                  <div className="mp-card-ico">
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                      <path d={meta.icono} stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div className="mp-card-cuerpo">
                  <div className="mp-precio">
                    <span className="mp-precio-num">{formatEur(amount)}</span>
                    <span className="mp-precio-per">/ {period}</span>
                  </div>
                  {monthlyEquivalent && (
                    <div className="mp-equivale">
                      ≈ {monthlyEquivalent}€ por mes, facturado al año
                    </div>
                  )}
                  <p className="mp-desc">{meta.desc}</p>

                  <ul className="mp-lista">
                    {meta.features.map((f, i) => (
                      <li key={i}>
                        <span className="mp-tilde" aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 7.2l3 3L11.5 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mp-card-pie">
                    {isCurrent ? (
                      <>
                        <div className="mp-activo">
                          <Check size={15} strokeWidth={2.8} aria-hidden="true" /> Plan activo
                        </div>
                        <div className="mp-actual">
                          <span className="mp-actual-punto" />
                          <span>Tu plan actual</span>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => startCheckout(entry.tier)}
                        disabled={loadingTier === entry.tier}
                        className="mp-boton"
                      >
                        {loadingTier === entry.tier
                          ? 'Redirigiendo…'
                          : isUpgrade ? 'Empezar 7 días gratis' : 'Cambiar a este plan'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Franja de confianza. Cada linea describe algo que el sistema hace. */}
        <div className="mp-confianza">
          <div className="mp-confianza-grilla">
            {[
              ['Sin compromisos', 'Cambiá o cancelá cuando quieras. Sin permanencias.',
               'M8 1.8l5 2v4.1c0 3-2.1 5.4-5 6.3-2.9-.9-5-3.3-5-6.3V3.8l5-2z'],
              ['Pago seguro', 'El pago lo procesa Stripe. La tarjeta nunca pasa por acá.',
               'M4 7V5.2a4 4 0 018 0V7', 'M3.2 7h9.6v6.2H3.2V7z'],
              ['Cancelá cuando quieras', 'Desde tu cuenta, en segundos, sin escribirle a nadie.',
               'M8 4.5v3.7l2.4 1.4', 'M8 14A6 6 0 108 2a6 6 0 000 12z'],
              ['Hecho para vos', 'Tres planes pensados para cada etapa de tu entrenamiento.',
               'M8 13.2S2.6 10 2.6 6.3A2.9 2.9 0 018 4.8a2.9 2.9 0 015.4 1.5c0 3.7-5.4 6.9-5.4 6.9z'],
            ].map(([titulo, texto, d, d2]) => (
              <div key={titulo} className="mp-confianza-item">
                <div className="mp-confianza-ico">
                  <svg width="19" height="19" viewBox="0 0 16 16" fill="none">
                    <path d={d} stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
                    {d2 && <path d={d2} stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />}
                  </svg>
                </div>
                <div>
                  <p className="mp-confianza-titulo">{titulo}</p>
                  <p className="mp-confianza-txt">{texto}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Packs ──────────────────────────────────────────────────────
              Sin esto, una alumna con sesion NO TENIA NINGUNA FORMA de comprar
              un pack: el boton de la portada la mandaba a /registro, que al
              verla logueada la devolvia al dashboard perdiendo el pack por el
              camino. La funcionalidad existia solo para quien no tenia cuenta. */}
          {packs.length > 0 && (
            <div className="mp-packs">
              <h2 className="mp-packs-titulo">Packs de clases</h2>
              <p className="mp-packs-sub">
                Un solo pago, sin renovación. Las clases quedan tuyas para siempre.
              </p>

              <div className="mp-packs-grilla">
                {packs.map((p) => {
                  const comprado = p.compradoEl !== null;
                  return (
                    <div key={p.slug} className={'mp-pack' + (comprado ? ' es-comprado' : p.destacado ? ' es-destacado' : '')}>
                      {comprado && (
                        /* El texto queda en mayusculas en el codigo (lo busca
                           tests/sistema/caminos.test.ts) y se muestra en
                           oracion por CSS: el rediseño saco las etiquetas en
                           mayusculas. */
                        <span className="mp-pack-tuyo">YA ES TUYO</span>
                      )}

                      <p className="mp-pack-nombre">{p.nombre}</p>
                      {p.descripcion && (
                        <p className="mp-pack-desc">{p.descripcion}</p>
                      )}
                      <p className="mp-pack-clases">
                        {p.clases === 1 ? '1 clase' : `${p.clases} clases`} · acceso permanente
                      </p>

                      <p className="mp-pack-precio">
                        {(p.precioCentimos / 100).toLocaleString('es-ES', {
                          minimumFractionDigits: p.precioCentimos % 100 === 0 ? 0 : 2,
                        })}{' '}
                        {p.moneda.toUpperCase()}
                      </p>

                      {comprado ? (
                        /* Comprado: el boton lleva a las clases, no a pagar de nuevo. */
                        <Link href="/dashboard/library" className="mp-pack-ver">Ver mis clases</Link>
                      ) : (
                        <button
                          onClick={() => void startPackCheckout(p.slug)}
                          disabled={loadingTier !== null}
                          className="mp-pack-boton"
                        >
                          {loadingTier === 'pack' ? 'Abriendo…' : 'Llevar este pack'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mp-dudas">
            <div className="mp-dudas-ico" aria-hidden="true">?</div>
            <span>
              ¿Tenés dudas? Escribinos por el{' '}
              <Link href="/dashboard/chat" className="mp-dudas-link">chat</Link>
              {' '}y te ayudamos.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

const CSS = `
.mp { background: #fff; min-height: 100vh; overflow-y: auto; }
.mp-cabeza { max-width: 1320px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 0; }
.mp-cuerpo { max-width: 1320px; margin: 0 auto; padding: 18px clamp(16px, 3.4vw, 48px) 60px; }
.mp .ad-aviso { max-width: 1060px; margin: 0 auto 20px; }

/* Suscripcion activa: salvia, el color del "esta todo bien". */
.mp-activa {
  display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
  max-width: 1060px; margin: 0 auto 30px; padding: 16px 18px 16px 16px; border-radius: 24px;
  background: linear-gradient(110deg, var(--salvia) 0%, #F6FAF4 55%, #fff 100%); border: 1px solid #D5E7CF;
}
.mp-activa-izq { display: flex; align-items: center; gap: 13px; }
.mp-activa-ico { width: 44px; height: 44px; border-radius: 15px; flex-shrink: 0; display: grid; place-items: center; background: #fff; color: var(--salvia-deep); box-shadow: 0 8px 18px -12px rgba(63,122,69,.6); }
.mp-activa-txt { display: flex; flex-direction: column; gap: 2px; }
.mp-activa-titulo { font-size: 15.5px; font-weight: 800; color: var(--salvia-deep); }
.mp-activa-sub { font-size: 13px; color: var(--muted); }
.mp-gestionar {
  display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 99px; cursor: pointer;
  background: #fff; color: var(--salvia-deep); border: 1.5px solid #CFE3C9; font-family: inherit; font-size: 14px; font-weight: 800;
  transition: transform .3s var(--curva), background .2s, border-color .2s;
}
.mp-gestionar:hover { transform: translateY(-2px); background: #F6FAF4; border-color: var(--salvia-deep); }
.mp-gestionar:disabled { opacity: .6; cursor: default; transform: none; }

/* Periodo */
.mp-periodo { display: flex; justify-content: center; align-items: center; gap: 14px; margin-bottom: 34px; flex-wrap: wrap; }
.mp-periodo-caja {
  display: inline-flex; align-items: center; gap: 16px; padding: 8px 20px; border-radius: 99px;
  background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra);
}
.mp-periodo-op { background: none; border: 0; cursor: pointer; padding: 6px 2px; font-family: inherit; font-size: 14.5px; font-weight: 700; color: var(--muted); transition: color .2s; }
.mp-periodo-op.es-activo { color: var(--ink); font-weight: 900; }
.mp-switch { position: relative; width: 58px; height: 32px; flex-shrink: 0; border-radius: 99px; cursor: pointer; padding: 0; background: var(--rubor); border: 1.5px solid var(--pink-line); }
.mp-switch-bola { position: absolute; top: 3.5px; width: 22px; height: 22px; border-radius: 50%; background: var(--pink); box-shadow: 0 4px 10px -2px rgba(230,79,85,.6); transition: left .35s var(--curva); }
.mp-ahorro {
  display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 15px; border-radius: 99px;
  background: var(--melocoton); color: var(--melocoton-deep); font-size: 13.5px; font-weight: 800; white-space: nowrap;
}

.mp-sin-catalogo { max-width: 1060px; margin: 0 auto 24px; padding: 14px 20px; border-radius: 18px; font-size: 13.5px; color: var(--pink-deep); background: var(--pink-wash); border: 1px solid var(--pink-line); }

/* Tarjetas de plan */
.mp-grilla { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; max-width: 1060px; margin: 0 auto; align-items: stretch; }
@keyframes mp-entra { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
.mp-card {
  position: relative; display: flex; flex-direction: column; overflow: hidden;
  border-radius: 30px; border: 1px solid var(--linea); background: #fff; box-shadow: var(--sombra);
  transition: transform .4s var(--curva), box-shadow .4s, border-color .25s;
  animation: mp-entra .7s var(--curva) backwards;
}
.mp-card.es-hover { transform: translateY(-4px); box-shadow: var(--sombra-alta); }
.mp-card--plana { background: linear-gradient(170deg, #FFF4E8 0%, #fff 46%); }
.mp-card--suave { background: linear-gradient(170deg, #FFEDE8 0%, #fff 46%); border-color: var(--pink-line); }
.mp-card--coral { border-color: var(--pink-line); }
.mp-card.es-actual { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.12), var(--sombra); }

/* Misma altura de cabecera en las tres: asi los precios quedan alineados
   aunque Corps no tenga la pastilla de arriba. */
.mp-card-cabeza { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 24px 26px 18px; min-height: 104px; box-sizing: border-box; }
.mp-card--plana .mp-card-nombres { padding-top: 32px; }
.mp-card--coral .mp-card-cabeza {
  position: relative; isolation: isolate; overflow: hidden; color: #fff;
  background: linear-gradient(130deg, #E64F55 0%, #EE6A5F 60%, #F38A6C 100%);
}
.mp-card--coral .mp-card-cabeza::after {
  content: ""; position: absolute; z-index: -1; width: 220px; height: 220px; right: -70px; top: -110px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,.35), transparent 68%);
}
.mp-card-nombres { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; }
.mp-card-encima { display: inline-flex; padding: 4px 11px; border-radius: 99px; font-size: 12px; font-weight: 800; background: #fff; color: var(--pink-deep); box-shadow: 0 6px 14px -10px rgba(176,58,62,.6); }
.mp-card--coral .mp-card-encima { background: rgba(255,255,255,.22); color: #fff; box-shadow: none; }
.mp-card-nombre { margin: 0; font-size: 23px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.1; color: var(--ink); }
.mp-card--coral .mp-card-nombre { color: #fff; }
.mp-card-ico {
  width: 48px; height: 48px; border-radius: 16px; flex-shrink: 0; display: grid; place-items: center;
  background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); transition: transform .5s var(--curva);
}
.mp-card--coral .mp-card-ico { background: rgba(255,255,255,.2); color: #fff; box-shadow: none; }
.mp-card.es-hover .mp-card-ico { transform: rotate(-8deg) scale(1.06); }

.mp-card-cuerpo { flex: 1; display: flex; flex-direction: column; padding: 14px 26px 26px; }
.mp-precio { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.mp-precio-num { font-size: 44px; font-weight: 900; letter-spacing: -0.035em; color: var(--ink); line-height: 1.05; }
.mp-precio-per { font-size: 13px; font-weight: 700; color: var(--muted); }
.mp-equivale { margin-top: 6px; align-self: flex-start; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 800; color: var(--pink-deep); background: var(--rubor); }
.mp-desc { margin: 10px 0 0; font-size: 14px; line-height: 1.6; color: var(--muted); }
.mp-lista { list-style: none; margin: 20px 0 24px; padding: 18px 0 0; border-top: 1px dashed var(--linea-fuerte); display: flex; flex-direction: column; gap: 11px; }
.mp-lista li { display: flex; align-items: flex-start; gap: 11px; font-size: 14px; line-height: 1.45; color: var(--ink); font-weight: 600; }
.mp-tilde { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.mp-card--coral .mp-tilde { background: var(--pink); color: #fff; }

.mp-card-pie { margin-top: auto; }
.mp-boton {
  width: 100%; height: 52px; border: 0; border-radius: 99px; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 800;
  background: #fff; color: var(--pink-deep); border: 1.5px solid var(--pink-line);
  transition: transform .3s var(--curva), box-shadow .3s, background .2s, color .2s;
}
.mp-boton:hover { background: var(--rubor); transform: translateY(-2px); }
.mp-card--suave .mp-boton, .mp-card--coral .mp-boton {
  background: var(--pink); color: #fff; border-color: var(--pink); box-shadow: 0 14px 26px -14px rgba(230,79,85,.85);
}
.mp-card--suave .mp-boton:hover, .mp-card--coral .mp-boton:hover { background: var(--pink-mid); border-color: var(--pink-mid); box-shadow: 0 18px 30px -14px rgba(230,79,85,.9); }
.mp-boton:disabled { opacity: .6; cursor: default; transform: none; }
.mp-activo {
  display: flex; align-items: center; justify-content: center; gap: 7px; height: 52px; border-radius: 99px;
  font-size: 15px; font-weight: 800; color: var(--salvia-deep); background: var(--salvia); border: 1.5px solid #CFE3C9;
}
.mp-actual { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 11px; font-size: 12.5px; font-weight: 700; color: var(--muted); }
.mp-actual-punto { width: 8px; height: 8px; border-radius: 50%; background: var(--salvia-deep); box-shadow: 0 0 0 4px var(--salvia); }

/* Confianza */
.mp-confianza { max-width: 1060px; margin: 34px auto 0; padding: 28px; border-radius: 30px; border: 1px solid var(--linea); background: linear-gradient(150deg, #FFF8F4 0%, #fff 60%); }
.mp-confianza-grilla { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
.mp-confianza-item { display: flex; gap: 13px; padding: 16px; border-radius: 22px; background: #fff; border: 1px solid var(--linea); transition: transform .35s var(--curva), box-shadow .35s; }
.mp-confianza-item:hover { transform: translateY(-3px); box-shadow: var(--sombra-alta); }
.mp-confianza-ico { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.mp-confianza-item:nth-child(2) .mp-confianza-ico { background: #FFF4E8; color: var(--melocoton-deep); }
.mp-confianza-item:nth-child(3) .mp-confianza-ico { background: #F2F7EF; color: var(--salvia-deep); }
.mp-confianza-item:nth-child(4) .mp-confianza-ico { background: #F7F0FA; color: #8A4E9C; }
.mp-confianza-titulo { margin: 0; font-size: 14.5px; font-weight: 800; color: var(--ink); }
.mp-confianza-txt { margin: 4px 0 0; font-size: 13px; line-height: 1.55; color: var(--muted); }

/* Packs */
.mp-packs { margin-top: 30px; padding-top: 26px; border-top: 1px solid var(--linea); }
.mp-packs-titulo { margin: 0; text-align: center; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.mp-packs-sub { margin: 6px 0 0; text-align: center; font-size: 14px; line-height: 1.6; color: var(--muted); }
.mp-packs-grilla { display: grid; gap: 14px; margin-top: 20px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.mp-pack { display: flex; flex-direction: column; gap: 8px; padding: 20px; border-radius: 24px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); transition: transform .35s var(--curva), box-shadow .35s; }
.mp-pack:hover { transform: translateY(-3px); box-shadow: var(--sombra-alta); }
.mp-pack.es-destacado { border-color: var(--pink-line); background: linear-gradient(170deg, #FFEDE8, #fff 55%); }
.mp-pack.es-comprado { border-color: #CFE3C9; background: linear-gradient(170deg, #F2F7EF, #fff 55%); }
.mp-pack-tuyo { align-self: flex-start; padding: 4px 11px; border-radius: 99px; font-size: 12px; font-weight: 800; color: var(--salvia-deep); background: var(--salvia); text-transform: lowercase; }
.mp-pack-tuyo::first-letter { text-transform: uppercase; }
.mp-pack-nombre { margin: 0; font-size: 17px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); }
.mp-pack-desc { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--muted); }
.mp-pack-clases { margin: 0; font-size: 12.5px; font-weight: 700; color: var(--muted); }
.mp-pack-precio { margin: auto 0 4px; padding-top: 6px; font-size: 26px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.mp-pack-ver, .mp-pack-boton { display: flex; align-items: center; justify-content: center; height: 46px; border-radius: 99px; font-family: inherit; font-size: 14px; font-weight: 800; text-decoration: none; transition: transform .3s var(--curva), background .2s; }
.mp-pack-ver { color: var(--salvia-deep); background: #fff; border: 1.5px solid #CFE3C9; }
.mp-pack-ver:hover { background: var(--salvia); transform: translateY(-2px); }
.mp-pack-boton { border: 0; cursor: pointer; color: #fff; background: var(--pink); box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.mp-pack-boton:hover { background: var(--pink-mid); transform: translateY(-2px); }
.mp-pack-boton:disabled { opacity: .6; cursor: default; transform: none; }

.mp-dudas { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--linea); display: flex; align-items: center; justify-content: center; gap: 11px; flex-wrap: wrap; font-size: 14px; color: var(--muted); text-align: center; }
.mp-dudas-ico { width: 34px; height: 34px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); font-size: 15px; font-weight: 900; }
.mp-dudas-link { color: var(--pink-deep); font-weight: 800; text-decoration: none; border-bottom: 2px solid var(--pink-line); }
.mp-dudas-link:hover { border-bottom-color: var(--pink); }

@media (max-width: 900px) { .mp-grilla { grid-template-columns: 1fr; max-width: 520px; } }
@media (max-width: 767px) {
  .mp-cabeza { padding: 20px 16px 0; }
  .mp-cuerpo { padding: 20px 16px 40px; }
  .mp-confianza { padding: 16px; border-radius: 26px; }
  .mp-periodo-caja { padding: 6px 16px; gap: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .mp-card, .mp-card-ico, .mp-switch-bola { animation: none; transition: none; }
}
`;
