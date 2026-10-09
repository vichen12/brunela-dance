import { Desplegable } from "@/components/desplegable";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Pencil, Shield } from "lucide-react";
import { AdminAviso, AdminCabecera } from "@/components/admin-ui";
import { AdminBuscador } from "@/components/admin-buscador";
import { updateProfileAdminAction } from "@/src/features/admin/actions";
import { BotonEnviar } from "@/components/boton-enviar";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Alumnas por pagina. Con 50 entra una pantalla larga sin scroll infinito. */
const POR_PAGINA = 50;

/**
 * Filtro por plan, por URL: el panel de inicio enlaza cada cifra a su lista
 * ("Con plan activo" -> ?plan=con-plan). Se filtra en SQL y no sobre la pagina
 * ya traida: filtrar 50 filas en memoria daria una lista incompleta.
 */
const FILTROS_PLAN: Record<string, string> = {
  "con-plan": "Con plan activo",
  principal: "Principal",
  solista: "Solista",
  corps_de_ballet: "Corps de Ballet",
  none: "Sin plan",
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  membership_tier: "none" | "corps_de_ballet" | "solista" | "principal";
  technical_level: "principiante" | "intermedio" | "avanzado" | "profesional" | "maestro";
  training_goals: string[] | null;
  onboarding_completed: boolean;
  is_admin: boolean;
  created_at: string;
};

/**
 * Objetivos del onboarding, con el nombre que vio la alumna al elegirlos.
 *
 * Se venian guardando desde el alta y no se mostraban en ningun lado: Brunela
 * le pedia ocho objetivos a cada alumna y despues no los podia leer. Las claves
 * son las de OBJETIVOS en app/registro/onboarding/page.tsx -- si se agrega uno
 * alla, va aca tambien o se muestra el slug crudo.
 */
const OBJETIVO_LABEL: Record<string, string> = {
  movilidad: "Movilidad",
  fuerza_centro: "Fuerza y centro",
  flexibilidad: "Flexibilidad",
  recuperacion: "Recuperación",
  resistencia: "Resistencia",
  alineacion_postural: "Alineación postural",
  rendimiento_escenico: "Rendimiento escénico",
  bienestar_general: "Bienestar general",
};

const TIER_STYLE: Record<string, { clase: string; label: string }> = {
  none:            { clase: "au-plan--none", label: "Sin plan" },
  corps_de_ballet: { clase: "au-plan--corps", label: "Corps de Ballet" },
  solista:         { clase: "au-plan--solista", label: "Solista" },
  principal:       { clase: "au-plan--principal", label: "Principal" },
};

