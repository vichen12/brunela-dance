# Guion de pruebas end-to-end

**Entorno:** `https://brunela-dance.vercel.app` (producción, Fráncfort).
**Fecha del escenario:** 2026-08-03.

Ordenado por recorrido de alumna, no por módulo: si algo falla, falla en el
orden en que lo viviría ella.

Cada prueba tiene **qué hacés**, **qué tenés que ver** y **qué síntoma es un
fallo**. Ese último es el que importa: un fallo que no sabés reconocer es un
fallo que se te escapa.

---

## Cuentas

| Correo | Contraseña | Tier | Para qué |
|---|---|---|---|
| `sin-plan@brunela.test` | `PruebaSinPlan!2026` | none | vitrina y muros |
| `corps@brunela.test` | `PruebaCorps!2026` | corps_de_ballet | el escalón más bajo |
| `solista@brunela.test` | `PruebaSolista!2026` | solista | el escalón del medio |
| `principal@brunela.test` | `PruebaPrincipal!2026` | principal | acceso total |
| `brunela.sssdance@gmail.com` | *(la tuya)* | solista | **suscripción real**: portal y cancelación |
| `brunela.dance@gmail.com` | *(Google)* | admin + dueña | panel de administración |

Las cuatro `@brunela.test` tienen el onboarding marcado como hecho a propósito:
sirven para probar **acceso por plan**, no el alta. El alta se prueba aparte
(§ 1) creando una cuenta nueva.

---

## 🔴 Lo que NO se puede probar con este escenario

Leelo antes de empezar, así no perseguís fantasmas.

| No se puede | Por qué |
|---|---|
| **Reproducir las 18 clases demo** | No tienen `bunny_video_id`. La única que reproduce es **`prueba`** (tier corps_de_ballet) |
| **Cambio de idioma en el reproductor** | `prueba` tiene **0 pistas de audio**. Que no aparezcan los botones ES/EN/FR/IT **es lo correcto**, no un fallo |
| **Progreso en las clases demo** | El progreso lo genera el reproductor. Sólo se puede probar con `prueba` |
| **Canales de comunidad** | Hay **0 salas**. Se crean en § 6.1 y recién ahí se prueban mute, ban y canales por categoría |
| **Cobro real** | Stripe está en modo test. Tarjeta `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC |
| **iPhone / iPad** | Sigue pendiente y sin medir. Ver `CLAUDE.md` |

---

## 0 · Antes de empezar

- [ ] **0.1** Abrí `https://brunela-dance.vercel.app` sin sesión.
      **Ver:** la landing, con la sección de video mostrando la portada.
      **Fallo:** un 404 de `/videos/brunela-trailer.mp4` en la consola (si el
      tráiler todavía no se subió, es esperado y no bloquea nada).

- [ ] **0.2** En la consola del navegador, pestaña Red, mirá que no haya
      errores en rojo al cargar.
      **Fallo:** errores de `<polygon>` — serían los sparklines, que se
      arreglaron; si vuelven, algo se revirtió.

---

## 1 · El alta: de la landing al pago

Esta sección se hace **con una cuenta nueva** (usá un correo cualquiera que no
exista, ej. `prueba1@brunela.test`).

- [ ] **1.1 El plan viaja desde la landing.**
      Bajá a los planes, tocá **Solista**.
      **Ver:** la URL es `/registro?plan=solista&interval=monthly`, y la
      pantalla muestra un recuadro **"Plan elegido · Solista · 31 €/mes"**.
      **Fallo:** que caigas en `/sign-in`, o que el recuadro no aparezca — el
      plan se perdió y todo el recorrido posterior es inválido.

- [ ] **1.2 El intervalo también viaja.**
      Volvé a la landing, poné el interruptor en **Anual** y tocá Solista.
      **Ver:** `interval=yearly` en la URL, y el recuadro dice **299 €/año**.
      **Fallo:** que diga el precio mensual con `interval=yearly`, o al revés.

- [ ] **1.3 Alta con correo y contraseña.**
      Completá nombre, correo y una contraseña de 8+ caracteres.
      **Ver:** pasás directo al onboarding. Sin pantalla intermedia.
      **Fallo:** un cartel de "Te mandamos un correo para confirmar" — significa
      que **"Confirm email" se volvió a encender** en Supabase. El flujo
      continuo depende de que esté apagado.

