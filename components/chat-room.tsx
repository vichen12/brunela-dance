'use client';
import Link from 'next/link';
import { MessageCircle, SendHorizontal } from 'lucide-react';

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
      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #F38A6C, var(--pink))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 900, color: '#fff',
      boxShadow: '0 8px 16px -10px rgba(230,79,85,.85)',
    }}>B</div>
  );
  // Pasteles calidos: rubor, salvia, melocoton, lila y crema.
  const colors = ['#FFF2EE', '#E7F1E4', '#FFE9DE', '#F7EBFA', '#FFF4E8'];
  const texts = ['#B03A3E', '#3F7A45', '#C25E3A', '#8A4E9C', '#A35A2E'];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
      background: colors[idx], color: texts[idx],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 900, border: '2px solid #fff',
      boxShadow: '0 4px 10px -6px rgba(176,90,80,.5)',
    }}>{initial(name)}</div>
  );
}

function MessageBubble({
  msg, isMe, isAdmin, canModerate, onDelete, onMute, onBan, interlocutor,
  enviando = false, fallido = false, onReintentar,
}: {
  /** Optimista: todavia no confirmado por el servidor. */
  enviando?: boolean;
  /** El insert fallo. Se queda a la vista, marcado. */
  fallido?: boolean;
  onReintentar?: () => void;
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
  const verPerfil = canModerate && !senderIsAdmin && msg.user_id ? `/admin/users/${msg.user_id}` : null;

  if (isMe) return (
    <div className="crm-fila crm-fila--mia" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
      <div style={{ maxWidth: '72%' }}>
        <div style={{
          // --pink-mid y no --pink: esto es texto de LECTURA SOSTENIDA a 13.5px
          // en peso normal, no una etiqueta que se mira de reojo. Blanco sobre
          // --pink da 3.78:1 y sobre --pink-mid da 4.83:1, que cumple AA. A
          // simple vista son casi el mismo coral.
          background: fallido ? '#fff' : 'var(--pink-mid)',
          color: fallido ? '#991b1b' : '#fff',
          border: fallido ? '1.5px solid #fecaca' : 'none',
          borderRadius: '22px 22px 8px 22px',
          padding: '12px 18px', fontSize: 14, lineHeight: 1.55,
          boxShadow: fallido ? 'none' : '0 12px 22px -16px rgba(217,52,56,.9)',
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          // Mientras viaja, apenas translucido. Sutil a proposito: el mensaje ya
          // esta ahi, solo todavia no confirmado.
          opacity: enviando ? 0.62 : 1,
          transition: 'opacity 160ms ease',
        }}>{msg.content}</div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
          fontSize: 11.5, fontWeight: 600, color: fallido ? '#991b1b' : 'var(--muted)', marginTop: 5, paddingRight: 4,
        }}>
          {fallido ? (
            <>
              <span style={{ fontWeight: 700 }}>No se envió</span>
              <button
                onClick={onReintentar}
                style={{
                  fontSize: 11.5, fontWeight: 800, color: '#991b1b', background: 'none', fontFamily: 'inherit',
                  border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline',
                }}
              >Reintentar</button>
            </>
          ) : (
            <>
              {timeLabel(msg.created_at)}
              {enviando ? (
                /* Un solo tilde gris: salio, todavia no confirmado. */
                <svg width="11" height="10" viewBox="0 0 12 12" fill="none" aria-label="Enviando">
                  <path d="M1 6.2L4.2 9.5 10.5 2.5" stroke="var(--muted)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                /* Doble tilde: el mensaje quedo guardado en el servidor. */
                <svg width="15" height="10" viewBox="0 0 20 12" fill="none" aria-label="Enviado">
                  <path d="M1 6.2L4.2 9.5 10.5 2.5" stroke="var(--pink)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 6.2L11.2 9.5 17.5 2.5" stroke="var(--pink)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="crm-fila"
      style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-end' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* La admin llega al perfil de la alumna desde el chat: nombre y avatar
          llevan a su ficha, donde puede escribirle, invitarla o cambiarle el plan. */}
      {verPerfil ? (
        <Link href={verPerfil as never} title={`Ver el perfil de ${name}`} aria-label={`Ver el perfil de ${name}`} className="crm-perfil">
          <Avatar name={name} isAdmin={senderIsAdmin} />
        </Link>
      ) : (
        <Avatar name={name} isAdmin={senderIsAdmin} />
      )}
      <div style={{ maxWidth: '72%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, paddingLeft: 4 }}>
          {verPerfil ? (
            <Link href={verPerfil as never} className="crm-perfil-nombre" style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', textDecoration: 'none' }}>
              {name}
            </Link>
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: 800, color: senderIsAdmin ? 'var(--pink-deep)' : 'var(--ink)' }}>
              {name}
            </span>
          )}
          {senderIsAdmin && (
            <span style={{ fontSize: 11, background: 'var(--rubor)', color: 'var(--pink-deep)', padding: '2px 9px', borderRadius: 99, fontWeight: 800 }}>
              Instructora
            </span>
          )}
        </div>
        <div style={{
          background: senderIsAdmin ? 'linear-gradient(160deg, #FFEDE8, #FFF6F2)' : '#FFF8F5',
          border: '1px solid var(--linea)',
          borderRadius: '8px 22px 22px 22px',
          padding: '12px 18px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.55,
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        }}>{msg.content}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, paddingLeft: 4, minHeight: 22 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>{timeLabel(msg.created_at)}</span>
          {canModerate && hover && msg.user_id && (
            <>
              <button
                onClick={() => onDelete(msg.id)}
                className="crm-mod crm-mod--borrar"
              >eliminar</button>
              {!senderIsAdmin && (
                <>
                  <button
                    onClick={() => onMute(msg.user_id!, name)}
                    className="crm-mod crm-mod--mutear"
                  >mutear</button>
                  <button
                    onClick={() => onBan(msg.user_id!, name)}
                    className="crm-mod crm-mod--banear"
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

  // Historial hacia atras (fase D). Antes se cargaban los ultimos 100 mensajes
  // y no habia NINGUNA forma de ver mas atras: una conversacion vieja quedaba
  // inalcanzable desde la aplicacion.
  //
  // `hayMasViejos` arranca en true solo si la primera tanda vino llena; si vino
  // con 12 mensajes, ya estan todos y el boton no aparece.
  const [cargandoViejos, setCargandoViejos] = useState(false);
  const [hayMasViejos, setHayMasViejos] = useState(initialMessages.length >= 100);

  // Mensajes que salieron optimistas y el insert fallo. Se quedan a la vista,
  // marcados, con opcion de reintentar: desaparecer sin avisar es peor.
  const [fallidos, setFallidos] = useState<Set<string>>(new Set());
  const [textoFallido, setTextoFallido] = useState<Record<string, string>>({});
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

  // Bajar solo cuando llega un mensaje NUEVO, no cuando se carga historial.
  //
  // Antes bajaba ante cualquier cambio de `messages`. Con el boton de "ver
  // mensajes anteriores" eso lo volveria inservible: cargaria los viejos y
  // acto seguido te devolveria al fondo, sin llegar a verlos.
  //
  // Se compara el ULTIMO id: al agregar arriba, el ultimo no cambia.
  const ultimoIdRef = useRef<string | null>(null);
  useEffect(() => {
    const ultimo = messages[messages.length - 1]?.id ?? null;
    if (ultimo === ultimoIdRef.current) return;
    ultimoIdRef.current = ultimo;
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const cargarViejos = useCallback(async () => {
    if (cargandoViejos || messages.length === 0) return;
    setCargandoViejos(true);
    try {
      // Se pide lo ANTERIOR al mas viejo que ya tenemos, con keyset y no con
      // offset: con offset, un mensaje nuevo que entra mientras tanto corre la
      // ventana y aparecen repetidos o se saltean.
      const masViejo = messages[0].created_at;
      const { data } = await supabase
        .from('chat_messages')
        .select('*, profiles(full_name, email, is_admin)')
        .eq('room_id', roomId)
        .eq('is_deleted', false)
        .lt('created_at', masViejo)
        .order('created_at', { ascending: false })
        .limit(50);

      const tanda = ((data ?? []) as unknown as ChatMessage[]).reverse();
      if (tanda.length < 50) setHayMasViejos(false);
      if (tanda.length > 0) {
        setMessages((prev) => {
          const vistos = new Set(prev.map((m) => m.id));
          return [...tanda.filter((m) => !vistos.has(m.id)), ...prev];
        });
      }
    } finally {
      setCargandoViejos(false);
    }
  }, [cargandoViejos, messages, roomId, supabase]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    // ── Envio optimista ──────────────────────────────────────────────────
    // Antes esto esperaba el insert Y DESPUES esperaba a que el propio mensaje
    // volviera por el canal de realtime para pintarlo: dos viajes completos
    // antes de ver lo que una acaba de escribir. En un chat eso se siente roto
    // aunque tarde 300 ms.
    //
    // Ahora el mensaje entra en la lista ANTES de salir. El id temporal empieza
    // con "tmp-" para poder reemplazarlo o marcarlo si falla.
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimista: ChatMessage = {
      id: tempId,
      user_id: userId,
      content: text,
      created_at: new Date().toISOString(),
      is_deleted: false,
      profiles: null,
      // El nombre se resuelve solo: es un mensaje propio, y displayName ya
      // usa `isMe` para pintarlo del lado correcto.
      author_name: null,
      author_is_admin: isAdmin,
    };

    setSending(true);
    setInput('');
    setMessages((prev) => [...prev, optimista]);

    const { error } = await supabase
      .from('chat_messages')
      .insert({ room_id: roomId, user_id: userId, content: text });

    if (error) {
      // No se borra: se MARCA. Que desaparezca sin decir nada es la peor de las
      // opciones -- la alumna cree que lo mando y nadie lo recibio.
      setFallidos((prev) => new Set(prev).add(tempId));
      setTextoFallido((prev) => ({ ...prev, [tempId]: text }));
    }
    // Si salio bien no se hace nada mas: el eco de realtime trae la fila real y
    // el efecto de abajo saca la copia temporal.

    setSending(false);
  }, [input, sending, roomId, userId, isAdmin, supabase]);

  /**
   * Saca las copias optimistas cuando llega la fila de verdad.
   *
   * Se comparan por contenido + autor dentro de una ventana de 60 segundos, no
   * por id, porque el id definitivo lo pone la base y el cliente no lo conoce.
   */
  useEffect(() => {
    setMessages((prev) => {
      const reales = prev.filter((m) => !m.id.startsWith('tmp-'));
      if (reales.length === 0) return prev;
      const sinDuplicar = prev.filter((m) => {
        if (!m.id.startsWith('tmp-')) return true;
        if (fallidos.has(m.id)) return true; // los fallidos se quedan a la vista
        return !reales.some(
          (r) =>
            r.user_id === m.user_id &&
            r.content === m.content &&
            Math.abs(+new Date(r.created_at) - +new Date(m.created_at)) < 60_000
        );
      });
      return sinDuplicar.length === prev.length ? prev : sinDuplicar;
    });
  }, [messages, fallidos]);

  const reintentar = useCallback(async (tempId: string) => {
    const text = textoFallido[tempId];
    if (!text) return;
    setFallidos((prev) => { const s = new Set(prev); s.delete(tempId); return s; });
    const { error } = await supabase
      .from('chat_messages')
      .insert({ room_id: roomId, user_id: userId, content: text });
    if (error) setFallidos((prev) => new Set(prev).add(tempId));
  }, [textoFallido, roomId, userId, supabase]);

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
    <div className="crm" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <style>{CSS_CHAT}</style>
      {/* Room label */}
      {roomName && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--linea)', flexShrink: 0 }}>
          <span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 99, background: 'var(--rubor)', fontSize: 12.5, fontWeight: 800, color: 'var(--pink-deep)' }}>
            {roomName}
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(12px,3vw,20px) clamp(12px,3vw,20px) 8px' }}>
        {messages.length === 0 && (
          <div className="crm-vacio">
            <span className="crm-vacio-burbujas" aria-hidden="true">
              <span className="crm-vacio-b crm-vacio-b--1" />
              <span className="crm-vacio-ico"><MessageCircle size={28} strokeWidth={1.8} /></span>
              <span className="crm-vacio-b crm-vacio-b--2" />
            </span>
            <span className="crm-vacio-titulo">
              Todavía no hay mensajes
            </span>
            Sé la primera en escribir.
          </div>
        )}

        {/* Historial hacia atras. Va ARRIBA de la lista, que es donde se busca
            cuando se quiere leer lo anterior. */}
        {hayMasViejos && messages.length > 0 && (
          <div style={{ textAlign: 'center', paddingBottom: 14 }}>
            <button
              onClick={cargarViejos}
              disabled={cargandoViejos}
              style={{
                border: '1.5px solid var(--pink-line)', borderRadius: 999,
                background: '#fff', color: 'var(--pink-deep)',
                padding: '9px 18px', fontSize: 13, fontWeight: 800,
                fontFamily: 'inherit', cursor: cargandoViejos ? 'default' : 'pointer',
                opacity: cargandoViejos ? 0.6 : 1,
              }}
            >{cargandoViejos ? 'Cargando…' : 'Ver mensajes anteriores'}</button>
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
          background: '#FFF4E8', borderTop: '1px solid var(--linea)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 13, color: 'var(--melocoton-deep)', fontWeight: 700, lineHeight: 1.5 }}>
            {reintentos > 5
              ? 'Sin conexión con el chat. Podés seguir escribiendo, pero no vas a ver mensajes nuevos hasta recargar.'
              : 'Reconectando… puede que no estés viendo los mensajes más nuevos.'}
          </span>
          {reintentos > 5 && (
            <button
              onClick={() => { setReintentos(0); setIntento((i) => i + 1); }}
              style={{
                flexShrink: 0, border: 0, borderRadius: 999, cursor: 'pointer',
                padding: '8px 16px', background: 'var(--pink)', color: '#fff',
                fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
              }}
            >Reintentar</button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="cr-composer" style={{
        padding: '12px clamp(12px,3vw,20px)', borderTop: '1px solid var(--linea)', flexShrink: 0,
        display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(8px)',
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={placeholder}
          aria-label={placeholder}
          style={{
            flex: 1, minWidth: 0, height: 50, border: '1.5px solid var(--linea)', borderRadius: 99,
            padding: '0 20px', fontSize: 14.5, color: 'var(--ink)',
            background: 'var(--crema)', outline: 'none', transition: 'border-color .2s, box-shadow .2s, background .2s',
            fontFamily: 'var(--font-body), sans-serif',
          }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          aria-label="Enviar mensaje"
          title="Enviar"
          style={{
            width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
            background: input.trim() ? 'var(--pink)' : 'var(--rubor)',
            color: input.trim() ? '#fff' : '#D9A99C',
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: input.trim() ? '0 12px 22px -12px rgba(230,79,85,0.85)' : 'none',
            transition: 'background 0.15s, color 0.15s, box-shadow 0.15s, transform .3s var(--curva)',
            transform: input.trim() ? 'scale(1.04)' : 'none',
          }}
        >
          <SendHorizontal size={19} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      {/* Mute modal */}
      {muteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(90,50,45,0.32)', padding: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #FFF6F2, #fff 40%)', borderRadius: 30, padding: 28, width: 380, maxWidth: '100%',
            border: '1px solid var(--linea)', boxShadow: '0 30px 60px -24px rgba(176,70,70,0.45)',
          }}>
            <p style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.015em', color: 'var(--ink)', marginBottom: 6 }}>
              {modo === 'ban' ? 'Banear' : 'Mutear'} a {muteTarget.name}
            </p>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--muted)', marginBottom: 18 }}>
              {modo === 'ban'
                ? 'No va a poder entrar a ningún canal del estudio mientras dure el baneo.'
                : 'La alumna no podrá escribir mientras dure el silencio.'}
            </p>

            <label style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
              Duración
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
                      padding: '8px 14px', borderRadius: 99, fontSize: 13, fontWeight: 800,
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: active ? 'var(--pink)' : '#fff',
                      color: active ? '#fff' : 'var(--ink)',
                      border: active ? '1.5px solid var(--pink)' : '1.5px solid var(--linea-fuerte)',
                      boxShadow: active ? '0 10px 20px -12px rgba(230,79,85,.85)' : 'none',
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
                width: '100%', borderRadius: 18, border: '1.5px solid var(--linea-fuerte)', background: '#fff',
                padding: '12px 16px', fontSize: 14, minHeight: 84, resize: 'vertical', color: 'var(--ink)',
                fontFamily: 'var(--font-body), sans-serif', outline: 'none',
              }}
            />
            {errorModeracion && (
              <p style={{
                fontSize: 12, color: '#991b1b', background: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: 14,
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
                  ...(modo === 'ban' ? { background: 'var(--pink-deep)' } : null),
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

/**
 * Lo que no se puede escribir inline: hover, foco y la animacion de entrada de
 * cada mensaje. Todo bajo .crm para no pisar nada de afuera.
 */
const CSS_CHAT = `
@keyframes crm-entra { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
.crm-fila { animation: crm-entra .45s var(--curva, ease) both; }
.crm-fila--mia { transform-origin: right bottom; }
.crm-perfil { border-radius: 50%; transition: transform .3s var(--curva, ease), box-shadow .3s; }
.crm-perfil:hover { transform: scale(1.08); box-shadow: 0 0 0 3px var(--pink-line); }
.crm-perfil-nombre:hover { color: var(--pink-deep) !important; text-decoration: underline !important; text-underline-offset: 3px; }
.crm .cr-composer input:focus { border-color: var(--pink-line) !important; background: #fff !important; box-shadow: 0 0 0 4px rgba(230,79,85,0.1); }
.crm-mod { font: inherit; font-size: 11.5px; font-weight: 800; padding: 2px 9px; border-radius: 99px; border: 0; cursor: pointer; transition: background .2s; }
.crm-mod--borrar { color: #B03A3E; background: #FDECEC; }
.crm-mod--mutear { color: #A35A2E; background: #FFF4E8; }
.crm-mod--banear { color: #8F2E32; background: #FFE4E4; }
.crm-mod:hover { filter: brightness(.96); }
.crm-vacio { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 56px 20px; color: var(--muted); font-size: 14px; }
.crm-vacio-burbujas { position: relative; width: 120px; height: 84px; margin-bottom: 8px; }
.crm-vacio-ico { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; border-radius: 22px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); box-shadow: var(--sombra); }
.crm-vacio-b { position: absolute; }
.crm-vacio-b--1 { left: 0; top: 8px; width: 34px; height: 22px; background: #FFE9DE; border-radius: 14px 14px 14px 4px; animation: crm-flota 4s ease-in-out infinite alternate; }
.crm-vacio-b--2 { right: 0; bottom: 6px; width: 40px; height: 24px; background: #F7EBFA; border-radius: 14px 14px 4px 14px; animation: crm-flota 5s ease-in-out infinite alternate-reverse; }
@keyframes crm-flota { from { transform: translateY(0); } to { transform: translateY(-6px); } }
.crm-vacio-titulo { font-weight: 900; font-size: 20px; letter-spacing: -0.02em; color: var(--ink); }
@media (prefers-reduced-motion: reduce) { .crm-fila, .crm-vacio-b { animation: none; } }
`;
