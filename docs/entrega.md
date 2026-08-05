# Entrega — Brunela Dance Trainer

Qué se entregó, qué límites tiene, qué cuesta mantenerlo y qué quedó afuera.

---

## 1. Qué se entregó

**Landing pública** en cuatro idiomas (ES/EN/FR/IT), con precios y registro.

**Registro y alta** con correo y contraseña o con Google, más un onboarding que
pregunta nivel y objetivos. El plan elegido en la landing sobrevive todo el
recorrido hasta el pago.

**Área de la alumna**
- Biblioteca con buscador y cuatro filtros (nivel, duración, plan, estado)
- Reproductor HLS con **audio en varios idiomas** y cambio sin recargar
- Programas día por día, con progreso guardado
- Sesiones en vivo con reserva y enlace de Zoom protegido
- Chat con la profesora y salas por plan, en tiempo real
- Documentos del estudio, con descarga firmada
- Planes y pago con Stripe, con portal de facturación
- **Packs de clases** con pago único y acceso permanente, sin suscripción

**Panel de administración**
- Clases, categorías, programas, sesiones, documentos y anuncios
- Edición en panel lateral, con lo frecuente arriba y el resto plegado
- Moderación del chat: borrar, silenciar y bloquear
- Analíticas con las métricas que ya tienen datos
- Exportación de alumnas a CSV
- **Precios de planes y packs**, con aviso si no coinciden con Stripe
- **Packs**: crear, elegir qué clases traen, publicar y mostrar en la portada

**Infraestructura**
- Base y funciones en **Fráncfort**, por residencia de datos de la UE
- 28 migraciones versionadas — el esquema se reconstruye desde el repo
- RLS en todas las tablas
- Banco de pruebas de aislamiento: 51 pruebas contra Supabase real (chat, sesiones y packs)

---

## 2. Límites de hoy

### Lo que se resuelve pagando más

| Límite | Cuándo aparece |
|---|---|
| Conexiones simultáneas de Realtime | ~200 en el plan Free |
| CPU y RAM de la base | Todo lento a la vez |
| Conexiones a Postgres | `too many connections` |
| Almacenamiento | Avisos de cuota |
| Ancho de banda de video | Se factura por uso |

**Regla práctica:** si va lento en *todas* las pantallas, es plan. Si es en
*una*, es código.

### Lo que necesita trabajo, no plata

- **Analíticas**: agregan en memoria. Techo ~500 alumnas; por encima, funciones SQL.
- **Búsqueda por texto**: compara en JavaScript. A miles de clases haría falta
  full-text search.
- **Filtros de nivel y duración**: en memoria, sobre la página traída.

Detalle completo en [escalabilidad.md](escalabilidad.md).

---

## 3. Servicios externos y costos

| Servicio | Para qué | Costo aproximado |
|---|---|---|
| **Supabase** (`eu-central-1`) | Base, sesiones, tiempo real, archivos | Free hasta ~200 conexiones; Pro ~25 USD/mes |
| **Vercel** (`fra1`) | La aplicación | Hobby gratis; Pro ~20 USD/mes |
| **Bunny Stream** | Video y CDN | Por uso: ~1 USD/mes de almacenamiento cada 100 GB + tráfico |
| **Stripe** | Cobros | Sin cuota fija: ~1,5% + 0,25 € por pago europeo |
| **Resend** | Correo | ❌ **Todavía no contratado** |

**Los importes son órdenes de magnitud**, no un presupuesto: hay que
confirmarlos con las tarifas del día.

> El costo real arranca casi en cero y **crece con el uso de video**, que es lo
> único que escala con las alumnas.

---

## 4. Qué hay que vigilar o renovar

### 🔴 Antes de abrir al público

- **Encender la confirmación por correo.** Está apagada a propósito, porque el
  SMTP de prueba de Supabase da 2-4 correos por hora. Hoy cualquiera puede
  registrarse con un correo que no es suyo.
- **Dominio propio y SMTP.** Bloquea la confirmación de correo, los avisos de
  clase nueva y la recuperación de contraseña en volumen.