export default async function AdminUsersPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  // Fase D: paginado. Antes traia TODOS los perfiles con sus objetivos en cada
  // carga -- una consulta que anda perfecto con 10 alumnas y se vuelve pesada
  // con 500, justo cuando el estudio empieza a funcionar.
  const pagina = Math.max(0, Math.min(200, Number(params.pagina) || 0));
  const plan = typeof params.plan === "string" && params.plan in FILTROS_PLAN ? params.plan : "";
  // Buscar por nombre o correo. Antes no habia forma de encontrar a UNA alumna
  // entre 300 que no fuera pasar paginas.
  const q = (typeof params.q === "string" ? params.q : "").trim();
  const conPlan = (p: number) =>
    `/admin/users?${plan ? `plan=${plan}&` : ""}${q ? `q=${encodeURIComponent(q)}&` : ""}pagina=${p}`;

  let consulta = supabase
    .from("profiles")
    .select("id, email, full_name, membership_tier, technical_level, training_goals, onboarding_completed, is_admin, created_at");
  if (plan === "con-plan") consulta = consulta.neq("membership_tier", "none");
  else if (plan) consulta = consulta.eq("membership_tier", plan as "none");
  if (q) {
    const t = q.replace(/[,()%]/g, " ");
    consulta = consulta.or(`full_name.ilike.%${t}%,email.ilike.%${t}%`);
  }

  // ⚠️ Los totales van en su PROPIA consulta, y no es un viaje de mas al pedo.
  //    Contarlos sobre las filas de la pagina daria "3 solistas" habiendo 30:
  //    el resumen de arriba mentiria, y mentiria hacia abajo, que es peor
  //    porque parece que el estudio anda peor de lo que anda.
  //
  //    Trae una sola columna, asi que pesa poco aunque no se pagine.
  const [{ data }, { data: todosLosTiers }] = await Promise.all([
    consulta
      .order("created_at", { ascending: false })
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA),
    supabase.from("profiles").select("membership_tier, is_admin"),
  ]);

  const crudas = (data ?? []) as ProfileRow[];
  const hayMasPaginas = crudas.length > POR_PAGINA;
  const profiles = crudas.slice(0, POR_PAGINA);

  const tierCounts = (todosLosTiers ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.membership_tier] = (acc[p.membership_tier] ?? 0) + 1;
    return acc;
  }, {});
  // Todas las cuentas, admin incluidas: es lo que lista la pagina y lo que
  // suman las cifras por plan. Antes "Alumnas" contaba sin admin y los planes
  // con admin, y las cifras no cerraban.
  const totalCuentas = (todosLosTiers ?? []).length;

  return (
    <main className="au">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Comunidad"
        titulo="Alumnas"
        lede="Quiénes están en el estudio, con qué plan y en qué nivel. Desde acá se ajustan los accesos, y cada una tiene su ficha completa."
      />

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      {/* Las cifras filtran, y suman: cada cuenta cae en exactamente un plan. */}
      <div className="au-cifras">
        {[
          { value: totalCuentas, label: "Todas", filtro: "" },
          { value: tierCounts["principal"] ?? 0, label: "Principal", filtro: "principal" },
          { value: tierCounts["solista"] ?? 0, label: "Solista", filtro: "solista" },
          { value: tierCounts["corps_de_ballet"] ?? 0, label: "Corps de Ballet", filtro: "corps_de_ballet" },
          { value: tierCounts["none"] ?? 0, label: "Sin plan", filtro: "none" },
        ].map((c) => (
          <Link
            key={c.label}
            href={(c.filtro ? `/admin/users?plan=${c.filtro}` : "/admin/users") as never}
            className={"au-cifra" + (plan === c.filtro ? " es-activa" : "")}
            aria-current={plan === c.filtro ? "page" : undefined}
          >
            <span className="au-cifra-label">{c.label}</span>
            <span className="au-cifra-num">{c.value}</span>
          </Link>
        ))}
      </div>

      <AdminBuscador
        action="/admin/users"
        q={q}
        placeholder="Buscar por nombre o correo"
        total={totalCuentas}
        mostrando={profiles.length}
        filtros={[{
          name: "plan", valor: plan, etiqueta: "Plan",
          opciones: [{ key: "", label: "Cualquier plan" }, ...Object.entries(FILTROS_PLAN).map(([key, label]) => ({ key, label }))],
        }]}
      />

      {profiles.length === 0 ? (
        <div className="ad-vacio">
          <p className="ad-vacio-titulo">{q || plan ? "Nadie coincide." : "Todavía no hay alumnas."}</p>
          {(q || plan) && <Link href="/admin/users" className="ad-btn">Ver todas</Link>}
        </div>
      ) : (
        <ul className="au-lista">
          {profiles.map((profile) => {
            const tier = TIER_STYLE[profile.membership_tier] ?? TIER_STYLE.none;
            const name = profile.full_name ?? profile.email.split("@")[0];
            const joinDate = new Date(profile.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

            return (
              <li key={profile.id} className="au-fila">
                <div className="au-fila-cuerpo">
                  <span className="au-ini" aria-hidden="true">{name[0]?.toUpperCase()}</span>
                  <div className="au-info">
                    <p className="au-nombre">
                      {name}
                      {profile.is_admin && <span className="au-admin"><Shield size={11} strokeWidth={2.4} aria-hidden="true" /> Admin</span>}
                    </p>
                    <p className="au-correo">{profile.email} · desde el {joinDate}</p>
                    {/* Que busca mejorar. Lo eligio ella en el onboarding. */}
                    {profile.training_goals && profile.training_goals.length > 0 && (
                      <div className="au-objetivos">
                        {profile.training_goals.map((g) => <span key={g}>{OBJETIVO_LABEL[g] ?? g}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="au-datos">
                    <span className={"au-plan " + tier.clase}>{tier.label}</span>
                    <span className="au-nivel">{profile.technical_level ?? "—"}</span>
                    <span className={"au-onb" + (profile.onboarding_completed ? " es-ok" : "")}>
                      {profile.onboarding_completed ? <><Check size={12} strokeWidth={3} aria-hidden="true" /> Onboarding</> : "Onboarding pendiente"}
                    </span>
                  </div>
                  {/* La ficha completa: progreso, plan, reservas y mensajes. */}
                  <Link href={`/admin/users/${profile.id}` as never} className="au-ficha">
                    Ficha <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
                  </Link>
                </div>

                <details className="au-editar">
                  <summary><Pencil size={13} strokeWidth={2} aria-hidden="true" /> Editar accesos <ChevronDown size={14} strokeWidth={2} className="ad-flecha" aria-hidden="true" /></summary>
                  <form action={updateProfileAdminAction} className="au-form">
                    <input name="profileId" type="hidden" value={profile.id} />
                    <label className="au-campo">
                      <span>Plan</span>
                      <Desplegable defaultValue={profile.membership_tier} name="membershipTier" opciones={[
                        { value: "none", label: "Sin plan" },
                        { value: "corps_de_ballet", label: "Corps de Ballet" },
                        { value: "solista", label: "Solista" },
                        { value: "principal", label: "Principal" },
                      ]} />
                    </label>
                    <label className="au-campo">
                      <span>Nivel técnico</span>
                      <Desplegable defaultValue={profile.technical_level} name="technicalLevel" opciones={[
                        { value: "principiante", label: "Principiante" },
                        { value: "intermedio", label: "Intermedio" },
                        { value: "avanzado", label: "Avanzado" },
                        { value: "profesional", label: "Profesional" },
                        { value: "maestro", label: "Maestro" },
                      ]} />
                    </label>
                    <label className="pf-switch au-switch">
                      <input defaultChecked={profile.onboarding_completed} name="onboardingCompleted" type="checkbox" role="switch" />
                      <span className="pf-switch-pista" aria-hidden="true"><span /></span>
                      <span className="pf-switch-txt">Onboarding completo</span>
                    </label>
                    <label className="pf-switch au-switch">
                      <input defaultChecked={profile.is_admin} name="isAdmin" type="checkbox" role="switch" />
                      <span className="pf-switch-pista" aria-hidden="true"><span /></span>
                      <span className="pf-switch-txt">Es admin <small>entra al panel</small></span>
                    </label>
                    <BotonEnviar className="pf-guardar au-guardar" pendingLabel="Guardando…">
                      <Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar
                    </BotonEnviar>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {/* Paginacion: en un listado de gestion se busca a UNA alumna, no se
          recorre el conjunto, asi que va de a paginas. */}
      {(pagina > 0 || hayMasPaginas) && (
        <nav className="au-paginas" aria-label="Páginas">
          {pagina > 0 ? <Link href={conPlan(pagina - 1) as never} className="ad-btn">← Anteriores</Link> : <span />}
          <span className="au-paginas-txt">{pagina * POR_PAGINA + 1}–{pagina * POR_PAGINA + profiles.length}</span>
          {hayMasPaginas ? <Link href={conPlan(pagina + 1) as never} className="ad-btn">Siguientes →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}

const CSS = `
.au { display: flex; flex-direction: column; }
.au-cifras { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-top: 1px solid var(--ink); border-bottom: 1px solid #e7e5e4; margin-bottom: 4px; }
.au-cifra { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 16px 20px 18px; text-decoration: none; transition: background .2s; }
.au-cifra:first-child { padding-left: 0; }
.au-cifra + .au-cifra { border-left: 1px solid #e7e5e4; }
.au-cifra::after { content: ""; position: absolute; left: 0; right: 0; top: -1px; height: 3px; background: var(--pink); transform: scaleX(0); transform-origin: left; transition: transform .45s cubic-bezier(.16,1,.3,1); }
.au-cifra:hover::after, .au-cifra.es-activa::after { transform: scaleX(1); }
.au-cifra-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #78716c; }
.au-cifra.es-activa .au-cifra-label { color: var(--pink-deep); }
.au-cifra-num { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 34px; line-height: 0.95; letter-spacing: -0.045em; color: var(--ink); }

.au-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.au-fila { border: 1px solid #e7e5e4; border-radius: 18px; background: #fff; transition: border-color .2s, box-shadow .3s; }
.au-fila:hover { border-color: var(--pink-line); box-shadow: 0 16px 30px -24px rgba(176,58,62,0.5); }
.au-fila-cuerpo { display: flex; align-items: center; gap: 14px; padding: 14px 16px; flex-wrap: wrap; }
.au-ini { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--pink-wash); color: var(--pink-deep); font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 17px; }
.au-info { flex: 1 1 260px; min-width: 0; }
.au-nombre { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 15px; font-weight: 700; color: var(--ink); }
.au-admin { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 99px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; background: #fff; color: var(--ink); border: 1px solid #d6d3d1; }
.au-correo { font-size: 12.5px; color: #a8a29e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.au-objetivos { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.au-objetivos span { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; color: var(--pink-deep); background: var(--pink-wash); }
.au-datos { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.au-plan { padding: 4px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 800; }
.au-plan--none { background: #f5f5f4; color: #78716c; }
.au-plan--corps { background: #fff; color: var(--pink-deep); border: 1px solid var(--pink-line); }
.au-plan--solista { background: var(--pink-wash); color: var(--pink-deep); border: 1px solid var(--pink-line); }
.au-plan--principal { background: var(--pink); color: #fff; box-shadow: 0 6px 14px -8px rgba(230,79,85,0.8); }
.au-nivel { font-size: 12.5px; color: #57534e; text-transform: capitalize; }
.au-onb { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #a8a29e; }
.au-onb.es-ok { color: #15803d; font-weight: 600; }
.au-ficha { display: inline-flex; align-items: center; gap: 5px; height: 36px; padding: 0 14px; border-radius: 99px; text-decoration: none; font-size: 13px; font-weight: 700; color: var(--ink); border: 1.5px solid #e7e5e4; transition: border-color .2s, gap .2s; }
.au-ficha:hover { border-color: var(--ink); gap: 8px; }
.au-editar { border-top: 1px solid #f5f5f4; margin: 0 16px; }
.au-editar > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 7px; padding: 10px 0 12px; font-size: 13px; font-weight: 700; color: #57534e; user-select: none; }
.au-editar > summary::-webkit-details-marker { display: none; }
.au-editar > summary .ad-flecha { margin-left: auto; }
.au-editar[open] { padding-bottom: 16px; }
.au-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px 18px; align-items: end; }
.au-campo { display: flex; flex-direction: column; gap: 6px; }
.au-campo > span { font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #78716c; }
.au-campo .dsp-boton { border-color: #e7e5e4; }
.au-switch { padding-bottom: 8px; }
.au-guardar { justify-self: start; }
.au-paginas { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 18px; }
.au-paginas-txt { font-size: 12.5px; color: #a8a29e; }
@media (max-width: 760px) {
  .au-cifras { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .au-cifra + .au-cifra { border-left: 0; }
  .au-cifra { padding-left: 0; border-top: 1px solid #f0eeec; }
}
`;