- [ ] **1.4 Validaciones.**
      Probá contraseña de 5 caracteres, y después un correo ya registrado.
      **Ver:** vuelve al formulario con el mensaje, **conservando el plan
      elegido y el correo tipeado**.
      **Fallo:** que se pierda el plan al fallar la validación.

- [ ] **1.5 El onboarding.**
      Elegí un nivel y dos o tres objetivos.
      **Ver:** el título te saluda por tu nombre. El botón dice
      **"Continuar al pago"** (porque venís con plan).
      **Fallo:** que diga "Entrar al estudio" — perdió el plan.

- [ ] **1.6 Sin objetivos.**
      Destildá todos los objetivos y mandá.
      **Ver:** "Elegí al menos un objetivo."
      **Fallo:** que te deje pasar con cero.

- [ ] **1.7 El checkout arranca solo.**
      **Ver:** caés en `/dashboard/plan` y **te lleva a Stripe sin que toques
      nada**, con Solista y el intervalo que elegiste.
      **Fallo:** que te muestre los tres planes para elegir de nuevo.

- [ ] **1.8 Pagá** con `4242 4242 4242 4242`.
      **Ver:** volvés a `https://brunela-dance.vercel.app/dashboard/plan` con
      un cartel de éxito.
      **🔴 Fallo grave:** que te mande a `localhost:3000`. Significa que
      `NEXT_PUBLIC_APP_URL` en Vercel está mal.

- [ ] **1.9 El webhook llegó.**
      **Ver:** en `/dashboard/plan`, tu plan figura como **Solista**, y la
      biblioteca ya te muestra clases.
      **🔴 Fallo grave:** que sigas en "sin plan" después de pagar. Es el
      webhook: revisá en Stripe → Developers → Webhooks que el endpoint
      responda **200**.

- [ ] **1.10 La compuerta del onboarding.**
      Con esa misma cuenta, andá a mano a `/dashboard`.
      **Ver:** entrás normal (ya lo completaste).
      **Fallo:** que te devuelva al onboarding en loop.

---

## 2 · Acceso por plan — **la más importante**

Los números son exactos. Contá.

| Cuenta | Clases | Programas | En vivo |
|---|---|---|---|
| `sin-plan@brunela.test` | **0** (vitrina con candado) | 0 | 0 |
| `corps@brunela.test` | **8** | 2 | 1 |
| `solista@brunela.test` | **16** | 3 | 2 |
| `principal@brunela.test` | **19** | 3 | 3 |

> Son 19 y no 18 porque además de las 18 demo está `prueba`, la que subiste vos.

- [ ] **2.1** Entrá con cada una de las cuatro y contá las tarjetas en
      `/dashboard/library`, `/dashboard/programs` y `/dashboard/live`.
      **Fallo:** cualquier número distinto. **Si una cuenta ve de más, hay una
      fuga de contenido pago** — es el fallo más caro de todos.

- [ ] **2.2 El muro por URL directa.**
      Con `corps@brunela.test`, entrá a mano a
      `/dashboard/library/demo-pbt-nivel-2` (es de tier principal).
      **Ver:** no podés verla.
      **🔴 Fallo grave:** que se abra la ficha. La UI oculta, pero **RLS es lo
      que tiene que frenar**; si pasa, el candado es decorativo.

- [ ] **2.3** Repetí con `/dashboard/library/demo-centro-adagio` (solista)
      desde la cuenta corps.

---

## 3 · La vitrina (tier none)

- [ ] **3.1** Entrá con `sin-plan@brunela.test` a `/dashboard/library`.
      **Ver:** las clases **con candado** y la etiqueta del plan que las
      habilita. No una pantalla vacía.
      **Fallo:** biblioteca vacía sin explicación — la vitrina no se activó.

- [ ] **3.2 El candado no es decorativo.**
      Tocá cualquier tarjeta.
      **Ver:** te lleva a `/dashboard/plan`, no a la ficha de la clase.
      **Fallo:** que abra la ficha.

- [ ] **3.3 🔴 No se puede sacar la URL del video.**
      Con el inspector, mirá el HTML de una tarjeta de la vitrina.
      **Ver:** ni `bunny_video_id`, ni `stream_playback_id`, ni ninguna URL de
      `b-cdn.net`.
      **🔴 Fallo grave:** encontrar cualquiera de esos. Sería saltarse el pago.

---

## 4 · Reproducción y progreso

