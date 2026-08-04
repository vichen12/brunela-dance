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

### Los datos compartidos (fase E)

`site_settings` y `categories` se leen de caché con invalidación por tag. No
dependen de quién mira, así que se pueden compartir entre todas.

---

## 3. Lo que queda pendiente y NO se arregla pagando

Honestidad sobre lo que falta.

### 🔴 `postgres_changes` evalúa RLS por conexión (fase B3, sin hacer)

Con `postgres_changes`, Postgres evalúa las policies **una vez por cada
conexión suscrita** en cada cambio. Con 500 alumnas en la misma sala, un
mensaje dispara 500 evaluaciones de RLS.

La solución es **Broadcast**, que envía una vez y deja la autorización en las
policies de `realtime.messages`.

**No se hizo, y el motivo es el riesgo:** mover la autorización de las policies
de la tabla a las de realtime puede filtrar mensajes entre salas o entre planes
si se hace mal. Verificarlo requiere levantar dos sesiones autenticadas de
planes distintos contra Supabase real y comprobar el aislamiento, y este
proyecto no tiene banco de pruebas para eso.

**Mitigante:** el costo dominante era el N+1, y ese ya no está. Broadcast
importa a partir de salas con **cientos** de personas conectadas a la vez.

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

### ⚠️ Historial de chat sin paginación hacia atrás

Se cargan los últimos 100–200 mensajes y no hay forma de ir más atrás. No es un
problema de rendimiento sino una función que falta.

---

## 4. Qué mirar cuando algo vaya lento

1. **¿Es una pantalla o todas?** Una → código. Todas → plan.
2. **Runtime Logs de Vercel**, duración de la función. Si la función tarda poco
   y la página igual va lenta, es la base.
3. **Supabase → Reports**, uso de CPU y conexiones.
4. Si el chat no recibe pero el resto anda: **conexiones de Realtime**, que es
   el límite que primero se toca al crecer.
