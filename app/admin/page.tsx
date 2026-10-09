import { requireAdmin } from "@/src/features/auth/guards";
import { PanelControlAdmin } from "@/components/panel-control-admin";
import { cargarPanelEstudio, fechaDelPanel } from "@/src/features/admin/panel-estudio";
import { cargarRecordatoriosAdmin } from "@/src/features/admin/recordatorios";

export const dynamic = "force-dynamic";

/**
 * Resumen del panel de admin. Es el MISMO panel del estudio que ve una cuenta
 * admin en /dashboard, con los mismos datos (src/features/admin/panel-estudio).
 *
 * Antes era una pantalla aparte con ocho tarjetas que dibujaban graficos de
 * tendencia escritos a mano: la linea subia aunque la cifra fuera 0. Un
 * grafico que no sale de los datos es peor que no tener grafico.
 */
export default async function AdminOverviewPage() {
  const { profile } = await requireAdmin();
  const nombre = profile?.full_name?.trim().split(/\s+/)[0] || null;
  const [datos, recordatorios] = await Promise.all([cargarPanelEstudio(), cargarRecordatoriosAdmin()]);

  return (
    <PanelControlAdmin
      datos={{ ...datos, recordatorios, nombre, fecha: fechaDelPanel() }}
      secundario={{ href: "/admin/analiticas", label: "Analíticas" }}
    />
  );
}