Sólo con la clase **`prueba`** (tier corps_de_ballet), así que sirve con
`corps@`, `solista@` o `principal@`.

- [ ] **4.1** Abrí `prueba` y dale play.
      **Ver:** reproduce y sigue más allá del primer minuto.
      **Fallo:** pantalla negra, spinner eterno, o "No se pudo cargar el video".
      Serían 403 en los segmentos: mirá la pestaña Red buscando `b-cdn.net`.

- [ ] **4.2 Idiomas.**
      **Ver:** **no aparecen** botones de idioma.
      **Esto es correcto**: esa clase tiene 0 pistas de audio.

- [ ] **4.3 El progreso se guarda.**
      Mirá 30-40 segundos, volvé a `/dashboard/library`.
      **Ver:** la tarjeta muestra una barra de progreso con un porcentaje.
      **Fallo:** que quede en 0%.

- [ ] **4.4 Y se retoma.**
      Volvé a abrirla.
      **Ver:** arranca donde la dejaste, no desde cero.

- [ ] **4.5 "Seguir viendo".**
      Mirá el menú lateral.
      **Ver:** el botón principal dice **"Seguir viendo"** y lleva a `prueba`.
      **Fallo:** que diga "Explorar clases" habiendo progreso a medias.

---

## 5 · Chat con la profesora

- [ ] **5.1** Con `solista@brunela.test`, andá a `/dashboard/chat`.
      **Ver:** el chat con **Brunela** — su nombre, no un correo ni "Usuario".
      **🔴 Fallo:** que aparezca el correo de Brunela. Nunca tiene que
      renderizarse.
      **Fallo:** "Cargando chat..." para siempre — sería `get_studio_admin()`.

- [ ] **5.2** Mandá un mensaje.
      **Ver:** aparece a la derecha, en una burbuja coral.

- [ ] **5.3 Tiempo real.**
      Abrí el chat en dos navegadores (uno como alumna, otro como Brunela) y
      escribí de un lado.
      **Ver:** llega del otro **sin recargar**.
      **🔴 Fallo:** que se guarde pero no aparezca hasta recargar. Sería
      `chat_messages` fuera de la publicación `supabase_realtime`.

- [ ] **5.4 Gate por plan.**
      Entrá con `sin-plan@brunela.test` a `/dashboard/chat`.
      **Ver:** lo que corresponda según el ajuste de DM por plan de
      `/admin/chat`. Coherente con esa configuración, sea cual sea.

---

## 6 · Comunidad y moderación

- [ ] **6.1 Crear los canales.**
      Como Brunela, en `/admin/chat`, creá:
      un canal **comunidad** (sin restricción) y uno **exclusivo** de tier
      solista. Y con el otro botón, canales por categoría.
      **Ver:** aparecen listados.

- [ ] **6.2 Quién ve qué.**
      Con `corps@` y con `solista@`, entrá a `/dashboard/community`.
      **Ver:** corps ve el de comunidad pero **no** el exclusivo de solista.
      **🔴 Fallo:** que corps vea el exclusivo.

- [ ] **6.3 El texto honesto.**
      Con `sin-plan@brunela.test`, si no le corresponde ningún canal.
      **Ver:** "Todavía no hay canales abiertos para tu plan."
      **Fallo:** que diga "estará disponible pronto" — es el texto viejo, que
      mentía sobre la causa.

- [ ] **6.4 Borrar mensaje.**
      Como Brunela, pasá el mouse sobre un mensaje de una alumna → **eliminar**.
      **Ver:** desaparece del canal.

- [ ] **6.5 Mutear.**
      **eliminar / mutear / banear** en el mensaje → **mutear**, 1 hora.
      **Ver:** el modal dice "Mutear a …", se aplica y cierra.

- [ ] **6.6 🔴 Banear** — es nuevo y va por server action.
      Lo mismo → **banear**.
      **Ver:** el modal dice "Banear a …", el botón es rojo y dice "Confirmar
      baneo". Se aplica y cierra.
      **Fallo:** un cartel "No se pudo aplicar: permission denied for table
      chat_bans" — sería que la action no está usando service_role.

- [ ] **6.7 La moderación no se le ofrece a una alumna.**
      Con `solista@`, pasá el mouse sobre un mensaje ajeno.
      **Ver:** no aparece ni eliminar, ni mutear, ni banear.

---

## 7 · Programas y sesiones en vivo

