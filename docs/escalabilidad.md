# Escalabilidad — qué se resuelve pagando y qué no

El objetivo del plan A–E no era certificar 5000 usuarias simultáneas. Era que
**el código nunca sea el cuello de botella**: que cuando entre más gente, la
respuesta sea *"subo el plan de Supabase"* y no *"hay que reescribir el chat"*.

Este documento es la lista de qué queda de cada lado de esa raya.

---

## 1. Límites que se resuelven SOLO subiendo el plan

Ninguno de estos necesita tocar código. Son los que hay que mirar cuando el
sistema empiece a ir lento con muchas alumnas.

| Límite | Dónde se ve | Cómo se sube |
|---|---|---|
| **Conexiones simultáneas a Postgres** | Errores `too many connections`, o consultas que esperan | Compute size de Supabase. El pooler ya está en uso vía PostgREST |
| **CPU y RAM de la base** | Todo lento a la vez, sin una consulta culpable | Compute size |
| **Conexiones simultáneas de Realtime** | El chat deja de recibir mensajes en salas grandes | Plan de Supabase (Free ≈ 200 concurrentes) |
| **Mensajes por segundo de Realtime** | Mensajes que llegan tarde en salas muy activas | Plan de Supabase |
| **Almacenamiento de base y de Storage** | Avisos de cuota | Plan de Supabase |
| **Ancho de banda de video** | Facturación de Bunny | Bunny cobra por uso, no hay tope duro |
| **Ejecuciones concurrentes de funciones** | `504` en picos | Plan de Vercel |
| **Correo transaccional** | Correos que no llegan | Todavía **no existe**: falta dominio y SMTP |

**La regla práctica:** si el síntoma aparece en *todas* las pantallas a la vez,
es plan. Si aparece en *una* pantalla, es código.

---

## 2. Lo que se arregló para que no dependa del plan

Estas eran las partes donde pagar más **no** habría alcanzado.

### El chat (fase B)

**El N+1 de los mensajes.** Por cada mensaje que llegaba por realtime, el
navegador volvía a pedirle la fila al servidor sólo para resolver el nombre del
autor. Una sala de 50 personas con 20 mensajes por minuto hacía **1000
consultas por minuto para pintar nombres**.

Ahora el autor viaja copiado en la propia fila (`author_name`,
`author_is_admin`) y el payload de realtime ya trae todo. **Cero consultas.**

**El límite de envío.** Un `BEFORE INSERT` en la base: 10 mensajes cada 10
segundos. Va en la base y no en el cliente porque un límite en el navegador se
saltea desde la consola con la misma sesión.

**La degradación con gracia.** Antes, si el canal fallaba, la sala quedaba
**muda sin avisar**: los mensajes propios se veían y los ajenos no llegaban
nunca. Ahora avisa, reintenta con espera creciente y ofrece un botón.

### El guardado de progreso (fase C)

Eran **dos viajes** por guardado: uno para leer el máximo anterior y otro para
escribir. Ahora es **uno**, con `greatest()` resuelto en Postgres.

Y el reproductor guarda **cada 30 segundos en vez de cada 10**: una clase de 45
minutos pasó de 270 guardados a 90. Sumado, el tráfico de escritura de progreso
bajó a **un sexto**.

### Las consultas (fase D)

- La biblioteca filtra por categoría **en SQL**, contra un índice GIN que
  existía desde el primer día y no se usaba nunca.
- `description_i18n` — el campo más pesado — **sólo viaja cuando hay búsqueda**.
- La biblioteca **pagina** de a 24 en vez de traer el catálogo entero.
- `/admin/chat` descarta los DM **en SQL**. Antes traía uno por alumna para
  tirarlos al llegar.
- **`/admin/users` pagina** de a 50. Los totales de arriba van en su propia
  consulta: contarlos sobre la página diría "3 solistas" habiendo 30.
- **La barra lateral de DM pagina** de a 40, y la sala se pide con `.contains()`
  contra el índice GIN en vez de traer todas y buscar en memoria.
- **El historial de chat va hacia atrás**, por keyset (`created_at <` el más
  viejo cargado) y no por offset — con offset, un mensaje nuevo corre la ventana
  y aparecen repetidos.

### Los datos compartidos (fase E)

`site_settings` y `categories` se leen de caché con invalidación por tag. No
dependen de quién mira, así que se pueden compartir entre todas.

