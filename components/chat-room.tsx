'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

export type ChatMessage = {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  is_deleted: boolean;
  profiles: { full_name: string | null; email: string; is_admin: boolean } | null;
};

/** Con quien habla la alumna. Ver el comentario de `displayName`. */
export type Interlocutor = { id: string; name: string; isAdmin: boolean };

/**
 * Nombre a mostrar de quien escribio el mensaje.
 *
 * El `profiles` embebido en cada mensaje viene NULL cuando la RLS no deja leer
 * ese perfil, que es justo lo que le pasa a una alumna con el perfil de la
 * admin: los mensajes de Brunela se veian como "Usuario" con avatar "U".
 * Por eso aceptamos el interlocutor por props -- la pagina ya lo resolvio con
 * get_studio_admin() -- en vez de aflojar la RLS de profiles.
 */
function displayName(msg: ChatMessage, interlocutor?: Interlocutor | null): string {
  if (!msg.profiles) {
    if (interlocutor && msg.user_id === interlocutor.id) return interlocutor.name;
    return 'Usuario';
  }
  if (msg.profiles.is_admin) return 'Brunela';
  return msg.profiles.full_name?.split(' ')[0] ?? msg.profiles.email.split('@')[0];
}

function initial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function Avatar({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  if (isAdmin) return (
    <div style={{
      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
      background: 'linear-gradient(135deg, var(--rose), var(--pink-mid))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 800, color: '#fff',
    }}>B</div>
  );
  const colors = ['var(--pink-wash)', '#f0fdf4', '#fefce8', '#eff6ff', 'var(--pink-wash)'];
  const texts = ['var(--pink-mid)', '#166534', '#854d0e', '#1d4ed8', '#7e22ce'];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
      background: colors[idx], color: texts[idx],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, border: '1.5px solid rgba(0,0,0,0.06)',
    }}>{initial(name)}</div>
  );
}

