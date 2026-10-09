/**
 * Los planes como se le muestran a la alumna: nombre, frase y lo que incluye.
 *
 * El IMPORTE no esta aca: sale del catalogo (site_settings ->
 * subscriptions.catalog), que es lo que Brunela edita en /admin/precios. Lo de
 * abajo es texto de venta, el mismo que usaba /dashboard/plan; ahora lo leen
 * esa pantalla y el paso del plan del onboarding, para que no digan cosas
 * distintas.
 *
 * Sin "use client" ni nada de servidor: lo importan los dos lados.
 */

export type PlanPago = "corps_de_ballet" | "solista" | "principal";
export type Intervalo = "monthly" | "yearly";

export const PLANES_ORDEN: PlanPago[] = ["corps_de_ballet", "solista", "principal"];

export const PLAN_TEXTOS: Record<PlanPago, { nombre: string; desc: string; incluye: string[] }> = {
  corps_de_ballet: {
    nombre: "Corps de Ballet",
    desc: "Acceso a todo lo básico que necesitás.",
    incluye: ["Biblioteca completa", "Filtros por nivel y foco", "Progreso guardado", "7 días de prueba gratuita"],
  },
  solista: {
    nombre: "Solista",
    desc: "Planes de trabajo guiados, con progreso estructurado.",
    incluye: ["Todo Corps de Ballet", "Planes de trabajo día por día", "Mayor profundidad técnica", "Objetivos por semana"],
  },
  principal: {
    nombre: "Principal",
    desc: "La experiencia completa con clases en vivo.",
    incluye: ["Todo Solista", "2 clases en vivo al mes", "Acompañamiento personalizado", "Chat directo con Brunela"],
  },
};

/** "16€", "9,90€": centimos solo cuando los hay. */
export function formatEur(amount: number) {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `${amount.toLocaleString("es-ES", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}€`;
}

type CatalogoMinimo = {
  trial_days?: number | null;
  tiers: { tier: PlanPago; display_order: number; amount_monthly: number; amount_yearly: number }[];
} | null;

export type TarjetaPlan = {
  tier: PlanPago;
  nombre: string;
  desc: string;
  incluye: string[];
  mensual: string;
  anual: string;
  /** "12,8€" por mes facturado al año, o null si no hay precio anual. */
  anualPorMes: string | null;
  /** % que se ahorra pagando al año (0 si no hay). */
  ahorro: number;
};

/**
 * Catalogo -> tarjetas, en el orden del catalogo. Un plan del catalogo sin
 * texto conocido se descarta (no se muestra un slug crudo), y uno sin importe
 * tambien: una tarjeta de 0€ que despues cobra es peor que no mostrarla.
 */
export function tarjetasDePlanes(catalogo: CatalogoMinimo): TarjetaPlan[] {
  if (!catalogo) return [];
  return [...catalogo.tiers]
    .filter((t) => PLAN_TEXTOS[t.tier] && t.amount_monthly > 0)
    .sort((a, b) => a.display_order - b.display_order)
    .map((t) => {
      const textos = PLAN_TEXTOS[t.tier];
      const anualOk = t.amount_yearly > 0;
      return {
        tier: t.tier,
        nombre: textos.nombre,
        desc: textos.desc,
        incluye: textos.incluye,
        mensual: formatEur(t.amount_monthly),
        anual: anualOk ? formatEur(t.amount_yearly) : formatEur(t.amount_monthly * 12),
        anualPorMes: anualOk ? formatEur(Math.round((t.amount_yearly / 12) * 10) / 10) : null,
        ahorro: anualOk ? Math.max(0, Math.round(((t.amount_monthly * 12 - t.amount_yearly) / (t.amount_monthly * 12)) * 100)) : 0,
      };
    });
}

/** Los dias de prueba del catalogo (7 si no dice). */
export function diasDePrueba(catalogo: CatalogoMinimo): number {
  const d = catalogo?.trial_days;
  return typeof d === "number" && d >= 0 ? d : 7;
}

/** El plan preseleccionado: el que venia eligiendo, si existe; si no, Solista. */
export function planInicial(pedido: string | null | undefined, tarjetas: TarjetaPlan[]): PlanPago | null {
  if (tarjetas.length === 0) return null;
  const encontrado = tarjetas.find((t) => t.tier === pedido);
  if (encontrado) return encontrado.tier;
  return tarjetas.find((t) => t.tier === "solista")?.tier ?? tarjetas[0].tier;
}

export function intervaloInicial(pedido: string | null | undefined): Intervalo {
  return pedido === "yearly" ? "yearly" : "monthly";
}