---

## 3. Lo que queda pendiente y NO se arregla pagando

Honestidad sobre lo que falta.

### ✅ DECISIÓN: no migrar a Broadcast

**Decidido el 2026-08-04, con los números sobre la mesa.** No es un pendiente:
es una decisión tomada, y acá está el criterio para reconsiderarla.

#### Qué se evaluó

Con `postgres_changes`, Postgres evalúa las policies **una vez por conexión
suscrita** en cada cambio. Broadcast envía una vez y deja la autorización en las
policies de `realtime.messages`.

#### Los números, que son lo que decide

| | Costo por mensaje |
|---|---|
| **El N+1, que ya se arregló** | **N consultas** — una por cada persona conectada |
| Lo que ahorraría Broadcast | ~40 evaluaciones de RLS |

Una consulta completa —ida, vuelta, red, parseo— contra una evaluación de policy
dentro del mismo proceso de Postgres. **No son comparables.** El N+1 era el
costo dominante por dos órdenes de magnitud, y ya no está.

#### Las tres razones

1. **No reduce las conexiones WebSocket**, que es el techo real del plan. Con
   Broadcast siguen siendo una por persona.
2. **El N+1 ya está resuelto.** Era el 98% del costo.
3. **Cambiaría una regla robusta por una frágil.** Hoy la autorización compara
   UUIDs contra `participant_ids`. Con Broadcast pasa a depender de **parsear el
   nombre de un topic** y derivar de ahí a qué sala corresponde. Un error de
   parseo no da un error: da una fuga. Y del otro lado hay conversaciones
   privadas entre una alumna y su profesora.

#### Cuándo reconsiderarlo

Las tres condiciones, juntas:

- El plan de Supabase soporta **miles de conexiones concurrentes** — o sea que
  el techo dejó de ser la conexión y pasó a ser la evaluación de RLS.
- Hay **cientos de personas en una misma sala** a la vez.
- **Realtime Authorization tiene rodaje en producción** en más proyectos. Hoy es
  relativamente nuevo, y la superficie de error está justo donde más duele.

Mientras tanto, lo que sostiene el aislamiento son las policies de las tablas,
que están probadas por el banco de tests de aislamiento (`tests/aislamiento`).

### ⚠️ Agregación en TypeScript — techo ~500 alumnas

`/admin/analiticas` trae las filas y agrega en memoria. Por debajo de 500
alumnas es más rápido que contar en SQL. Por encima hay que pasarlo a funciones
SQL — lo que sí es una migración. Toda la lectura está aislada en
`src/features/admin/analitica/`, así que el cambio no toca ninguna pantalla.

### ⚠️ Filtros de nivel, duración y estado, en memoria

Los tres se aplican en JavaScript sobre la página ya traída. Con un catálogo de
clases —decenas, no millones— no justifica complicar la consulta.

### ⚠️ Búsqueda por texto sin índice

`?q=` compara en JavaScript. Hacerlo bien necesita full-text search de Postgres,
que es una migración con `tsvector` y su índice.

### La navegación, que era el problema que más se sentía

No era la base: el servidor respondía bien. Había **3 `loading.tsx`** en todo el
proyecto y **0 `<Suspense>`**, así que cada clic dejaba la pantalla congelada
hasta que el servidor terminaba de renderizar.

Ahora hay **19 esqueletos** con la forma de su pantalla, y las rutas de chat
**no llevan** —ahí cambiar de conversación no es cambiar de página—.

Las **22 anclas internas** pasaron a `<Link>`. Quedan 5 `<a>` a propósito: tres
enlaces externos, la descarga del CSV y la URL firmada de un documento. `<Link>`
haría navegación de cliente y rompería las descargas.

El chat envía **optimista**: el mensaje aparece antes de salir, con un tilde
gris, y si el insert falla queda marcado en rojo con opción de reintentar.

---

## 4. Qué mirar cuando algo vaya lento

1. **¿Es una pantalla o todas?** Una → código. Todas → plan.
2. **Runtime Logs de Vercel**, duración de la función. Si la función tarda poco
   y la página igual va lenta, es la base.
3. **Supabase → Reports**, uso de CPU y conexiones.
4. Si el chat no recibe pero el resto anda: **conexiones de Realtime**, que es
   el límite que primero se toca al crecer.