function MessageBubble({
  msg, isMe, isAdmin, canModerate, onDelete, onMute, interlocutor,
}: {
  msg: ChatMessage;
  isMe: boolean;
  isAdmin: boolean;
  canModerate: boolean;
  onDelete: (id: string) => void;
  onMute: (userId: string, name: string) => void;
  interlocutor?: Interlocutor | null;
}) {
  const [hover, setHover] = useState(false);
  const name = displayName(msg, interlocutor);
  const senderIsAdmin =
    msg.profiles?.is_admin ??
    (interlocutor && msg.user_id === interlocutor.id ? interlocutor.isAdmin : false);

  if (isMe) return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
      <div style={{ maxWidth: '70%' }}>
        <div style={{
          background: 'var(--pink)',
          color: '#fff', borderRadius: '18px 18px 6px 18px',
          padding: '12px 17px', fontSize: 13.5, lineHeight: 1.55,
        }}>{msg.content}</div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
          fontSize: 10, color: 'var(--muted)', marginTop: 5,
        }}>
          {timeLabel(msg.created_at)}
          {/* Doble tilde: el mensaje quedo guardado en el servidor. */}
          <svg width="15" height="10" viewBox="0 0 20 12" fill="none" aria-label="Enviado">
            <path d="M1 6.2L4.2 9.5 10.5 2.5" stroke="var(--pink)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 6.2L11.2 9.5 17.5 2.5" stroke="var(--pink)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Avatar name={name} isAdmin={senderIsAdmin} />
      <div style={{ maxWidth: '70%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: senderIsAdmin ? 'var(--pink)' : 'var(--muted)', letterSpacing: '0.08em' }}>
            {name.toUpperCase()}
          </span>
          {senderIsAdmin && (
            <span style={{ fontSize: 7.5, background: 'var(--pink-wash)', color: 'var(--pink)', padding: '1px 6px', borderRadius: 99, fontWeight: 700, letterSpacing: '0.1em' }}>
              INSTRUCTORA
            </span>
          )}
        </div>
        <div style={{
          background: '#fff',
          border: '1px solid #F1E9E7',
          borderRadius: '6px 18px 18px 18px',
          padding: '12px 17px', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55,
        }}>{msg.content}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--muted)' }}>{timeLabel(msg.created_at)}</span>
          {canModerate && hover && msg.user_id && (
            <>
              <button
                onClick={() => onDelete(msg.id)}
                style={{ fontSize: 9, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
              >eliminar</button>
              {!senderIsAdmin && (
                <button
                  onClick={() => onMute(msg.user_id!, name)}
                  style={{ fontSize: 9, color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                >mutear</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatRoom({
  roomId,
  userId,
  isAdmin,
  initialMessages,
  placeholder = 'Escribí un mensaje...',
  roomName,
  interlocutor,
}: {
  roomId: string;
  userId: string;
  isAdmin: boolean;
  initialMessages: ChatMessage[];
  placeholder?: string;
  roomName?: string;
  /** Con quien habla, para los mensajes cuyo perfil la RLS no deja leer. */
  interlocutor?: Interlocutor | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [muteTarget, setMuteTarget] = useState<{ id: string; name: string } | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState<'1h' | '24h' | '7d' | 'permanent'>('24h');
  const endRef = useRef<HTMLDivElement>(null);
  // Una sola instancia por montaje: sin esto cada render creaba un cliente
  // nuevo y el efecto de abajo, que ahora depende de el, se resuscribiria en
  // bucle.
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;

    (async () => {
      // El socket TIENE que llevar el JWT de la usuaria antes de unirse al
      // canal. postgres_changes filtra por RLS del lado del servidor, asi que
      // un canal que se une solo con la clave anonima queda suscripto pero no
      // recibe absolutamente nada, en silencio. Verificado: el frame phx_join
      // salia sin access_token, y por eso ningun mensaje aparecia hasta
      // recargar la pagina -- ni siquiera el que acababa de escribir una misma.
      const { data } = await supabase.auth.getSession();
      if (cancelado) return;

      const token = data.session?.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (cancelado) return;

      channel = supabase
        .channel(`chat-room-${roomId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        }, async (payload) => {
          const { data: fila } = await supabase
            .from('chat_messages')
            .select('*, profiles(full_name, email, is_admin)')
            .eq('id', (payload.new as { id: string }).id)
            .single<ChatMessage>();
          // Sin duplicar: el evento llega tambien para los mensajes propios.
          if (fila) {
            setMessages((prev) => (prev.some((m) => m.id === fila.id) ? prev : [...prev, fila]));
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        }, (payload) => {
          const updated = payload.new as { id: string; is_deleted: boolean };
          if (updated.is_deleted) {
            setMessages((prev) => prev.filter((m) => m.id !== updated.id));
          }
        })
        .subscribe();
    })();

    return () => {
      cancelado = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    await supabase.from('chat_messages').insert({ room_id: roomId, user_id: userId, content: text });
    setSending(false);
  }, [input, sending, roomId, userId]);

  const deleteMessage = useCallback(async (id: string) => {
    await supabase.from('chat_messages').update({ is_deleted: true }).eq('id', id);
  }, []);

  const confirmMute = useCallback(async () => {
    if (!muteTarget) return;
    const durationMs: Record<typeof muteDuration, number | null> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      permanent: null,
    };
    const ms = durationMs[muteDuration];
    const expiresAt = ms == null ? null : new Date(Date.now() + ms).toISOString();
    // unique(user_id) on chat_mutes -> upsert so re-muting updates the record.
    await supabase.from('chat_mutes').upsert(
      {
        user_id: muteTarget.id,
        muted_by: userId,
        reason: muteReason || null,
        expires_at: expiresAt,
      },
      { onConflict: 'user_id' }
    );
    setMuteTarget(null);
    setMuteReason('');
    setMuteDuration('24h');
  }, [muteTarget, muteReason, muteDuration, userId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Room label */}
      {roomName && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--pink-soft)', flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--pink)' }}>
            {roomName.toUpperCase()}
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(12px,3vw,20px) clamp(12px,3vw,20px) 8px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13 }}>
            Todavía no hay mensajes. Sé la primera en escribir 🩰
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            isMe={m.user_id === userId}
            isAdmin={isAdmin}
            canModerate={isAdmin}
            onDelete={deleteMessage}
            onMute={(uid, name) => setMuteTarget({ id: uid, name })}
            interlocutor={interlocutor}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 20px', borderTop: '1px solid var(--pink-soft)', flexShrink: 0,
        display: 'flex', gap: 10, background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(8px)',
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={placeholder}
          style={{
            flex: 1, border: '1.5px solid var(--pink-soft)', borderRadius: 24,
            padding: '10px 16px', fontSize: 13, color: 'var(--ink)',
            background: 'var(--pink-wash)', outline: 'none',
            fontFamily: 'var(--font-body), sans-serif',
          }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: input.trim() ? 'var(--pink)' : 'var(--pink-soft)',
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 8L2 3l3 5-3 5 12-5z" fill={input.trim() ? '#fff' : 'var(--pink-line)'} />
          </svg>
        </button>
      </div>

      {/* Mute modal */}
      {muteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: 32, width: 360,
            boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
          }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              Mutear a {muteTarget.name}
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              La alumna no podrá escribir mientras dure el silencio.
            </p>

            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6, letterSpacing: '0.06em' }}>
              DURACIÓN
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {([
                { key: '1h', label: '1 hora' },
                { key: '24h', label: '24 horas' },
                { key: '7d', label: '7 días' },
                { key: 'permanent', label: 'Permanente' },
              ] as const).map((opt) => {
                const active = muteDuration === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setMuteDuration(opt.key)}
                    style={{
                      padding: '7px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                      background: active ? 'var(--pink)' : 'var(--pink-wash)',
                      color: active ? '#fff' : 'var(--muted)',
                      border: active ? 'none' : '1.5px solid var(--pink-soft)',
                    }}
                  >{opt.label}</button>
                );
              })}
            </div>

            <textarea
              value={muteReason}
              onChange={(e) => setMuteReason(e.target.value)}
              placeholder="Motivo (opcional)"
              style={{
                width: '100%', borderRadius: 12, border: '1.5px solid var(--pink-soft)',
                padding: '10px 14px', fontSize: 13, minHeight: 80, resize: 'vertical',
                fontFamily: 'var(--font-body), sans-serif', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={confirmMute} className="button-primary" style={{ flex: 1 }}>
                Confirmar mute
              </button>
              <button onClick={() => setMuteTarget(null)} className="button-secondary" style={{ flex: 1 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
