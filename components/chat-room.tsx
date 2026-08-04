'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { banearUsuarioAction } from '@/src/features/admin/chat-moderation';

export type ChatMessage = {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  is_deleted: boolean;
  profiles: { full_name: string | null; email: string; is_admin: boolean } | null;
  /**
   * Autor copiado en la propia fila por el trigger de la migracion
   * 20260804_chat_autor_y_rate_limit.sql.
   *
   * Opcionales porque el codigo se despliega ANTES que la migracion: mientras
   * las columnas no existan vienen undefined y todo cae al camino de siempre.
   */
  author_name?: string | null;
  author_is_admin?: boolean | null;
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
  // 1. La copia en la propia fila. Es la que resuelve el caso que la RLS de
  //    profiles no deja resolver -- el nombre viaja con el mensaje, asi que ya
  //    no hace falta poder leer el perfil ajeno.
  if (msg.author_name) {
    if (msg.author_is_admin) return 'Brunela';
    return msg.author_name.split(' ')[0];
  }

  // 2. Mientras la migracion no este corrida, el camino de siempre.
  if (!msg.profiles) {
    if (interlocutor && msg.user_id === interlocutor.id) return interlocutor.name;
    return 'Usuario';
  }
  if (msg.profiles.is_admin) return 'Brunela';
  return msg.profiles.full_name?.split(' ')[0] ?? msg.profiles.email.split('@')[0];
}

