import { EditorPlan } from "@/components/editor-plan";
import { requireAdmin } from "@/src/features/auth/guards";
import { cargarClasesElegibles, hayColumnasDeDescanso } from "@/src/features/admin/editor-plan-datos";
import { ajustarCantidad } from "@/src/features/studio/dias-de-plan";

export const dynamic = "force-dynamic";

/**
 * Crear un plan de trabajo CON sus dias, de una vez (pedido de Brunela: «cuando
 * diga crear el plan, ya lo pueda crear con todos los días»). Arranca con 7
 * dias vacios; la duracion se cambia y los casilleros siguen.
 */
export default async function NuevoPlanPage() {
  await requireAdmin();
  const [clases, descansoDisponible] = await Promise.all([cargarClasesElegibles(), hayColumnasDeDescanso()]);

  return (
    <EditorPlan
      plan={null}
      casillerosIniciales={ajustarCantidad([], 7)}
      clases={clases}
      descansoDisponible={descansoDisponible}
    />
  );
}
