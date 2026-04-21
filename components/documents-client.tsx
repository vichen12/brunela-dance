'use client';

import { useState } from 'react';

type Doc = {
  id: number;
  cat: string;
  icon: string;
  title: string;
  sub: string;
  tag: string;
  tagBg: string;
  tagColor: string;
};

const FILTERS = [
  { key: 'all',         label: 'TODOS'       },
  { key: 'tecnica',     label: 'TÉCNICA'     },
  { key: 'programas',   label: 'PROGRAMAS'   },
  { key: 'referencias', label: 'REFERENCIAS' },
];

export function DocumentsClient({ docs }: { docs: Doc[] }) {
  const [filter, setFilter] = useState('all');
  const [downloaded, setDownloaded] = useState<Record<number, boolean>>({});
  const visible = filter === 'all' ? docs : docs.filter((d) => d.cat === filter);

  function handleDownload(id: number) {
    setDownloaded((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setDownloaded((prev) => ({ ...prev, [id]: false })), 2000);
  }

  return (
    <div style={{
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      background: 'linear-gradient(160deg, #FDF8F6 0%, #FAF3F0 60%, #FDF6F4 100%)',
      minHeight: '100vh', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE0DB', padding: '36px 48px 0' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.22em', color: '#B8857F', marginBottom: 12 }}>
          MATERIALES DE CLASE
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.06em', color: '#1C1618', marginBottom: 24 }}>
          DOCUMENTOS
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '10px 20px', background: 'transparent', border: 'none',
              borderBottom: filter === f.key ? '2px solid #B8857F' : '2px solid transparent',
              cursor: 'pointer', fontSize: 9, letterSpacing: '0.14em', fontWeight: 700,
              color: filter === f.key ? '#8C5A55' : '#A89490',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '32px 48px' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#C49490', marginBottom: 20 }}>
          {visible.length} documentos
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {visible.map((doc) => (
            <div key={doc.id} style={{
              background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(237,224,219,0.8)',
              borderRadius: 12, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 12px rgba(28,22,24,0.04)',
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(28,22,24,0.09)')}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(28,22,24,0.04)')}>
              <div style={{
                width: 48, height: 48, borderRadius: 10, background: doc.tagBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>{doc.icon}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1C1618', marginBottom: 5, lineHeight: 1.4 }}>
                  {doc.title}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 8, letterSpacing: '0.1em', fontWeight: 700,
                    background: doc.tagBg, color: doc.tagColor,
                    padding: '2px 8px', borderRadius: 20,
                  }}>{doc.tag}</span>
                  <span style={{ fontSize: 9, color: '#C49490' }}>{doc.sub}</span>
                </div>
              </div>

              <button onClick={() => handleDownload(doc.id)} style={{
                background: downloaded[doc.id] ? '#DFF0E8' : 'transparent',
                border: `1px solid ${downloaded[doc.id] ? '#4CAF82' : '#DFC0BB'}`,
                borderRadius: 8, width: 36, height: 36, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', flexShrink: 0,
              }}>
                {downloaded[doc.id] ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l3.5 3.5L12 4" stroke="#2E7D5E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2v7M4 6.5l3 3 3-3M2 11h10" stroke="#B8857F" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 36, border: '1.5px dashed #DFC0BB', borderRadius: 12, padding: 28, textAlign: 'center', background: 'rgba(253,248,246,0.5)' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#C49490', marginBottom: 6 }}>
            ZONA DE CARGA — PANEL ADMIN
          </div>
          <div style={{ fontSize: 11, color: '#A89490' }}>
            Los nuevos materiales subidos por Brunela aparecerán aquí automáticamente.
          </div>
        </div>
      </div>
    </div>
  );
}