/** Igual que displayName pero para el avatar y la burbuja. */
function esDeAdmin(msg: ChatMessage): boolean {
  if (msg.author_name) return Boolean(msg.author_is_admin);
  return Boolean(msg.profiles?.is_admin);
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
  msg, isMe, isAdmin, canModerate, onDelete, onMute, onBan, interlocutor,
}: {
  msg: ChatMessage;
  isMe: boolean;
  isAdmin: boolean;
  canModerate: boolean;
  onDelete: (id: string) => void;
  onMute: (userId: string, name: string) => void;
  onBan: (userId: string, name: string) => void;
  interlocutor?: Interlocutor | null;
}) {
  const [hover, setHover] = useState(false);
  const name = displayName(msg, interlocutor);
  const senderIsAdmin = msg.author_name
    ? esDeAdmin(msg)
    : msg.profiles?.is_admin ??
      (interlocutor && msg.user_id === interlocutor.id ? interlocutor.isAdmin : false);

  if (isMe) return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
      <div style={{ maxWidth: '70%' }}>
        <div style={{
          // --pink-mid y no --pink: esto es texto de LECTURA SOSTENIDA a 13.5px
          // en peso normal, no una etiqueta que se mira de reojo. Blanco sobre
          // --pink da 3.78:1 y sobre --pink-mid da 4.83:1, que cumple AA. A
          // simple vista son casi el mismo coral.
          background: 'var(--pink-mid)',
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
                <>
                  <button
                    onClick={() => onMute(msg.user_id!, name)}
                    style={{ fontSize: 9, color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                  >mutear</button>
                  <button
                    onClick={() => onBan(msg.user_id!, name)}
                    style={{ fontSize: 9, color: '#991b1b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                  >banear</button>
                </>
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

  // B5. `enVivo` arranca en true para no mostrar un aviso durante el segundo
  // que tarda la primera conexion: parpadear "sin conexion" al abrir la sala
  // seria peor que el problema que resuelve.
  const [enVivo, setEnVivo] = useState(true);
  const [reintentos, setReintentos] = useState(0);
  /** Cambiar esto vuelve a correr el efecto del canal, o sea reconecta. */
  const [intento, setIntento] = useState(0);
  // Un solo modal para mutear y banear: mismos campos (duracion + motivo), y
  // `modo` decide el texto, el color del boton y a donde escribe.
  const [muteTarget, setMuteTarget] = useState<{ id: string; name: string } | null>(null);
  const [modo, setModo] = useState<'mute' | 'ban'>('mute');
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState<'1h' | '24h' | '7d' | 'permanent'>('24h');
  const [errorModeracion, setErrorModeracion] = useState<string | null>(null);
  const [enviandoModeracion, setEnviandoModeracion] = useState(false);
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
          const nuevo = payload.new as Partial<ChatMessage> & { id: string };

          // ── B2: el N+1 se elimina aca ──────────────────────────────────
          // El payload de postgres_changes trae la fila ENTERA. Antes se la
          // volvia a pedir al servidor solo para resolver el nombre del autor,
          // o sea UNA CONSULTA POR MENSAJE: una sala de 50 personas con 20
          // mensajes por minuto hacia 1000 consultas por minuto para pintar
          // nombres. Con el autor copiado en la fila (migracion
          // 20260804_chat_autor_y_rate_limit.sql) no hace falta ningun viaje.
          if (nuevo.author_name) {
            const fila = nuevo as ChatMessage;
            setMessages((prev) => (prev.some((m) => m.id === fila.id) ? prev : [...prev, fila]));
            return;
          }

          // Camino viejo, solo mientras la migracion no este corrida. Se puede
          // borrar en cuanto author_name este poblado en produccion.
          const { data: fila } = await supabase
            .from('chat_messages')
            .select('*, profiles(full_name, email, is_admin)')
            .eq('id', nuevo.id)
            .single<ChatMessage>();
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
        // ── B5: degradacion con gracia ───────────────────────────────────
        // Antes esto era `.subscribe()` a secas, ignorando el estado. Si el
        // canal fallaba -- limite de conexiones concurrentes del plan, red
        // caida, token vencido -- la sala quedaba MUDA: los mensajes propios
        // se veian (optimismo local) pero los ajenos no llegaban nunca, y la
        // alumna no tenia forma de enterarse. Parecia que nadie le contestaba.
        //
        // Es justo el modo de fallo que aparece cuando entra mas gente, que es
        // lo que esta fase viene a evitar.
        .subscribe((status) => {
          if (cancelado) return;
          if (status === 'SUBSCRIBED') {
            setEnVivo(true);
            setReintentos(0);
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setEnVivo(false);
            // Reintento con espera creciente, con techo: sin el techo, una
            // caida larga termina martillando el servidor desde cada pestana
            // abierta, que es como una degradacion se convierte en una caida.
            setReintentos((n) => {
              const proximo = n + 1;
              if (proximo <= 5) {
                window.setTimeout(() => setIntento((i) => i + 1), Math.min(1000 * 2 ** n, 30_000));
              }
              return proximo;
            });
          }
        });
    })();

    return () => {
      cancelado = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, supabase, intento]);

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

  const cerrarModal = useCallback(() => {
    setMuteTarget(null);
    setMuteReason('');
    setMuteDuration('24h');
    setErrorModeracion(null);
  }, []);

  const confirmarModeracion = useCallback(async () => {
    if (!muteTarget || enviandoModeracion) return;
    setEnviandoModeracion(true);
    setErrorModeracion(null);

    // BANEAR va por server action y MUTEAR por el cliente, y no es un descuido:
    // la migracion 18 le dio a `authenticated` INSERT/UPDATE sobre chat_mutes
    // pero dejo chat_bans de solo lectura. Escribir bans desde el navegador
    // daria 42501. La action valida con requireAdmin() antes de usar
    // service_role.
    if (modo === 'ban') {
      const r = await banearUsuarioAction({
        userId: muteTarget.id,
        reason: muteReason || undefined,
        duration: muteDuration,
      });
      setEnviandoModeracion(false);
      if (!r.ok) {
        setErrorModeracion(r.error);
        return;
      }
      cerrarModal();
      return;
    }

    const durationMs: Record<typeof muteDuration, number | null> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      permanent: null,
    };
    const ms = durationMs[muteDuration];
    const expiresAt = ms == null ? null : new Date(Date.now() + ms).toISOString();
    // unique(user_id) on chat_mutes -> upsert so re-muting updates the record.
    const { error } = await supabase.from('chat_mutes').upsert(
      {
        user_id: muteTarget.id,
        muted_by: userId,
        reason: muteReason || null,
        expires_at: expiresAt,
      },
      { onConflict: 'user_id' }
    );
    setEnviandoModeracion(false);
    if (error) {
      setErrorModeracion(error.message);
      return;
    }
    cerrarModal();
  }, [muteTarget, muteReason, muteDuration, userId, modo, enviandoModeracion, cerrarModal]);

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
            Todavía no hay mensajes. Sé la primera en escribir.
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
            onMute={(uid, name) => { setModo('mute'); setMuteTarget({ id: uid, name }); }}
            onBan={(uid, name) => { setModo('ban'); setMuteTarget({ id: uid, name }); }}
            interlocutor={interlocutor}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* B5. El aviso que convierte una sala muda en una sala que avisa. */}
      {!enVivo && (
        <div style={{
          padding: '10px 20px', flexShrink: 0,
          background: 'var(--pink-wash)', borderTop: '1px solid var(--pink-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 12, color: 'var(--pink-deep)', fontWeight: 600, lineHeight: 1.5 }}>
            {reintentos > 5
              ? 'Sin conexión con el chat. Podés seguir escribiendo, pero no vas a ver mensajes nuevos hasta recargar.'
              : 'Reconectando… puede que no estés viendo los mensajes más nuevos.'}
          </span>
          {reintentos > 5 && (
            <button
              onClick={() => { setReintentos(0); setIntento((i) => i + 1); }}
              style={{
                flexShrink: 0, border: 0, borderRadius: 999, cursor: 'pointer',
                padding: '7px 15px', background: 'var(--pink)', color: '#fff',
                fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
              }}
            >Reintentar</button>
          )}
        </div>
      )}

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
              {modo === 'ban' ? 'Banear' : 'Mutear'} a {muteTarget.name}
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              {modo === 'ban'
                ? 'No va a poder entrar a ningún canal del estudio mientras dure el baneo.'
                : 'La alumna no podrá escribir mientras dure el silencio.'}
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
            {errorModeracion && (
              <p style={{
                fontSize: 12, color: '#991b1b', background: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: 10,
                padding: '9px 12px', marginTop: 12, lineHeight: 1.5,
              }}>
                No se pudo aplicar: {errorModeracion}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={confirmarModeracion}
                disabled={enviandoModeracion}
                className="button-primary"
                style={{
                  flex: 1,
                  opacity: enviandoModeracion ? 0.6 : 1,
                  cursor: enviandoModeracion ? 'default' : 'pointer',
                  ...(modo === 'ban' ? { background: '#991b1b' } : null),
                }}
              >
                {enviandoModeracion
                  ? 'Aplicando…'
                  : modo === 'ban' ? 'Confirmar baneo' : 'Confirmar mute'}
              </button>
              <button onClick={cerrarModal} className="button-secondary" style={{ flex: 1 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
