# Sobre las estadísticas y la traducción

Hola Brunela. Esto responde a tres cosas de tu lista: **cuándo vas a poder ver
las estadísticas**, **dónde están los ingresos** y **qué opciones hay para
traducir las clases al inglés**.

Está escrito para leerlo de corrido, sin nada técnico.

---

## Lo más importante en tres líneas

- Pediste **17 estadísticas**. Nueve se pueden hacer ya. Las otras ocho necesitan
  que pase tiempo, no que trabajemos más.
- **Los ingresos ya los tenés**, en Stripe, mejor de lo que los tendrías en la
  página.
- Traducir al inglés **no es programación**: es un servicio que se paga por
  minuto de video.

---

## Las estadísticas: por qué no todas salen el primer día

Hay una diferencia que vale la pena entender, porque explica todo lo demás.

Hoy el sistema guarda **dónde quedó cada alumna en cada clase**, para que pueda
retomar donde la dejó. Eso funciona perfecto. Pero se guarda como una foto del
momento: cada vez que vuelve, la foto nueva **tapa** la anterior.

> Si una alumna mira una clase el lunes, el miércoles y el viernes, en el sistema
> queda anotado el viernes. El lunes y el miércoles no quedaron guardados en
> ningún lado.

Por eso preguntas como *"¿cuántas veces por semana entrena?"* o *"¿a qué hora se
conectan?"* hoy no se pueden contestar. No es que estén difíciles: **la
información no se está guardando**.

**Eso ya está arreglado.** Acabamos de agregar un cuaderno aparte que anota cada
sesión sin borrar la anterior. Desde que se active, empieza a acumular.

Lo que eso significa para vos: **las estadísticas de hábitos van a empezar a
tener sentido más o menos un mes después de que entren las primeras alumnas.**
No porque falte trabajo, sino porque una estadística de frecuencia semanal
necesita varias semanas para existir.

### Las que vas a tener desde el primer día

- Cuántas alumnas hay y cómo se reparten por plan
- Cuántas se dan de baja (y cuándo)
- Cuántas de las que se registran terminan pagando
- Qué clases se empiezan y cuáles no las toca nadie
- Qué programas se terminan y en qué día los abandonan
- Quién lleva mucho tiempo sin entrar
- El nivel y los objetivos de cada alumna
- La ficha individual de cada una
- Todo eso exportable a Excel

### Las que necesitan que pase tiempo

- Cada cuánto entrena cada alumna
- Cuánto tiempo pasa en el estudio
- A qué horas y qué días se conectan más
- Cuántas veces se vio cada clase
- Cuánto se ve de cada clase en promedio
- Cuántas visitas recibe la página y desde qué países

Estas dos últimas empiezan a contarse ahora mismo, apenas se active.

### Mi recomendación

**No construir el panel de estadísticas todavía.** Hoy no hay clases publicadas
ni alumnas: cualquier pantalla que hagamos ahora estaría llena de ceros, y la
diseñaríamos adivinando qué te va a interesar mirar.

Lo que sí es urgente es **empezar a guardar**, que ya está hecho. Guardar hoy,
mirar cuando haya algo que ver. Es la diferencia entre esperar un mes y perder
ese mes para siempre.

---

## Los ingresos: ya los tenés, y están mejor ahí

Pediste ingresos totales, por plan y su evolución mensual.

**Todo eso ya existe en Stripe**, que es donde se cobran los pagos. Entrás a
`dashboard.stripe.com` y en la pantalla principal está: cuánto entró este mes,
cómo viene comparado con el anterior, y cuántas alumnas se dieron de baja.

No lo vamos a copiar dentro de la página, y quiero explicarte por qué.

Stripe conoce cosas que la página no: los impuestos, los reembolsos, un pago que
falló y se reintentó, un descuento que aplicaste. Si armáramos nuestro propio
cálculo, **los dos números no van a coincidir** — y el día que no coincidan, la
pregunta deja de ser *"¿cuánto facturé?"* para pasar a ser *"¿cuál de los dos me
está mintiendo?"*.

Lo que sí vamos a poner en tu panel es lo que Stripe **no** puede saber: qué
clases se usan, quién dejó de entrenar, qué programas se terminan.

**Cada herramienta contesta lo suyo.** Stripe: la plata. Tu panel: las alumnas.

---

## Traducir las clases al inglés

Esto no es programación: es un servicio externo que **se cobra por minuto de
video**. Hay dos caminos.

### Doblaje — una voz en inglés encima de tu clase

Aproximadamente **entre 0,50 y 3 dólares por minuto**, según si es voz generada
por computadora o una persona real.

### Subtítulos — tu voz, con texto abajo

Bastante más barato, alrededor de **0,05 a 0,30 dólares por minuto**.

### Para que te des una idea

Con **20 clases de 40 minutos** (800 minutos en total):

| | Costo aproximado |
|---|---|
| Doblaje | 400 a 2.400 dólares |
| Subtítulos | 40 a 240 dólares |

Son órdenes de magnitud para decidir, no un presupuesto. Hay que pedir cotización
con el material real.

### Cuál te recomiendo, y por qué te va a sorprender

**Doblaje**, aunque sea la cara.

En casi cualquier video, los subtítulos son la opción sensata. Acá no, y el
motivo es de tu producto: **en una clase de pilates la alumna está mirándose el
cuerpo o tiene la vista en el piso.** No puede estar leyendo la pantalla. Los
subtítulos servirían para entender de qué va la clase, pero no para *seguirla*,
que es exactamente para lo que existe.

Además el sistema ya está preparado para el doblaje. Las clases ya se pueden
publicar con varias pistas de audio y la alumna elige el idioma con un botón. Una
voz en inglés entra por ahí sin tocar nada. Los subtítulos, en cambio,
necesitarían construir algo que hoy no existe.

### Una advertencia importante

En una clase guiada, **tu voz marca el ritmo del movimiento**. Si el doblaje
queda medio segundo corrido, no es un detalle estético: es una indicación llegando
tarde.

Por eso: **traducir UNA clase primero, escucharla completa, y recién ahí decidir
si seguimos.** Es la diferencia entre gastar en una clase o en veinte.

### Y cuándo hacerlo

**Después de tener el catálogo armado.** Como se paga por minuto, traducir clases
que después se reemplacen es pagar dos veces por lo mismo.

---

## Lo que te toca decidir

1. **Traducción**: ¿arrancamos probando con una sola clase para escuchar cómo
   queda?
2. **Estadísticas**: ¿te sirve esperar a tener alumnas reales para diseñar el
   panel juntas, mirando lo que de verdad querés saber?

Mientras tanto, el sistema ya está guardando todo para que ese día no arranquemos
de cero.