- [ ] **7.1** Con `solista@`, entrá a `/dashboard/programs`.
      **Ver:** 3 programas, cada uno con su nivel, sus días y el foco.
      **Fallo:** que el foco o el nivel salgan vacíos.

- [ ] **7.2** Abrí **Fundamentos en 7 días**.
      **Ver:** los 7 días, cada uno con su clase.

- [ ] **7.3 Reservar.**
      En `/dashboard/live`, reservá **Barra abierta en vivo**.
      **Ver:** queda como reservada y baja el cupo.

- [ ] **7.4 Cancelar.**
      **Ver:** vuelve a estar disponible y el cupo se recupera.

- [ ] **7.5 El muro del vivo.**
      Con `corps@`, mirá **Taller de puntas** (principal).
      **Ver:** no aparece en su lista.

---

## 8 · Suscripción: portal y cancelación

Con **`brunela.sssdance@gmail.com`**, la única con suscripción real.

- [ ] **8.1** En `/dashboard/plan`, **Gestionar plan**.
      **Ver:** abre el portal de Stripe.
      **Fallo:** "No tenés una suscripción activa" — no encontró el
      `provider_customer_id`.

- [ ] **8.2 Cambio de plan.**
      **Ver:** en el portal aparecen los **3 productos con sus 2 intervalos**.
      **Fallo:** que no se pueda cambiar de plan. Sería la configuración del
      portal, que **es por modo** y arranca vacía.

- [ ] **8.3 Cancelar** al final del período.
      **Ver:** vuelve a la app y figura como "se cancela el …".
      **Fallo:** que pierda el acceso **al instante**. Tiene que conservarlo
      hasta que termine el período pago.

---

## 9 · Panel de administración

Con `brunela.dance@gmail.com`.

- [ ] **9.1 Encabezados.** *(§ 11.3 cubre `/admin/settings`, que cambió por
      completo: ya no es un editor de JSON.)*
      Recorré `/admin`, `/admin/videos`, `/admin/programs`, `/admin/live`,
      `/admin/users`, `/admin/chat`, `/admin/categories`, `/admin/documents`,
      `/admin/announcements`, `/admin/settings`.
      **Ver:** las 10 con su título.
      **Fallo:** alguna que arranque directo en contenido.

- [ ] **9.2 Sparklines.**
      En `/admin`, consola abierta.
      **Ver:** los gráficos dibujados y **cero errores** de `<polygon>`.

- [ ] **9.3 🔴 El botón ELIMINAR elimina.**
      En `/admin/videos`, abrí una clase demo descartable y dale **ELIMINAR**.
      **Ver:** desaparece del listado.
      **🔴 Fallo:** que **guarde** en vez de borrar. Era el bug de los
      formularios anidados; si volvió, se revirtió el arreglo.
      *(Hacelo con una demo, no con `prueba`.)*

- [ ] **9.4** Lo mismo en `/admin/live` con una sesión demo.

- [ ] **9.5 Cambiar el tier de una alumna.**
      En `/admin/users`, subí `corps@brunela.test` a principal.
      **Ver:** entrando con esa cuenta, ahora ve 19 clases.
      **🔴 Fallo:** que el cambio no se aplique. Sería el trigger
      `protect_profile_admin_fields` sin la guarda `auth.uid() is not null`.
      *(Volvela a corps al terminar.)*

- [ ] **9.6 Subir una clase.**
      En `/admin/videos`, subí un video corto con al menos **dos** pistas de
      audio en idiomas distintos.
      **Ver:** sube, queda en cola de mux.
      **Nota:** el worker **no está corriendo**, así que va a quedar pendiente.
      Eso es esperado, no un fallo.

- [ ] **9.7 Vista de alumna.**
      Desde el panel, **Vista alumna ↗**.
      **Ver:** el área de miembro con acceso completo (Brunela es admin).

---

## 10 · Móvil

Desde el teléfono, o con el emulador del navegador.

- [ ] **10.1** Entrá a `/dashboard`.
      **Ver:** barra inferior con **Inicio, Clases, Mi chat, Comunidad** y un
      botón **Menú**.

- [ ] **10.2** Tocá **Menú**.
      **Ver:** una hoja con **los 8 destinos** y, si sos admin, Backstage.
      **Fallo:** que falten Programas, En vivo o Documentos.

