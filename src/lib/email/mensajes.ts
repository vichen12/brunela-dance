/**
 * Los correos propios del estudio. Cada funcion devuelve { asunto, html, texto }
 * listo para `enviarCorreo()`. Ninguna envia nada ni consulta la base: reciben
 * los datos ya resueltos.
 *
 * Todavia NO estan conectadas a ningun flujo.
 */

import { plantillaCorreo, textoPlano, SITIO, type PlantillaCorreo } from "./plantilla-base";

export interface CorreoArmado {
  asunto: string;
  html: string;
  texto: string;
}

const RUTA_ESTUDIO = `${SITIO}/dashboard`;
const RUTA_PLAN = `${SITIO}/dashboard/plan`;
const RUTA_CLASES_EN_VIVO = `${SITIO}/dashboard/live`;

function armar(asunto: string, p: PlantillaCorreo): CorreoArmado {
  return { asunto, html: plantillaCorreo(p), texto: textoPlano(p) };
}

function saludo(nombre?: string | null): string {
  const limpio = nombre?.trim().split(/\s+/)[0];
  return limpio ? `Hola, ${limpio}` : "Hola";
}

function dias(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}

const MOTIVO_CUENTA = "Recibiste este correo porque tenés una cuenta en Brunela Dance.";

// ---------------------------------------------------------------------------

export function bienvenidaAlumna(datos: { nombre?: string | null; urlEstudio?: string }): CorreoArmado {
  return armar("Ya estás adentro del estudio 💗", {
    preheader: "Tu lugar en el estudio ya está listo. Te cuento por dónde empezar.",
    etiqueta: "Bienvenida",
    titulo: "Qué lindo tenerte en el estudio",
    saludo: saludo(datos.nombre),
    parrafos: [
      "Ya tenés tu lugar en Brunela Dance. Acá vas a encontrar las clases, los planes de trabajo y las sesiones en vivo, todo en un mismo lugar y a tu ritmo.",
      "Si no sabés por dónde arrancar, elegí **una clase corta** de la biblioteca y hacela hoy. Lo importante es empezar; la constancia se arma después.",
    ],
    boton: { texto: "Entrar al estudio", url: datos.urlEstudio ?? RUTA_ESTUDIO },
    nota: "¿Tenés alguna duda o una lesión que tenga que saber? Respondé este correo y lo vemos juntas.",
    motivo: "Recibiste este correo porque acabás de crear tu cuenta en Brunela Dance.",
  });
}

export function accesoGratisPorVencer(datos: {
  nombre?: string | null;
  diasRestantes: number;
  urlPlan?: string;
}): CorreoArmado {
  const n = Math.max(1, Math.round(datos.diasRestantes));
  const cuando = n === 1 ? "mañana" : `en ${dias(n)}`;
  return armar(n === 1 ? "Mañana termina tu acceso gratis" : `Te quedan ${dias(n)} de acceso gratis`, {
    preheader: `Tu acceso gratis termina ${cuando}. Elegí tu plan para seguir sin cortar.`,
    etiqueta: "Tu acceso gratis",
    titulo: n === 1 ? "Mañana termina tu acceso gratis" : `Te quedan ${dias(n)} de acceso gratis`,
    saludo: saludo(datos.nombre),
    parrafos: [
      `Tu período de prueba termina **${cuando}**. Si te viene sirviendo, elegí tu plan y seguí entrenando sin cortar el ritmo.`,
      "Tu progreso queda guardado igual: cuando vuelvas, retomás exactamente donde lo dejaste.",
    ],
    boton: { texto: "Elegir mi plan", url: datos.urlPlan ?? RUTA_PLAN },
    nota: "Podés cambiar de plan o cancelar cuando quieras desde tu cuenta, sin llamar a nadie.",
    motivo: MOTIVO_CUENTA,
  });
}

export function accesoGratisTerminado(datos: { nombre?: string | null; urlPlan?: string }): CorreoArmado {
  return armar("Terminó tu acceso gratis", {
    preheader: "Tu progreso sigue guardado. Elegí tu plan cuando quieras volver.",
    etiqueta: "Tu acceso gratis",
    titulo: "Terminó tu acceso gratis",
    saludo: saludo(datos.nombre),
    parrafos: [
      "Gracias por probar el estudio estos días. Tu período gratis ya terminó, así que por ahora las clases quedan en pausa.",
      "**Tu progreso no se pierde.** Cuando elijas tu plan, retomás exactamente donde lo dejaste.",
    ],
    boton: { texto: "Volver al estudio", url: datos.urlPlan ?? RUTA_PLAN },
    nota: "Si algo no te convenció, me encantaría saberlo: respondé este correo y contame.",
    motivo: MOTIVO_CUENTA,
  });
}

export interface DatosClaseEnVivo {
  nombre?: string | null;
  /** Titulo de la clase, tal como se ve en el estudio. */
  titulo: string;
  /** Ya formateada para la alumna: "Jueves 16 de octubre". */
  fecha: string;
  /** Ya formateada, con zona si hace falta: "19:00 (hora de Barcelona)". */
  hora: string;
  /** Pagina de la clase dentro del estudio. */
  urlClase?: string;
}

export function recordatorioClaseEnVivo(datos: DatosClaseEnVivo): CorreoArmado {
  return armar(`Hoy bailamos: ${datos.titulo}`, {
    preheader: `${datos.fecha} a las ${datos.hora}. Tené el espacio listo y el agua cerca.`,
    etiqueta: "Clase en vivo",
    titulo: "Te espero en la clase en vivo",
    saludo: saludo(datos.nombre),
    parrafos: ["Te recuerdo que tenés lugar reservado. El enlace para entrar aparece en la página de la clase un rato antes de empezar."],
    detalles: [
      { etiqueta: "Clase", valor: datos.titulo },
      { etiqueta: "Fecha", valor: datos.fecha },
      { etiqueta: "Hora", valor: datos.hora },
    ],
    boton: { texto: "Ver la clase", url: datos.urlClase ?? RUTA_CLASES_EN_VIVO },
    nota: "**Antes de empezar:** ropa cómoda, un espacio despejado y agua cerca. Si al final no podés venir, cancelá la reserva así otra persona aprovecha el lugar.",
    motivo: "Recibiste este correo porque reservaste lugar en esta clase en vivo.",
  });
}

export function invitacionAClaseEnVivo(datos: DatosClaseEnVivo): CorreoArmado {
  return armar(`Brunela te invitó a una clase en vivo: ${datos.titulo}`, {
    preheader: `Una invitación personal para ${datos.fecha} a las ${datos.hora}.`,
    etiqueta: "Invitación",
    titulo: "Tenés una invitación a una clase en vivo",
    saludo: saludo(datos.nombre),
    parrafos: [
      "Te guardé un lugar en esta clase, aunque no esté incluida en tu plan. Es una invitación personal: **solo tenés que reservar** para confirmar que venís.",
    ],
    detalles: [
      { etiqueta: "Clase", valor: datos.titulo },
      { etiqueta: "Fecha", valor: datos.fecha },
      { etiqueta: "Hora", valor: datos.hora },
    ],
    boton: { texto: "Reservar mi lugar", url: datos.urlClase ?? RUTA_CLASES_EN_VIVO },
    nota: "El enlace para entrar a la clase aparece en la misma página una vez que reservás.",
    motivo: "Recibiste este correo porque Brunela te invitó a una clase en vivo del estudio.",
  });
}
