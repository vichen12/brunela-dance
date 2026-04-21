'use client';

import { useState } from 'react';

type Tier = 'none' | 'corps_de_ballet' | 'solista' | 'principal';

const PLANS = [
  {
    id: 'corps_de_ballet' as Tier,
    name: 'CORPS DE BALLET',
    price: '$19',
    period: 'USD / mes',
    desc: 'Acceso a toda la biblioteca on demand.',
    features: ['Biblioteca completa', 'Filtros por nivel y foco', 'Progreso guardado', '7 días de prueba gratuita'],
    accent: '#F5E4E0', accentText: '#8C5A55', highlight: false,
  },
  {
    id: 'solista' as Tier,
    name: 'SOLISTA',
    price: '$39',
    period: 'USD / mes',
    desc: 'Progreso guiado con programas estructurados.',
    features: ['Todo Corps de Ballet', 'Programas de 14 días', 'Mayor profundidad técnica', 'Semana 1: base y activación', 'Semana 2: control e integración'],
    accent: '#DFC0BB', accentText: '#5C2E29', highlight: true,
  },
  {
    id: 'principal' as Tier,
    name: 'PRINCIPAL',
    price: '$69',
    period: 'USD / mes',
    desc: 'La experiencia completa con clases en vivo.',
    features: ['Todo Solista', 'Clases en vivo con reserva', 'Acompañamiento personalizado', 'Chat directo con Brunela'],
    accent: '#1C1618', accentText: '#FDF8F6', highlight: false,
  },
];

const TIER_ORDER: Record<Tier, number> = { none: 0, corps_de_ballet: 1, solista: 2, principal: 3 };

export function PlanClient({
  currentTier,
  subscriptionStatus,
  renewsAt,
}: {
  currentTier: Tier;
  subscriptionStatus: string | null;
  renewsAt: string | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const renewDate = renewsAt
    ? new Date(renewsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div style={{
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      background: 'linear-gradient(160deg, #FDF8F6 0%, #FAF3F0 60%, #FDF6F4 100%)',
      minHeight: '100vh', overflowY: 'auto',
    }}>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE0DB', padding: '36px 48px 32px' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.22em', color: '#B8857F', marginBottom: 12 }}>SUSCRIPCIÓN</div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.06em', color: '#1C1618', marginBottom: 8 }}>MI PLAN</div>
        <div style={{ fontSize: 11, color: '#8A7470' }}>
          Cambiá tu plan en cualquier momento. Sin compromisos.
          {renewDate && <span style={{ color: '#B8857F' }}> · Renueva el {renewDate}</span>}
        </div>
      </div>

      <div style={{ padding: '40px 48px' }}>

        {/* Active subscription banner */}
        {subscriptionStatus === 'active' && (
          <div style={{
            background: '#DFF0E8', border: '1px solid rgba(76,175,130,0.4)',
            borderRadius: 10, padding: '14px 20px', marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8l4.5 4.5L14 4" stroke="#2E7D5E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 11, color: '#2E7D5E', fontWeight: 600 }}>Suscripción activa</span>
          </div>
        )}

        {/* Progress reward section */}
        <div style={{
          background: 'rgba(255,255,255,0.7)', border: '1px solid #EDE0DB',
          borderRadius: 12, padding: '22px 28px', marginBottom: 36,
          display: 'flex', gap: 28, alignItems: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#B8857F', marginBottom: 8 }}>PROGRESO TÉCNICO</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1618', marginBottom: 4 }}>Mirá todo lo que ya lograste.</div>
            <div style={{ fontSize: 11, color: '#8A7470', lineHeight: 1.6 }}>
              Estás cada vez más cerca de tus objetivos. Seguí así — el cuerpo aprende en cada práctica.
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#C49490', marginBottom: 8 }}>PRÓXIMA RECOMPENSA</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#8C5A55' }}>15</div>
            <div style={{ fontSize: 9, color: '#A89490', letterSpacing: '0.06em' }}>CLASES</div>
          </div>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 960 }}>
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentTier;
            const isHov = hovered === plan.id;
            const isUpgrade = TIER_ORDER[plan.id] > TIER_ORDER[currentTier];

            return (
              <div key={plan.id}
                onMouseEnter={() => setHovered(plan.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: plan.highlight ? '#FBF0EE' : 'rgba(255,255,255,0.92)',
                  border: isCurrent
                    ? `2px solid ${plan.accentText === '#FDF8F6' ? '#1C1618' : plan.accentText}`
                    : '1px solid #EDE0DB',
                  borderRadius: 14, overflow: 'hidden',
                  boxShadow: isHov && !isCurrent ? '0 12px 32px rgba(28,22,24,0.1)' : isCurrent ? '0 6px 24px rgba(28,22,24,0.1)' : '0 2px 8px rgba(28,22,24,0.04)',
                  transform: isHov && !isCurrent ? 'translateY(-4px)' : 'none',
                  transition: 'all 0.2s',
                }}>
                {/* Plan header */}
                <div style={{ background: plan.accent, padding: '20px 24px 16px' }}>
                  {plan.highlight && !isCurrent && (
                    <div style={{ fontSize: 8, letterSpacing: '0.14em', fontWeight: 700, color: plan.accentText, opacity: 0.7, marginBottom: 6 }}>
                      ★ MÁS ELEGIDA
                    </div>
                  )}
                  {isCurrent && (
                    <div style={{ fontSize: 8, letterSpacing: '0.14em', fontWeight: 700, color: plan.accentText, marginBottom: 6 }}>
                      ✓ TU PLAN ACTUAL
                    </div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: plan.accentText }}>
                    {plan.name}
                  </div>
                </div>

                {/* Price + features */}
                <div style={{ padding: '20px 24px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                    <span style={{ fontSize: 34, fontWeight: 800, color: '#1C1618', letterSpacing: '-0.02em' }}>{plan.price}</span>
                    <span style={{ fontSize: 10, color: '#A89490', letterSpacing: '0.06em' }}>{plan.period}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#7A6B68', lineHeight: 1.5, marginBottom: 20 }}>{plan.desc}</div>

                  <div style={{ borderTop: '1px solid #EDE0DB', paddingTop: 18, marginBottom: 22 }}>
                    {plan.features.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                          <path d="M2 7l3.5 3.5L12 3" stroke={plan.accentText === '#FDF8F6' ? '#8C5A55' : plan.accentText} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{ fontSize: 11, color: '#4A3C3A', lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ paddingBottom: 24 }}>
                    {isCurrent ? (
                      <div style={{
                        textAlign: 'center', padding: 11, fontSize: 9, letterSpacing: '0.14em',
                        fontWeight: 700, color: '#A89490', border: '1px solid #EDE0DB', borderRadius: 8,
                      }}>PLAN ACTIVO</div>
                    ) : (
                      <button style={{
                        width: '100%', padding: 12, fontSize: 9, letterSpacing: '0.14em', fontWeight: 700,
                        background: plan.highlight ? '#8C5A55' : '#1C1618',
                        color: '#FDF8F6', border: 'none', borderRadius: 8, cursor: 'pointer',
                        opacity: isHov ? 0.88 : 1, transition: 'opacity 0.15s',
                      }}>
                        {isUpgrade ? 'ACTUALIZAR PLAN' : 'CAMBIAR A ESTE PLAN'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 32, fontSize: 10, color: '#C49490' }}>
          ¿Preguntas sobre los planes?{' '}
          <a href="/dashboard/chat" style={{ color: '#B8857F', textDecoration: 'none', fontWeight: 600 }}>
            Escribile a Brunela directamente desde el chat.
          </a>
        </div>
      </div>
    </div>
  );
}