- **Pasar Stripe a producción.** Cambiar la clave a `sk_live_` y rehacer la
  configuración del portal, que es por modo. Detalle en `SETUP.md` § 3.5.
- **Verificar el reproductor en iPhone y iPad.** Es lo único entregado sin
  medir; el equipo trabaja en Windows y no tiene Safari.

### Periódico

| Cada | Qué |
|---|---|
| Mes | `npm audit` en cero. **Nunca `npm audit fix --force`**: bajaría Next 15 a Next 9 |
| Mes | Uso de Bunny, que es lo que crece |
| Trimestre | Rotar `service_role` y las claves de Bunny |
| Al cambiar policies | `npm run test:aislamiento` |
| Al llegar a ~150 clases | Revisar la consulta de la lista de admin |
| Al llegar a ~500 alumnas | Pasar las analíticas a funciones SQL |

### Vencimientos que no avisan

- **Las claves de Bunny no vencen**, pero si se rotan hay que cambiarlas en
  Vercel **y** en `.env.local` del worker, en el mismo momento: hay una sola
  clave válida a la vez.
- **El secreto del webhook de Stripe es por endpoint y por modo.** Al pasar a
  producción es otro.
- **El proyecto viejo de Supabase** (Oregón) sigue vivo. Pausarlo, no borrarlo.

---

## 5. Qué quedó fuera de alcance, y por qué

### Envío de correos
La interfaz de consentimiento está lista y ya recoge permiso. **El envío no**,
porque falta dominio y SMTP. Se hizo en ese orden a propósito: a quien se
registró sin ver la casilla no se le puede escribir después.

### Traducción de las clases a otros idiomas
No es programación: es doblaje o subtítulos, un servicio externo por minuto. El
sistema **ya soporta** varias pistas de audio. Opciones y costos en
[para-brunela.md](para-brunela.md).

### La segunda mitad de las analíticas
Frecuencia de uso, franjas horarias, reproducciones y tiempo de uso **necesitan
historia acumulada**. La captura ya está funcionando; los números aparecen solos
en unas semanas.

### Migración del chat a Broadcast
**Decisión consciente de no hacerla.** Cambiaría una autorización robusta
—comparar UUIDs— por una frágil —parsear el nombre de un topic— para ahorrar
~40 evaluaciones de RLS, cuando el costo dominante ya se eliminó. Criterio para
reconsiderarlo en [escalabilidad.md](escalabilidad.md).

### Edición de perfil para las alumnas
El onboarding inicial está; cambiar los datos después, no. La policy y el
permiso ya están puestos, así que es sólo pantalla.

### Contenido
El sistema se entrega **con datos de demostración**, no con el catálogo real.
Ver la sección siguiente.

---

## 6. Antes de abrir: limpiar los datos de prueba

Hoy la base tiene contenido de demostración que **una alumna real vería**:

| Tabla | Filas | De prueba |
|---|---:|---:|
| Clases | 19 | **19** (`demo-*` y `prueba`) |
| Programas | 3 | **3** (`demo-*`) |
| Salas de chat | 10 | **8** (DMs de cuentas de prueba) |
| Perfiles | 9 | **4** (`*@brunela.test`) |
| Categorías | 7 | 0 — son las reales |

**Las categorías se quedan.** El resto hay que borrarlo antes de abrir, o el
estudio abre con clases que no existen.

---

## 7. Dónde está cada cosa

| Documento | Para qué |
|---|---|
| `CLAUDE.md` | Estado del proyecto y **las trampas que ya costaron caro** |
| `SETUP.md` | Puesta en marcha y **el orden de las migraciones, que no es alfabético** |
| `docs/manual-brunela.md` | Manual de uso, sin lenguaje técnico |
| `docs/escalabilidad.md` | Qué se resuelve pagando y qué no |
| `docs/fase-0-analitica.md` | Los pasos manuales de Stripe y Vercel |
| `docs/pruebas-e2e.md` | 85 pruebas de punta a punta |
| `docs/para-brunela.md` | Analíticas y traducción, para ella |
