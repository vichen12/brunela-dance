'use client';

import { useState, useRef, useEffect } from 'react';

type Mode = 'direct' | 'community';

type Message = {
  id: number;
  from: string;
  isMe?: boolean;
  isBrunela?: boolean;
  ini?: string;
  text: string;
  t: string;
};

function nowTime() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const BRUNELA_DIRECT: Message[] = [
  { id: 1, from: 'brunela', isBrunela: true, text: 'Hola! Bienvenida al estudio 🤍 ¿Cómo te va con las clases?', t: '10:14' },
  { id: 2, from: 'brunela', isBrunela: true, text: 'Si tenés alguna consulta técnica o querés que te recomiende por dónde empezar, escribime acá 🩰', t: '10:15' },
];

const COMMUNITY_MSGS: Message[] = [
  { id: 1, from: 'Ana M.', ini: 'A', text: 'Acabo de terminar el módulo de PBT y me explotó la cabeza de lo bueno que es 🙌', t: '9:40' },
  { id: 2, from: 'Laura P.', ini: 'L', text: 'Yo lo hice el mes pasado — te cambia TODO. La diferencia en el arabesque es brutal.', t: '9:43' },
  { id: 3, from: 'brunela', isBrunela: true, text: 'Qué alegría leer esto 🥹 Eso es exactamente lo que busco con el programa. Sigamos!', t: '9:55' },
  { id: 4, from: 'Marta V.', ini: 'M', text: 'Pregunta: el estiramiento de la clase 2 de stretching, ¿cuántas veces por semana lo recomendás?', t: '11:02' },
  { id: 5, from: 'brunela', isBrunela: true, text: 'Mínimo 3 veces, idealmente después de cada práctica. Si lo hacés a diario, en 2 semanas notás la diferencia 💪', t: '11:10' },
];

const USER_COLORS = ['#F5E4E0', '#DFF0E8', '#FFF4E0', '#EDE0DB', '#E8E0F0'];
const USER_TEXT: Record<string, string> = {
  '#F5E4E0': '#8C5A55', '#DFF0E8': '#2E7D5E', '#FFF4E0': '#9A6800',
  '#EDE0DB': '#7A6B68', '#E8E0F0': '#6A5A8C',
};

function userBg(name: string) { return USER_COLORS[name.charCodeAt(0) % USER_COLORS.length]; }

function Bubble({ msg, myName }: { msg: Message; myName: string }) {
  const isMe = msg.isMe;
  const isBrunela = msg.isBrunela;

  if (isMe) return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
      <div style={{ maxWidth: '68%' }}>
        <div style={{ background: '#8C5A55', color: '#FDF8F6', borderRadius: '14px 14px 3px 14px', padding: '11px 15px', fontSize: 13, lineHeight: 1.55 }}>{msg.text}</div>
        <div style={{ fontSize: 8.5, color: '#C49490', textAlign: 'right', marginTop: 5 }}>{msg.t}</div>
      </div>
    </div>
  );

  if (isBrunela) return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #DFC0BB, #B8857F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#FDF8F6', flexShrink: 0 }}>B</div>
      <div style={{ maxWidth: '72%' }}>
        <div style={{ fontSize: 8, letterSpacing: '0.1em', color: '#B8857F', marginBottom: 5, fontWeight: 700 }}>BRUNELA</div>
        <div style={{ background: '#FBF0EE', border: '1px solid #EDE0DB', borderRadius: '3px 14px 14px 14px', padding: '11px 15px', fontSize: 13, color: '#1C1618', lineHeight: 1.55 }}>{msg.text}</div>
        <div style={{ fontSize: 8.5, color: '#C49490', marginTop: 5 }}>{msg.t}</div>
      </div>
    </div>
  );

  const bg = userBg(msg.from);
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, color: USER_TEXT[bg], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{msg.ini}</div>
      <div style={{ maxWidth: '72%' }}>
        <div style={{ fontSize: 8, letterSpacing: '0.08em', color: '#A89490', marginBottom: 5 }}>{msg.from}</div>
        <div style={{ background: '#FFFFFF', border: '1px solid #EDE0DB', borderRadius: '3px 14px 14px 14px', padding: '11px 15px', fontSize: 13, color: '#1C1618', lineHeight: 1.55 }}>{msg.text}</div>
        <div style={{ fontSize: 8.5, color: '#C49490', marginTop: 5 }}>{msg.t}</div>
      </div>
    </div>
  );
}

export function ChatInterface({ mode, userName }: { mode: Mode; userName: string }) {
  const isCommunity = mode === 'community';
  const [messages, setMessages] = useState<Message[]>(isCommunity ? COMMUNITY_MSGS : BRUNELA_DIRECT);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function send() {
    if (!input.trim()) return;
    const ini = (userName.trim()[0] ?? 'A').toUpperCase();
    const newMsg: Message = {
      id: Date.now(),
      from: isCommunity ? userName : 'me',
      isMe: true,
      ini,
      text: input.trim(),
      t: nowTime(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
  }

  const title = isCommunity ? 'COMUNIDAD' : 'CHAT CON BRUNELA';
  const subtitle = isCommunity ? '42 alumnas activas hoy' : 'Responde normalmente en menos de 24hs';

  return (
    <div style={{
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'linear-gradient(160deg, #FDF8F6 0%, #FAF3F0 100%)',
    }}>
      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE0DB', padding: '18px 40px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        {isCommunity ? (
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F5E4E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🩰</div>
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #DFC0BB, #B8857F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#FDF8F6' }}>B</div>
        )}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#1C1618' }}>{title}</div>
          <div style={{ fontSize: 10, color: '#B8857F', marginTop: 2 }}>{subtitle}</div>
        </div>
        {!isCommunity && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4CAF82' }}/>
            <span style={{ fontSize: 9, letterSpacing: '0.1em', color: '#4CAF82' }}>EN LÍNEA</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px' }}>
        {messages.map((m) => <Bubble key={m.id} msg={m} myName={userName} />)}
        <div ref={endRef}/>
      </div>

      {/* Input */}
      <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderTop: '1px solid #EDE0DB', padding: '16px 40px', display: 'flex', gap: 10, flexShrink: 0 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={isCommunity ? 'Escribí al grupo...' : 'Escribile a Brunela...'}
          style={{
            flex: 1, border: '1px solid #EDE0DB', borderRadius: 24,
            padding: '11px 18px', fontSize: 13, color: '#1C1618',
            background: '#FDF8F6', outline: 'none',
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          }}
        />
        <button onClick={send} style={{
          background: '#8C5A55', border: 'none', borderRadius: '50%',
          width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s', flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#6E3F3A')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#8C5A55')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 8L2 3l3 5-3 5 12-5z" fill="#FDF8F6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