- [ ] **10.3** Tocá un destino.
      **Ver:** navega y la hoja se cierra sola.

---

## 11 · Panel de admin, lo nuevo (2026-08-03)

Todo esto se hizo **después** de escribir las secciones 1-10, así que no está
cubierto arriba. Se prueba con `brunela.dance@gmail.com`.

> **Requisito:** la migración `20260803_studio_documents_bucket.sql` tiene que
> estar corrida. Verificación: `storage.buckets` tiene `studio-documents` con
> `public = false`, y las policies de `storage` son **2**.

### 11.1 · Subir un documento

- [ ] **11.1.1** En `/admin/documents`, tocá **Elegir archivo** y subí un PDF.
      **Ver:** barra de progreso y después `✓ nombre.pdf — PDF · 340 KB`.
      **Fallo:** que no pase nada al tocar el botón, o un error de Storage —
      sería que la migración no está corrida.

- [ ] **11.1.2** Completá título y **Plan que lo puede ver: Solista**, y guardá.
      **Ver:** aparece en la lista.
      **Fallo:** que pida una URL — sería la pantalla vieja.

- [ ] **11.1.3 El tipo y el peso salen del archivo.**
      **Ver:** no hay campos para tipearlos. En la lista figuran los correctos.
      **Fallo:** que muestre "pdf · 0 KB" con un archivo que pesa.

- [ ] **11.1.4 🔴 Que la alumna del plan correcto lo pueda abrir.**
      Con `solista@brunela.test`, entrá a `/dashboard/documents` y abrilo.
      **Ver:** el archivo se descarga o se abre.
      **Fallo:** un error de permiso o un enlace roto — sería que la firma de
      descarga no se está generando.

- [ ] **11.1.5 🔴 Que la de plan menor NO lo vea.**
      Con `corps@brunela.test`, mirá `/dashboard/documents`.
      **Ver:** ese documento no aparece.
      **🔴 Fallo grave:** que aparezca.

- [ ] **11.1.6 🔴 La URL firmada no es un pase libre.**
      Copiá el enlace de descarga que ves como solista y abrilo **en una ventana
      de incógnito, sin sesión**.
      **Ver:** funciona (la firma es válida un rato) — **eso es correcto y
      esperado**. Lo que importa es que sea temporal.
      **🔴 Fallo grave:** que la URL sea del tipo
      `.../storage/v1/object/public/...` sin firma. Sería un bucket público, y
      cualquiera con el enlace tendría el documento para siempre.

- [ ] **11.1.7 El archivo grande se rechaza.**
      Probá con uno de más de 50 MB.
      **Ver:** `"nombre" pesa 62.4 MB y el máximo es 50 MB.` **antes** de subir
      nada.

### 11.2 · Selector de clases en programas

- [ ] **11.2.1** En `/admin/programs`, abrí un programa y mirá el alta de día.
      **Ver:** un desplegable **"Clase de ese día"** con los **títulos** de las
      clases, ordenados alfabéticamente.
      **Fallo:** un campo de texto donde haya que escribir — sería la pantalla
      vieja.

- [ ] **11.2.2** Agregá un día eligiendo una clase.
      **Ver:** aparece en la lista como `Día 8 — Barra de suelo I`.
      **Fallo:** que diga `Día 8 — demo-barra-suelo-i`.

- [ ] **11.2.3** Mirá los días que ya existían.
      **Ver:** todos con título, ninguno con slug.

### 11.3 · Ajustes acotados

- [ ] **11.3.1** Entrá a `/admin/settings`.
      **Ver:** dos bloques con interruptores (**Reservas** y **Quién puede
      escribirte**) y un bloque gris de **Ajustes técnicos**.
      **🔴 Fallo:** un `<textarea>` con JSON — sería la pantalla vieja, y
      Brunela estaría a un tipeo de romper el cobro.

- [ ] **11.3.2** Cambiá **"Lista de espera cuando se llena"** y guardá.
      **Ver:** cartel de éxito y el interruptor queda como lo dejaste al
      recargar.
      **Fallo:** que vuelva al valor anterior — sería el caché de ajustes sin
      invalidar.

- [ ] **11.3.3** En **Quién puede escribirte**, activá sólo Solista y Principal.
      **Ver:** se guarda. Y con `corps@brunela.test`, `/dashboard/chat` refleja
      esa restricción.

