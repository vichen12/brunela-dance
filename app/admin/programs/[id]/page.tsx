import { notFound } from "next/navigation";
import { AdminAviso } from "@/components/admin-ui";
import { EditorPlan } from "@/components/editor-plan";
import { requireAdmin } from "@/src/features/auth/guards";
import { cargarClasesElegibles, cargarDiasDelPlan, cargarPlan } from "@/src/features/admin/editor-plan-datos";
import { casillerosDesdeDias } from "@/src/features/studio/dias-de-plan";

export const dynamic = "force-dynamic";

/**
 * Editar un plan de trabajo a pantalla completa: sus datos y todos sus dias.
 * Ver components/editor-plan.tsx.
 */
export default async function EditarPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = (await searchParams) ?? {};

  const plan = await cargarPlan(id);
  if (!plan) notFound();

  const [{ dias, faltaMigracion }, clases] = await Promise.all([cargarDiasDelPlan(plan.id), cargarClasesElegibles()]);

  return (
    <>
      <AdminAviso mensaje={typeof sp.success === "string" ? sp.success : null} tono="ok" />
      <AdminAviso mensaje={typeof sp.error === "string" ? sp.error : null} tono="error" />
      <EditorPlan
        // Sin key a proposito: al guardar la pagina se vuelve a pedir, y una key
        // que cambiara remontaria el editor y se perderia el «Guardado ✓». El
        // estado del navegador ya ES lo que se guardo; si algun dia fallo, la
        // barra lo dice.
        plan={plan}
        casillerosIniciales={casillerosDesdeDias(dias, plan.duration_days)}
        clases={clases}
        descansoDisponible={!faltaMigracion}
      />
    </>
  );
}
