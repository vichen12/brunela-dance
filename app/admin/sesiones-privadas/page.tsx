import Link from "next/link";
import { ArrowRight, CalendarPlus, ChevronDown, Lock } from "lucide-react";
import { AdminAviso, AdminBoton, AdminCabecera, AdminNueva } from "@/components/admin-ui";
import { AdminBuscador } from "@/components/admin-buscador";
import { Paginacion } from "@/components/paginacion";
import { CupoMes, FormAgendarPrivada, ListaPrivadasAdmin } from "@/components/sesiones-privadas-admin";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { SelectorMultiple } from "@/components/selector-multiple";
import { BotonEnviar } from "@/components/boton-enviar";
import { PLANES } from "@/src/features/studio/catalogo-clases";
import { planesEnTexto } from "@/src/features/studio/planes-de-sesion";
import { getPlanesConPrivadas } from "@/src/features/studio/sesiones-privadas-config";
import { guardarPlanesPrivadasAction } from "@/src/features/admin/sesiones-privadas-actions";
import {
  AVISO_FALTA_MIGRACION_PRIVADAS, COLUMNAS_PRIVADA, CUPO_MENSUAL, claveMes, contarDelMes, esFaltaDeTabla,
  fechaHoraCorta, finDe, inicioDelMes, proximaDe, type SesionPrivada,
} from "@/src/features/studio/sesiones-privadas-reglas";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const POR_PAGINA = 10;

/**
 * Sesiones privadas: las alumnas de Principal, cuantas privadas llevan este
 * mes (X/2) y la proxima de cada una, con "Agendar" a un toque.
 *
 * Arriba, las proximas de TODAS (incluidas las que no son Principal: Brunela
 * puede regalarle una a cualquiera desde su ficha).
 *
 * Lecturas con el cliente de la sesion: la admin pasa RLS por is_admin(). Las
 * escrituras van por src/features/admin/sesiones-privadas-actions.ts.
 */
export default async function AdminSesionesPrivadasPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const txt = (k: string) => (typeof params[k] === "string" ? (params[k] as string).trim() : "");
  const success = txt("success") || null;
  const error = txt("error") || null;
  const q = txt("q");
  const pagina = Math.max(0, Math.min(200, Number(params.pagina) || 0));
  // Desde el calendario: "Agendar sesion privada" con el dia ya elegido.
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(txt("fecha")) ? txt("fecha") : "";
  const abrirNueva = txt("nueva") === "1" || Boolean(fecha);
  const volverA = "/admin/sesiones-privadas";
  // Que planes traen privadas: configurable abajo, por defecto solo Principal.
  const planes = await getPlanesConPrivadas();
  const textoPlanes = planesEnTexto(planes).replace(/^Solo /, "");

  let consulta = supabase
    .from("profiles")
    .select("id, full_name, email", { count: "exact" })
    .in("membership_tier", planes);
  if (q) {
    const t = q.replace(/[,()%]/g, " ");
    consulta = consulta.or(`full_name.ilike.%${t}%,email.ilike.%${t}%`);
  }

  const ahora = Date.now();
  const [{ data: alumnasData, count }, { data: todasPrincipal }, proximasRes] = await Promise.all([
    consulta.order("full_name", { ascending: true, nullsFirst: false }).range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1),
    // Para el desplegable de "Agendar": todas las de Principal, sin paginar.
    supabase.from("profiles").select("id, full_name, email").in("membership_tier", planes).order("full_name").limit(500),
    supabase.from("sesiones_privadas").select(COLUMNAS_PRIVADA)
      .eq("estado", "agendada").gte("starts_at", new Date(ahora - 4 * 3600 * 1000).toISOString())
      .order("starts_at", { ascending: true }).limit(30),
  ]);

  const disponible = !proximasRes.error;
  if (proximasRes.error && !esFaltaDeTabla(proximasRes.error)) console.error("[admin/sesiones-privadas]", proximasRes.error.message);
  const proximas = ((proximasRes.data ?? []) as SesionPrivada[]).filter((s) => finDe(s) > ahora);

  type Perfil = { id: string; full_name: string | null; email: string };
  const nombre = (p: Perfil) => p.full_name?.trim() || p.email.split("@")[0];
  const alumnas = (alumnasData ?? []) as Perfil[];

  // Las sesiones de la pagina, desde el 1 del mes: alcanza para el X/2 y para
  // la proxima de cada una. Una sola consulta para las 10 filas.
  const ids = alumnas.map((a) => a.id);
  const { data: delMesData } = disponible && ids.length
    ? await supabase.from("sesiones_privadas").select(COLUMNAS_PRIVADA).in("alumna_id", ids).gte("starts_at", inicioDelMes(ahora)).order("starts_at")
    : { data: [] };
  const porAlumna = new Map<string, SesionPrivada[]>();
  for (const s of (delMesData ?? []) as SesionPrivada[]) porAlumna.set(s.alumna_id, [...(porAlumna.get(s.alumna_id) ?? []), s]);
  const mes = claveMes(ahora);

  // Nombres para la lista de proximas (pueden no ser de Principal).
  const idsProximas = [...new Set(proximas.map((s) => s.alumna_id))];
  const { data: nombresData } = idsProximas.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", idsProximas)
    : { data: [] };
  const nombreDe = Object.fromEntries(((nombresData ?? []) as Perfil[]).map((p) => [p.id, nombre(p)]));

  const opcionesAlumnas = ((todasPrincipal ?? []) as Perfil[]).map((p) => ({ id: p.id, nombre: `${nombre(p)} · ${p.email}` }));
  const href = (n: number) => `/admin/sesiones-privadas?${q ? `q=${encodeURIComponent(q)}&` : ""}pagina=${n}`;

  return (
    <main className="spp">
      <style>{CSS}</style>
      <AdminCabecera
        eyebrow="Comunidad"
        titulo="Sesiones privadas"
        lede={`${planes.length === 1 ? `El plan ${textoPlanes} trae` : `Los planes ${textoPlanes} traen`} ${CUPO_MENSUAL} sesiones privadas por mes. Acá ves cuántas lleva cada alumna, cuál es la próxima, y las agendás en un minuto.`}
        acciones={
          <>
            {disponible && <AdminBoton href="/admin/sesiones-privadas?nueva=1#nueva" lleno><CalendarPlus size={16} strokeWidth={2.2} aria-hidden="true" /> Agendar</AdminBoton>}
          </>
        }
      />

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />
      {!disponible && <div role="status" className="ad-aviso ad-aviso--error">{AVISO_FALTA_MIGRACION_PRIVADAS}</div>}

      {disponible && (
        <AdminNueva id="nueva" abierto={abrirNueva} titulo="Agendar una sesión privada" sub="Alumna, día, hora y, si ya lo tenés, el enlace">
          {opcionesAlumnas.length === 0 ? (
            <p className="spp-txt">Todavía no hay alumnas en {textoPlanes}. Para agendarle una a otra alumna, entrá a su ficha desde <Link href={"/admin/users" as never}>Alumnas</Link>, o sumá más planes en «Qué planes tienen sesiones privadas», abajo.</p>
          ) : (
            <FormAgendarPrivada alumnas={opcionesAlumnas} volverA={volverA} fecha={fecha || undefined} />
          )}
        </AdminNueva>
      )}

      {disponible && (
        <section className="spp-bloque" aria-labelledby="spp-prox">
          <h2 id="spp-prox" className="spp-h2"><span className="spp-h2-ico" aria-hidden="true"><Lock size={15} strokeWidth={2.4} /></span>Próximas</h2>
          <ListaPrivadasAdmin sesiones={proximas} volverA={volverA} nombreDe={nombreDe} vacio="No hay ninguna sesión privada agendada." />
        </section>
      )}

      {/* Que planes traen privadas (pedido 2026-11-09). Por defecto, Principal. */}
      <section id="config" className="spp-bloque spp-config" aria-labelledby="spp-config-t">
        <h2 id="spp-config-t" className="spp-h2">Qué planes tienen sesiones privadas</h2>
        <form action={guardarPlanesPrivadasAction} className="spp-config-form">
          <SelectorMultiple name="planes" opciones={PLANES} inicial={planes} requerido mensajeRequerido="Elegí al menos un plan." />
          <BotonEnviar className="ad-btn ad-btn--lleno" pendingLabel="Guardando…">Guardar</BotonEnviar>
        </form>
        <p className="spp-txt">Las alumnas de estos planes ven «Sesiones privadas» en su menú y aparecen en la lista para agendar. A cualquier otra alumna le podés agendar una igual desde su ficha.</p>
      </section>

      <section className="spp-bloque" aria-labelledby="spp-alumnas">
        <h2 id="spp-alumnas" className="spp-h2">Alumnas de {textoPlanes} <span className="spp-cuenta">{count ?? 0}</span></h2>
        <AdminBuscador action="/admin/sesiones-privadas" q={q} placeholder="Buscar por nombre o correo" total={count ?? 0} mostrando={alumnas.length} />

        {alumnas.length === 0 ? (
          <div className="ad-vacio">
            <p className="ad-vacio-titulo">{q ? "Nadie coincide." : `Todavía no hay alumnas en ${textoPlanes}.`}</p>
            {q && <Link href={"/admin/sesiones-privadas" as never} className="ad-btn">Ver todas</Link>}
          </div>
        ) : (
          <ul className="spp-lista">
            {alumnas.map((a) => {
              const suyas = porAlumna.get(a.id) ?? [];
              const prox = proximaDe(suyas, ahora);
              return (
                <li key={a.id} className="spp-fila">
                  <div className="spp-fila-cuerpo">
                    <span className="spp-ini" aria-hidden="true">{nombre(a)[0]?.toUpperCase()}</span>
                    <div className="spp-info">
                      <p className="spp-nombre">{nombre(a)}</p>
                      <p className="spp-correo">{a.email}</p>
                    </div>
                    <div className="spp-datos">
                      {disponible && <CupoMes hechas={contarDelMes(suyas, mes)} cupo={CUPO_MENSUAL} />}
                      {disponible && (
                        <span className={"spp-prox" + (prox ? "" : " es-nada")}>
                          {prox ? <>Próxima: <b>{fechaHoraCorta(prox.starts_at)}</b>{!prox.enlace && " · sin enlace"}</> : "Sin próxima agendada"}
                        </span>
                      )}
                    </div>
                    <Link href={`/admin/users/${a.id}#privadas` as never} className="spp-ficha">
                      Ficha <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
                    </Link>
                  </div>
                  {disponible && (
                    <details className="spp-agendar">
                      <summary><CalendarPlus size={13} strokeWidth={2.2} aria-hidden="true" /> Agendar <ChevronDown size={14} strokeWidth={2} className="ad-flecha" aria-hidden="true" /></summary>
                      <FormAgendarPrivada alumnaId={a.id} nombre={nombre(a)} volverA={volverA} fecha={fecha || undefined} />
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Paginacion pagina={pagina} total={count ?? 0} porPagina={POR_PAGINA} href={href} />
      </section>
    </main>
  );
}

const CSS = `
.spp-config-form { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 8px; }
.spp { display: flex; flex-direction: column; gap: 6px; }
.spp .ad-nueva { margin-bottom: 18px; }
.spp-txt { font-size: 14px; color: var(--muted); }
.spp-txt a { color: var(--pink-deep); font-weight: 800; }
.spp-bloque { margin-bottom: 22px; display: flex; flex-direction: column; gap: 12px; }
.spp-h2 { display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.spp-h2-ico { width: 34px; height: 34px; border-radius: 12px; display: grid; place-items: center; background: #FFF4E8; color: var(--melocoton-deep); }
.spp-cuenta { padding: 2px 10px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 13px; font-weight: 900; }
.spp-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.spp-fila { border: 1px solid var(--linea); border-radius: var(--radio); background: #fff; box-shadow: var(--sombra); }
.spp-fila-cuerpo { display: flex; align-items: center; gap: 14px; padding: 14px 18px; flex-wrap: wrap; }
.spp-ini { width: 44px; height: 44px; border-radius: 15px; flex-shrink: 0; display: grid; place-items: center; background: linear-gradient(135deg, var(--melocoton), var(--pink-soft)); color: var(--pink-deep); font-weight: 900; font-size: 18px; }
.spp-info { flex: 1 1 200px; min-width: 0; }
.spp-nombre { font-size: 15.5px; font-weight: 800; color: var(--ink); }
.spp-correo { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.spp-datos { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.spp-prox { font-size: 12.5px; color: var(--muted); }
.spp-prox b { color: var(--ink); text-transform: capitalize; }
.spp-prox.es-nada { font-style: italic; }
.spp-ficha { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 15px; border-radius: 99px; text-decoration: none; font-size: 13px; font-weight: 800; color: var(--ink); background: #fff; border: 1.5px solid var(--linea-fuerte); transition: background .2s, border-color .2s, color .2s; }
.spp-ficha:hover { background: var(--pink); border-color: var(--pink); color: #fff; }
.spp-agendar { border-top: 1px dashed var(--linea-fuerte); margin: 0 18px; }
.spp-agendar > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 11px 0 12px; font-size: 13.5px; font-weight: 800; color: var(--pink-deep); user-select: none; }
.spp-agendar > summary::-webkit-details-marker { display: none; }
.spp-agendar > summary .ad-flecha { margin-left: auto; transition: transform .3s var(--curva); }
.spp-agendar[open] > summary .ad-flecha { transform: rotate(180deg); }
.spp-agendar[open] { padding-bottom: 16px; }
@media (max-width: 640px) { .spp-fila-cuerpo { padding: 12px 14px; } .spp-agendar { margin: 0 14px; } }
`;
