'use client';

import { useState } from 'react';

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
  /** Franja superior: plana (sin banda), suave (rosa) u oscura. */
  cabecera: 'plana' | 'suave' | 'oscura';
  /** Texto chico sobre el nombre, cuando lo hay. */
  encima: string | null;
  icono: string;
}> = {
  corps_de_ballet: {
    name: 'CORPS DE BALLET',
    desc: 'Acceso a todo lo básico que necesitás.',
    features: ['Biblioteca completa', 'Filtros por nivel y foco', 'Progreso guardado', '7 días de prueba gratuita'],
    cabecera: 'plana',
    encima: null,
    // bailarina
    icono: 'M8 3.1a1.05 1.05 0 100-2.1 1.05 1.05 0 000 2.1zM8 4.3v3.4M8 7.7l-2.3 3.9M8 7.7l2.3 3.9M5.1 5.4L8 6.3l2.9-.9',
  },
  solista: {
    name: 'SOLISTA',
    desc: 'Programa guiado con progresos estructurados.',
    features: ['Todo Corps de Ballet', 'Programas estructurados', 'Mayor profundidad técnica', 'Objetivos por semana'],
    cabecera: 'suave',
    encima: '★ MÁS ELEGIDA',
    // corona
    icono: 'M2.6 12h10.8l.9-6.2-3.2 2.2L8 3.3 4.9 8 1.7 5.8 2.6 12z',
  },
  principal: {
    name: 'PRINCIPAL',
    desc: 'La experiencia completa con clases en vivo.',
    features: ['Todo Solista', '2 clases en vivo al mes', 'Acompañamiento personalizado', 'Chat directo con Brunela'],
    cabecera: 'oscura',
    encima: 'EXPERIENCIA TOTAL',
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

export function PlanClient({
  currentTier,
  subscriptionStatus,
  renewsAt,
  catalog,
}: {
  currentTier: Tier;
  subscriptionStatus: string | null;
  renewsAt: string | null;
  catalog: Catalog;
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
    <div style={{
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      background: 'linear-gradient(160deg, #FDF8F6 0%, #FAF3F0 60%, #FDF6F4 100%)',
      minHeight: '100vh', overflowY: 'auto',
    }}>
      <style>{`@media(max-width:767px){.plan-header{padding:24px 20px 20px!important}.plan-body{padding:24px 20px!important}}`}</style>

      {/* Header */}
      <div className="plan-header" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE0DB', padding: '36px 48px 32px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--pink)', marginBottom: 14 }}>SUSCRIPCIÓN</div>
        <h1 style={{
          fontFamily: 'var(--font-display), sans-serif',
          fontSize: 44, fontWeight: 800, color: 'var(--ink)', lineHeight: 1, marginBottom: 12,
        }}>
          Mi <span style={{ color: 'var(--pink)', fontStyle: 'italic' }}>plan.</span>
        </h1>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Cambiá tu plan en cualquier momento. Sin compromisos.
          {renewDate && <span style={{ color: 'var(--pink)' }}> · Renueva el {renewDate}</span>}
        </div>
      </div>

      <div className="plan-body" style={{ padding: '40px 48px' }}>

        {error && (
          <div style={{ background: '#FFF0F0', border: '1px solid #F0A0A0', borderRadius: 10, padding: '12px 20px', marginBottom: 24, fontSize: 11, color: '#8C3A3A' }}>
            {error}
          </div>
        )}

        {/* Active subscription banner + manage */}
        {hasActiveSub && (
          <div style={{
            background: '#DFF0E8', border: '1px solid rgba(76,175,130,0.4)',
            borderRadius: 10, padding: '14px 20px', marginBottom: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 11, color: '#2E7D5E', fontWeight: 600 }}>
              {subscriptionStatus === 'trialing' ? 'Prueba gratuita activa' : 'Suscripción activa'}
            </span>
            <button
              onClick={openPortal}
              disabled={loadingTier === 'portal'}
              style={{
                fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, padding: '8px 16px',
                background: '#2E7D5E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
                opacity: loadingTier === 'portal' ? 0.6 : 1,
              }}
            >
              {loadingTier === 'portal' ? 'ABRIENDO…' : 'GESTIONAR PLAN'}
            </button>
          </div>
        )}

        {/* Selector de periodo: un interruptor, no dos pestanas. */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 18, marginBottom: 38, flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 20,
            background: 'linear-gradient(120deg, #fff, var(--pink-wash))',
            border: '1px solid var(--pink-wash)',
            borderRadius: 999, padding: '12px 26px',
          }}>
            <button
              onClick={() => setInterval('monthly')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, padding: 0,
                fontWeight: interval === 'monthly' ? 700 : 500,
                color: interval === 'monthly' ? 'var(--ink)' : 'var(--muted)',
                transition: 'color 0.15s',
              }}
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
              style={{
                position: 'relative', width: 56, height: 30, flexShrink: 0,
                borderRadius: 999, cursor: 'pointer', padding: 0,
                background: 'var(--pink-wash)',
                border: '1px solid rgba(230,79,85,0.18)',
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: interval === 'yearly' ? 27 : 3,
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--pink)',
                boxShadow: '0 2px 6px rgba(230,79,85,0.4)',
                transition: 'left 0.2s ease',
              }} />
            </button>

            <button
              onClick={() => setInterval('yearly')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, padding: 0,
                fontWeight: interval === 'yearly' ? 700 : 500,
                color: interval === 'yearly' ? 'var(--ink)' : 'var(--muted)',
                transition: 'color 0.15s',
              }}
            >
              Anual
            </button>
          </div>

          {ahorroMaximo > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="84" height="30" viewBox="0 0 84 30" fill="none" aria-hidden="true">
                <path
                  d="M79 21C70 22 62 20 57 15C53.6 11.6 55.4 7 59.6 7.8C63.4 8.5 63 13.8 58.6 16.2C53.6 18.9 45.6 19.8 37.6 18.8C29.6 17.8 22 16.2 13.6 17.4"
                  stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
                <path
                  d="M21 12.2L13 17.5L21 22"
                  stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--pink)', whiteSpace: 'nowrap' }}>
                Ahorrá hasta {ahorroMaximo}%!
              </span>
            </div>
          )}
        </div>

        {!catalog && (
          <div style={{ fontSize: 12, color: '#8C3A3A', background: '#FFF0F0', border: '1px solid #F0A0A0', borderRadius: 10, padding: '14px 20px', marginBottom: 24, maxWidth: 1020, marginLeft: 'auto', marginRight: 'auto' }}>
            Los planes todavía no están configurados. (Falta cargar el catálogo de precios.)
          </div>
        )}

        {/* Plan cards */}
        <style>{`@media(max-width:900px){.plan-cards-grid{grid-template-columns:1fr!important;max-width:100%!important}}`}</style>
        <div className="plan-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, maxWidth: 1020, margin: '0 auto' }}>
          {orderedTiers.map((entry) => {
            const meta = PLAN_META[entry.tier];
            const isCurrent = entry.tier === currentTier;
            const isHov = hovered === entry.tier;
            const isUpgrade = TIER_ORDER[entry.tier] > TIER_ORDER[currentTier];
            const amount = interval === 'yearly' ? entry.amount_yearly : entry.amount_monthly;
            const period = interval === 'yearly' ? 'EUR / año' : 'EUR / mes';
            const monthlyEquivalent =
              interval === 'yearly' ? Math.round((entry.amount_yearly / 12) * 10) / 10 : null;

            const oscura = meta.cabecera === 'oscura';
            const suave = meta.cabecera === 'suave';

            return (
              <div key={entry.tier}
                onMouseEnter={() => setHovered(entry.tier)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: '#fff',
                  border: isCurrent ? '1.5px solid var(--ink)' : '1px solid #F1E9E7',
                  borderRadius: 22, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  boxShadow: isHov ? '0 16px 40px rgba(28,25,23,0.10)' : '0 2px 10px rgba(28,25,23,0.04)',
                  transform: isHov ? 'translateY(-4px)' : 'none',
                  transition: 'all 0.2s',
                }}>

                {/* Cabecera */}
                <div style={{
                  background: oscura ? 'var(--ink)' : suave ? 'var(--pink-wash)' : 'transparent',
                  padding: oscura || suave ? '22px 26px' : '26px 26px 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div>
                    {meta.encima && (
                      <div style={{
                        fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, marginBottom: 7,
                        color: oscura ? 'rgba(255,255,255,0.72)' : 'var(--pink)',
                      }}>{meta.encima}</div>
                    )}
                    {/* La otra rama del mismo titulo: ver la nota de mas abajo. */}
                    {(oscura || suave) && (
                      <h2 style={{
                        fontSize: 15, fontWeight: 800, letterSpacing: '0.1em',
                        color: oscura ? '#fff' : 'var(--ink)', margin: 0,
                      }}>{meta.name}</h2>
                    )}
                  </div>

                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: oscura ? 'transparent' : suave ? '#fff' : 'var(--pink-wash)',
                    border: oscura ? '1.5px solid var(--pink)' : 'none',
                    color: 'var(--pink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                      <path d={meta.icono} stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div style={{ padding: oscura || suave ? '22px 26px 0' : '18px 26px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* h2 y no div: es el titulo de la tarjeta. En un <div> el
                      lector de pantalla no puede saltar de plan en plan.
                      margin: 0 para no heredar el margen por defecto del h2 y
                      dejar el diseno igual. */}
                  {!oscura && !suave && (
                    <h2 style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--pink)', margin: '0 0 16px' }}>
                      {meta.name}
                    </h2>
                  )}

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 38, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{formatEur(amount)}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>/ {period}</span>
                  </div>
                  {monthlyEquivalent && (
                    <div style={{ fontSize: 11.5, color: 'var(--pink)', marginBottom: 6 }}>
                      ≈ {monthlyEquivalent}€ por mes, facturado al año
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 22 }}>{meta.desc}</div>

                  <div style={{ borderTop: '1px solid #F1E9E7', paddingTop: 20, marginBottom: 22 }}>
                    {meta.features.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 12 }}>
                        <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                          <path d="M2 7l3.5 3.5L12 3" stroke="var(--pink)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 'auto', paddingBottom: 26 }}>
                    {isCurrent ? (
                      <>
                        <div style={{
                          textAlign: 'center', padding: '13px 12px', fontSize: 11.5, letterSpacing: '0.12em',
                          fontWeight: 700, color: 'var(--pink)', border: '1.5px solid var(--pink)', borderRadius: 999,
                        }}>PLAN ACTIVO</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 11 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
                          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Tu plan actual</span>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => startCheckout(entry.tier)}
                        disabled={loadingTier === entry.tier}
                        style={{
                          width: '100%', padding: '14px 12px', fontSize: 11.5, letterSpacing: '0.12em', fontWeight: 700,
                          background: 'var(--pink)', color: '#fff', border: 'none', borderRadius: 999,
                          cursor: 'pointer', fontFamily: 'inherit',
                          opacity: loadingTier === entry.tier ? 0.6 : isHov ? 0.9 : 1, transition: 'opacity 0.15s',
                        }}>
                        {loadingTier === entry.tier
                          ? 'REDIRIGIENDO…'
                          : isUpgrade ? 'EMPEZAR 7 DÍAS GRATIS' : 'CAMBIAR A ESTE PLAN'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Franja de confianza. Cada linea describe algo que el sistema hace. */}
        <div style={{
          marginTop: 34, borderRadius: 22, border: '1px solid #F1E9E7', background: '#fff',
          padding: '26px 28px', maxWidth: 1020, margin: '34px auto 0',
        }}>
          <div style={{ display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            {[
              ['SIN COMPROMISOS', 'Cambiá o cancelá cuando quieras. Sin permanencias.',
               'M8 1.8l5 2v4.1c0 3-2.1 5.4-5 6.3-2.9-.9-5-3.3-5-6.3V3.8l5-2z'],
              ['PAGO SEGURO', 'El pago lo procesa Stripe. La tarjeta nunca pasa por acá.',
               'M4 7V5.2a4 4 0 018 0V7', 'M3.2 7h9.6v6.2H3.2V7z'],
              ['CANCELÁ CUANDO QUIERAS', 'Desde tu cuenta, en segundos, sin escribirle a nadie.',
               'M8 4.5v3.7l2.4 1.4', 'M8 14A6 6 0 108 2a6 6 0 000 12z'],
              ['HECHO PARA VOS', 'Tres planes pensados para cada etapa de tu entrenamiento.',
               'M8 13.2S2.6 10 2.6 6.3A2.9 2.9 0 018 4.8a2.9 2.9 0 015.4 1.5c0 3.7-5.4 6.9-5.4 6.9z'],
            ].map(([titulo, texto, d, d2]) => (
              <div key={titulo} style={{ display: 'flex', gap: 13 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--pink-wash)', color: 'var(--pink)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d={d} stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                    {d2 && <path d={d2} stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />}
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--pink)' }}>{titulo}</p>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 5, lineHeight: 1.6 }}>{texto}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 24, paddingTop: 20, borderTop: '1px solid #F1E9E7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              border: '1.5px solid var(--pink-wash)', color: 'var(--pink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700,
            }}>?</div>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              ¿Tenés dudas? Escribinos por el{' '}
              <a href="/dashboard/chat" style={{ color: 'var(--pink)', textDecoration: 'none', fontWeight: 700 }}>chat</a>
              {' '}y te ayudamos.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
