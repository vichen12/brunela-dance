# Plan de rediseño — Sistema admin + dashboard

## Estado actual

### Lo que existe pero está roto o feo

| Sección | Problema |
|---|---|
| `/admin/videos` | Todos los formularios abiertos al mismo tiempo. "Nueva clase" sepultada arriba entre el resto |
| `/admin/chat` | Solo moderación. No se puede escribir como Brunela en ninguna sala |
| `/admin/documents` | Existe pero solo acepta URLs — no hay forma de subir archivos |
| `/admin/users` | Funcional, feo |
| `/admin` overview | Funciona bien, métricas correctas |

### Lo que directamente no existe

| Qué falta | Descripción |
|---|---|
| `/admin/live` | No hay página para crear ni editar sesiones en vivo. Las alumnas pueden reservarlas pero Brunela no las puede gestionar desde el panel |
| Notificaciones / broadcast | Sin sistema para enviar mensajes a alumnas (todas o por tier) |
| Admin escribe en chat | Admin solo puede borrar mensajes, no iniciar conversación como Brunela |

---

## Fase 1 — Lo que falta y bloquea

**Prioridad máxima. Sin esto el panel está incompleto funcionalmente.**

### 1.1 — `/admin/live` (gestión de sesiones en vivo)
- Crear sesión en vivo: título, descripción, fecha/hora, duración, tier requerido, capacidad, imagen
- Editar y cancelar sesiones existentes
- Ver lista de alumnas reservadas por sesión
- Cambiar estado: draft → published → cancelled
- Tabla: `live_sessions` + `live_session_bookings` (ya existen en la DB)

### 1.2 — Panel de broadcast / notificaciones
- Nuevo bloque en el admin: "Mensajes al estudio"
- Escribir un mensaje, elegir destinatario: todas las alumnas / Corps de Ballet / Solista / Principal
- El mensaje aparece en el dashboard de cada alumna (banner o sección de novedades)
- Requiere nueva tabla: `studio_announcements` (id, content, tier_target, published_at, expires_at)
- Requiere nueva migración de Supabase

### 1.3 — Admin puede escribir en salas de chat
- En `/admin/chat` > vista de sala > agregar campo de texto + botón "Enviar como Brunela"
- El mensaje se inserta en `chat_messages` con el `user_id` del admin
- En el chat de alumnas ese mensaje aparece con nombre "Brunela" y estilo diferenciado

---

## Fase 2 — Rediseño visual del admin

**El panel tiene que verse como una herramienta premium, no como un template genérico.**

### 2.1 — Videos
- Lista de videos colapsada: cada video es una tarjeta con thumbnail, título, estado y tier
- Botón "Editar" expande un panel inline (accordion) o abre un drawer lateral
- Formulario de "nueva clase" en la parte superior como bloque limpio y separado del resto
- Acciones rápidas desde la tarjeta: publicar / archivar / destacar sin abrir el formulario

### 2.2 — Sidebar del admin
- Íconos + labels
- Indicador visual de sección activa (borde izquierdo o pill)
- Responsive: colapsable en mobile

### 2.3 — Consistencia visual general
- Hoy el admin mezcla Tailwind y estilos inline en cada archivo por separado
- Unificar en clases CSS reutilizables en `globals.css`: `.admin-card`, `.admin-field`, `.admin-input`, `.admin-badge`
- Tipografía consistente: mismos tamaños, pesos y colores en todas las secciones

---

## Fase 3 — Comunidad y documentos (vista de alumna)

### 3.1 — `/dashboard/community`
- UI de chat funcional: lista de salas disponibles según tier, seleccionar sala, ver mensajes, escribir
- Polling cada N segundos o Supabase Realtime para mensajes nuevos
- Mensajes de Brunela con badge diferenciado

### 3.2 — `/dashboard/documents`
- Lista de archivos accesibles según tier
- Filtro por categoría
- Descarga directa o apertura en nueva pestaña
- Estado visual: nuevo / descargado

---

## Fase 4 — Performance

**Rápido de implementar, alto impacto en velocidad percibida.**

- `Promise.all` para queries paralelas en dashboard y admin overview (ambos corren 4–8 queries secuenciales)
- `loading.tsx` skeleton en `/dashboard`, `/dashboard/library`, `/dashboard/programs`, `/dashboard/live`
- `unstable_cache` para el catálogo de videos en la biblioteca (no cambia por usuario, solo filtra por tier vía RLS)

---

## Orden sugerido

```
Fase 1 → Fase 2 → Fase 3 → Fase 4
```

Fase 1 primero porque sin `/admin/live` y sin broadcast el panel está incompleto para operar el estudio.
Fase 4 se puede intercalar con cualquier otra fase — es independiente.

---

## Tablas de DB a crear (nuevas migraciones)

| Tabla | Cuándo | Para qué |
|---|---|---|
| `studio_announcements` | Fase 1.2 | Mensajes broadcast del admin a alumnas |

El resto ya existe: `live_sessions`, `live_session_bookings`, `chat_rooms`, `chat_messages`.