- [ ] **11.3.4 🔴 Los ajustes peligrosos no se pueden editar.**
      Mirá el bloque **Ajustes técnicos**.
      **Ver:** *Planes y precios*, *Reglas de acceso*, *Acceso al contenido*,
      *Logros y constancia* e *Idiomas* — con nombres en castellano, **sin
      ningún campo editable**, y el texto de que lo cambia el equipo técnico.
      **🔴 Fallo:** cualquier campo que se pueda escribir ahí.

- [ ] **11.3.5** Nada en inglés.
      **Ver:** no aparece *"Per-tier toggle for who can START a direct chat…"*.

### 11.4 · Hora con zona

- [ ] **11.4.1** En `/admin/live`, mirá una sesión.
      **Ver:** `mié, 6 ago, 05:00 (Madrid) · 00:00 (Buenos Aires)` — **la del
      estudio primero**, que es la que Brunela programó.
      **Fallo:** una hora sola sin zona.

- [ ] **11.4.2** Con `solista@brunela.test`, mirá la misma sesión en
      `/dashboard/live`.
      **Ver:** la misma información pero **con tu zona primero**.

- [ ] **11.4.3 No hay parpadeo con hora equivocada.**
      Recargá con la consola abierta y mirá el instante inicial.
      **Ver:** un espacio vacío que se completa. Nunca una hora que cambie
      delante tuyo.
      **Fallo:** ver una hora y que salte a otra — sería un render de servidor
      con la zona equivocada.

- [ ] **11.4.4** Cambiá la zona de tu sistema operativo y recargá.
      **Ver:** la hora secundaria acompaña el cambio; la de Madrid no se mueve.

### 11.5 · Restos de Mux

- [ ] **11.5.1** En `/admin/videos`, abrí una clase para editar.
      **Ver:** **no** hay campos *Mux Playback ID* ni *Mux Asset ID*.

- [ ] **11.5.2** Mirá la lista de clases.
      **Ver:** la que tiene video dice **"Video listo"**, no *"Mux OK"*.

- [ ] **11.5.3 La dirección de la clase se ve pero no se toca.**
      **Ver:** el campo con el slug, en gris y no editable.
      **Fallo:** que se pueda escribir — cambiarlo rompe enlaces compartidos.

- [ ] **11.5.4 Una sola forma de crear una clase.**
      **Ver:** *Nuevo video* abre **sólo** el flujo con selector de archivo. El
      formulario de abajo aparece únicamente al editar una existente.

- [ ] **11.5.5 🔴 Lo que muxea sigue vivo.**
      Subí una clase con dos pistas de audio.
      **Ver:** aparece el estado *"Idiomas en cola"*.
      **🔴 Fallo:** que no aparezca — significaría que se limpió de más y se
      rompió el multi-idioma. *(El worker no está corriendo, así que va a quedar
      en cola: eso es esperado.)*

### 11.6 · Lenguaje

- [ ] **11.6.1** Recorré las 10 pantallas del panel.
      **Ver:** ni *Slug*, ni *Tier*, ni *Cover Image URL*, ni *Thumbnail URL*,
      ni *(coma separada)*.

- [ ] **11.6.2 La duración está en minutos.**
      Al editar una clase, mirá el campo **Duración (minutos)**.
      **🔴 Fallo grave:** que diga minutos y muestre `2700`. Sería que la
      etiqueta cambió pero no la conversión, y una clase de 45 minutos se
      guardaría como 45 segundos.
      **Ver:** para una clase de 45 minutos tiene que decir **45**. Cambialo a
      50, guardá, y confirmá que la lista muestra `50 min`.

- [ ] **11.6.3 Los conteos coinciden.**
      Compará el número de alumnas en `/admin` con el de `/admin/users`.
      **Ver:** el mismo número, y en `/admin/users` la etiqueta dice **Alumnas**
      (no cuenta a las 3 admin).

---

## Al terminar

- [ ] Borrar las cuentas `@brunela.test` y las que hayas creado en § 1.
- [ ] Borrar `brunela.sssdance@gmail.com` **y cancelar su suscripción en
      Stripe**, que no se va sola al borrar el perfil.
- [ ] Limpiar el contenido demo: el bloque final de `scripts/seed-demo.sql`.
- [ ] Borrar los documentos de prueba subidos en § 11.1 (borran también el
      archivo del bucket).
- [ ] Anotar en `CLAUDE.md` lo que haya quedado fallando.
