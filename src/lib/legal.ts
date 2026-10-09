/**
 * Datos del titular del sitio, para las paginas legales.
 *
 * ⚠️ EN UN SOLO SITIO A PROPOSITO. Los usan el aviso legal, la privacidad, las
 *    cookies, las condiciones y el formulario de desistimiento. Si cambia el
 *    domicilio o el estudio pasa a ser una sociedad, se cambia aca y nada mas.
 *
 * Brunela factura como persona fisica (autonoma): por eso hay NIE y no CIF ni
 * datos de Registro Mercantil, que el art. 10 de la LSSI solo pide a quien
 * esta inscrito.
 */
export const TITULAR = {
  nombre: "Brunela Constanza Dallape Guerrero",
  nie: "Z0727809W",
  domicilio: "Avinguda de Madrid 72, 2º 5ª, 08227 Terrassa (Barcelona), España",
  correo: "info@bruneladance.com",
  marca: "Brunela Dance Trainer",
  web: "https://bruneladance.com",
} as const;

/** Fecha de la ultima revision de los textos. Se muestra en cada pagina. */
export const LEGAL_ACTUALIZADO = "9 de octubre de 2026";

export const PAGINAS_LEGALES = [
  { href: "/legal/aviso-legal", titulo: "Aviso legal" },
  { href: "/legal/privacidad", titulo: "Política de privacidad" },
  { href: "/legal/cookies", titulo: "Política de cookies" },
  { href: "/legal/condiciones", titulo: "Condiciones de contratación" },
] as const;
