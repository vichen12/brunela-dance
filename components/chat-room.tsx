'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

export type ChatMessage = {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  is_deleted: boolean;
  profiles: { full_name: string | null; email: string; is_admin: boolean } | null;
};

function displayName(msg: ChatMessage): string {
  if (!msg.profiles) return 'Usuario';
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
      background: 'linear-gradient(135deg, #f9a8d4, #be185d)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 800, color: '#fff',
    }}>B</div>
  );
  const colors = ['#fdf2f8', '#f0fdf4', '#fefce8', '#eff6ff', '#fdf4ff'];
  const texts = ['#be185d', '#166534', '#854d0e', '#1d4ed8', '#7e22ce'];
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
  msg, isMe, isAdmin, canModerate, onDelete, onMute,
}: {
  msg: ChatMessage;
  isMe: boolean;
  isAdmin: boolean;
  canModerate: boolean;
  onDelete: (id: string) => void;
  onMute: (userId: string, name: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const name = displayName(msg);
  const senderIsAdmin = msg.profiles?.is_admin ?? false;

  if (isMe) return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
      <div style={{ maxWidth: '70%' }}>
        <div style={{
          background: 'linear-gradient(135deg, #db2777, #be185d)',
          color: '#fff', borderRadius: '16px 16px 4px 16px',
          padding: '10px 14px', fontSize: 13, lineHeight: 1.55,
          boxShadow: '0 2px 8px rgba(190,24,93,0.25)',
        }}>{msg.content}</div>
        <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>
          {timeLabel(msg.created_at)}
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
            <span style={{ fontSize: 7.5, background: '#fdf2f8', color: 'var(--pink)', padding: '1px 6px', borderRadius: 99, fontWeight: 700, letterSpacing: '0.1em' }}>
              INSTRUCTORA
            </span>
          )}
        </div>
        <div style={{
          background: senderIsAdmin ? '#fdf2f8' : '#fff',
          border: senderIsAdmin ? '1.5px solid #fbcfe8' : '1px solid #f3f4f6',
          borderRadius: '4px 16px 16px 16px',
          padding: '10px 14px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.55,
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
}: {
  roomId: string;
  userId: string;
  isAdmin: boolean;
  initialMessages: ChatMessage[];
  placeholder?: string;
  roomName?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [muteTarget, setMuteTarget] = useState<{ id: string; name: string } | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-room-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*, profiles(full_name, email, is_admin)')
          .eq('id', (payload.new as { id: string }).id)
          .single<ChatMessage>();
        if (data) setMessages((prev) => [...prev, data]);
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

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

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
    await supabase.from('chat_mutes').insert({
      user_id: muteTarget.id,
      muted_by: userId,
      reason: muteReason || null,
    });
    setMuteTarget(null);
    setMuteReason('');
  }, [muteTarget, muteReason, userId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Room label */}
      {roomName && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #fce7f3', flexShrink: 0 }}>
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
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 20px', borderTop: '1px solid #fce7f3', flexShrink: 0,
        display: 'flex', gap: 10, background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(8px)',
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={placeholder}
          style={{
            flex: 1, border: '1.5px solid #fce7f3', borderRadius: 24,
            padding: '10px 16px', fontSize: 13, color: 'var(--ink)',
            background: '#fdf2f8', outline: 'none',
            fontFamily: 'var(--font-body), sans-serif',
          }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: input.trim() ? 'var(--pink)' : '#fce7f3',
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 8L2 3l3 5-3 5 12-5z" fill={input.trim() ? '#fff' : '#fbcfe8'} />
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
              La alumna no podrá escribir en este canal.
            </p>
            <textarea
              value={muteReason}
              onChange={(e) => setMuteReason(e.target.value)}
              placeholder="Motivo (opcional)"
              style={{
                width: '100%', borderRadius: 12, border: '1.5px solid #fce7f3',
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
