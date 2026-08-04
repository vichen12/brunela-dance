import { updateProfileAdminAction } from "@/src/features/admin/actions";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Alumnas por pagina. Con 50 entra una pantalla larga sin scroll infinito. */
const POR_PAGINA = 50;

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

const TIER_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  none:            { bg: "#f1f5f9", color: "#64748b", label: "Sin plan" },
  corps_de_ballet: { bg: "var(--pink-wash)", color: "var(--pink-deep)", label: "Corps de Ballet" },
  solista:         { bg: "var(--pink-soft)", color: "var(--pink-deep)", label: "Solista" },
  principal:       { bg: "#1c1917", color: "var(--pink-wash)", label: "Principal" },
};

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 8, border: "1px solid #e7e5e4",
  background: "#fff", color: "#1c1917", padding: "7px 10px",
  fontSize: 12, outline: "none", fontFamily: "inherit",
};

const sel: React.CSSProperties = {
  ...inp, appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 4l3 3 3-3' stroke='%23a8a29e' strokeWidth='1.5' strokeLinecap='round' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28,
};

function Flash({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;
  return (
    <div style={{
      borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 600, marginBottom: 20,
      background: tone === "success" ? "#f0fdf4" : "#fef2f2",
      color: tone === "success" ? "#166534" : "#991b1b",
      border: `1px solid ${tone === "success" ? "#bbf7d0" : "#fecaca"}`,
    }}>{message}</div>
  );
}

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

  // ⚠️ Los totales van en su PROPIA consulta, y no es un viaje de mas al pedo.
  //    Contarlos sobre las filas de la pagina daria "3 solistas" habiendo 30:
  //    el resumen de arriba mentiria, y mentiria hacia abajo, que es peor
  //    porque parece que el estudio anda peor de lo que anda.
  //
  //    Trae una sola columna, asi que pesa poco aunque no se pagine.
  const [{ data }, { data: todosLosTiers }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, membership_tier, technical_level, training_goals, onboarding_completed, is_admin, created_at")
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
  const totalAlumnas = (todosLosTiers ?? []).filter((p) => !p.is_admin).length;

  return (
    <main style={{ fontFamily: "inherit" }}>
      <header className="hero-stage">
        <p className="eyebrow">Comunidad</p>
        <h1 className="display mt-5 text-5xl leading-none md:text-6xl">Alumnas.</h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
          Quiénes están en el estudio, con qué plan y en qué nivel. Desde acá se ajustan los accesos.
        </p>
      </header>

      <Flash message={success} tone="success" />
      <Flash message={error} tone="error" />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          // profiles.length incluye a las admin. El panel de inicio cuenta solo
          // alumnas, asi que los dos numeros no coinciden -- y no coincidian por
          // una etiqueta, no por un error. Ahora cada uno dice lo que cuenta.
          { value: totalAlumnas, label: "Alumnas", color: "#1c1917" },
          { value: tierCounts["principal"] ?? 0,       label: "Principal",       color: "var(--pink-deep)" },
          { value: tierCounts["solista"] ?? 0,         label: "Solista",         color: "var(--pink-deep)" },
          { value: tierCounts["corps_de_ballet"] ?? 0, label: "Corps de Ballet", color: "var(--pink-deep)" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #f0eeec", borderRadius: 16, padding: "18px 20px",
          }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#a8a29e", marginTop: 6, letterSpacing: "0.04em" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* User list */}
      <div style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 16, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 120px 120px 80px 80px 100px",
          padding: "10px 20px", borderBottom: "1px solid #f0eeec",
          fontSize: 10, fontWeight: 700, color: "#a8a29e", letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          <span>Persona</span>
          <span>Plan</span>
          <span>Nivel</span>
          <span>Onboarding</span>
          <span>Admin</span>
          <span></span>
        </div>

        {profiles.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#a8a29e", fontSize: 13 }}>
            No hay perfiles registrados todavia.
          </div>
        ) : (
          profiles.map((profile, i) => {
            const tier = TIER_STYLE[profile.membership_tier] ?? TIER_STYLE.none;
            const name = profile.full_name ?? profile.email.split("@")[0];
            const joinDate = new Date(profile.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

            return (
              <details key={profile.id} style={{ borderBottom: i < profiles.length - 1 ? "1px solid #f9f7f6" : "none" }}>
                <summary style={{
                  listStyle: "none", cursor: "pointer", userSelect: "none",
                  display: "grid", gridTemplateColumns: "1fr 120px 120px 80px 80px 100px",
                  alignItems: "center", padding: "12px 20px",
                }}>
                  {/* Name + email */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1c1917" }}>
                      {name}
                      {profile.is_admin && (
                        <span style={{
                          marginLeft: 8, fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                          background: "var(--pink-wash)", color: "var(--pink-deep)",
                        }}>ADMIN</span>
                      )}
                    </p>
                    <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 1 }}>{profile.email}</p>
                    <p style={{ fontSize: 10, color: "#c4b5af", marginTop: 1 }}>Ingreso: {joinDate}</p>

                    {/* La ficha completa: progreso, plan, reservas y mensajes.
                        Es la pantalla desde la que se puede ACTUAR, asi que se
                        entra desde aca y no solo desde las analiticas. */}
                    <a href={`/admin/users/${profile.id}`} style={{
                      display: "inline-block", marginTop: 5, fontSize: 10.5,
                      fontWeight: 700, color: "var(--pink-deep)", textDecoration: "none",
                    }}>Ver ficha completa →</a>

                    {/* Que busca mejorar. Lo eligio ella en el onboarding. */}
                    {profile.training_goals && profile.training_goals.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                        {profile.training_goals.map((g) => (
                          <span key={g} style={{
                            fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                            background: "var(--pink-wash)", color: "var(--pink-deep)",
                          }}>{OBJETIVO_LABEL[g] ?? g}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tier */}
                  <div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                      background: tier.bg, color: tier.color,
                    }}>{tier.label}</span>
                  </div>

                  {/* Level */}
                  <div>
                    <span style={{ fontSize: 11, color: "#78716c", fontWeight: 500, textTransform: "capitalize" }}>
                      {profile.technical_level ?? "—"}
                    </span>
                  </div>

                  {/* Onboarding */}
                  <div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                      background: profile.onboarding_completed ? "#dcfce7" : "#f1f5f9",
                      color: profile.onboarding_completed ? "#166534" : "#64748b",
                    }}>{profile.onboarding_completed ? "Listo" : "Pendiente"}</span>
                  </div>

                  {/* Is admin */}
                  <div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                      background: profile.is_admin ? "var(--pink-wash)" : "transparent",
                      color: profile.is_admin ? "var(--pink-mid)" : "#c4b5af",
                    }}>{profile.is_admin ? "Si" : "No"}</span>
                  </div>

                  {/* Expand indicator */}
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "#c4b5af", fontWeight: 500 }}>Editar ▾</span>
                  </div>
                </summary>

                {/* Edit form */}
                <div style={{ padding: "16px 20px 20px", borderTop: "1px solid #f9f7f6", background: "#fafaf9" }}>
                  <form action={updateProfileAdminAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                    <input name="profileId" type="hidden" value={profile.id} />

                    <label style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#78716c", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Plan</span>
                      <select style={sel} defaultValue={profile.membership_tier} name="membershipTier">
                        <option value="none">Sin plan</option>
                        <option value="corps_de_ballet">Corps de Ballet</option>
                        <option value="solista">Solista</option>
                        <option value="principal">Principal</option>
                      </select>
                    </label>

                    <label style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#78716c", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Nivel técnico</span>
                      <select style={sel} defaultValue={profile.technical_level} name="technicalLevel">
                        <option value="principiante">Principiante</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="avanzado">Avanzado</option>
                        <option value="profesional">Profesional</option>
                        <option value="maestro">Maestro</option>
                      </select>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingBottom: 2 }}>
                      <input defaultChecked={profile.onboarding_completed} name="onboardingCompleted" type="checkbox" style={{ width: 15, height: 15, accentColor: "var(--pink-mid)" }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#44403c" }}>Onboarding completo</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingBottom: 2 }}>
                      <input defaultChecked={profile.is_admin} name="isAdmin" type="checkbox" style={{ width: 15, height: 15, accentColor: "var(--pink-mid)" }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#44403c" }}>Es admin</span>
                    </label>

                    <button type="submit" style={{
                      background: "#1c1917", color: "#fff", border: "none",
                      borderRadius: 99, padding: "9px 20px",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}>GUARDAR</button>
                  </form>
                </div>
              </details>
            );
          })
        )}
      </div>

      {/* Paginacion. A diferencia de la biblioteca, aca es de a paginas y no
          acumulativa: en un listado de gestion se busca a UNA alumna, no se
          recorre el conjunto. */}
      {(pagina > 0 || hayMasPaginas) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 14, marginTop: 18,
        }}>
          {pagina > 0 ? (
            <a href={`/admin/users?pagina=${pagina - 1}`} style={{
              padding: "10px 18px", borderRadius: 999, textDecoration: "none",
              background: "#fff", color: "var(--pink-deep)",
              border: "1.5px solid var(--pink-line)", fontSize: 12.5, fontWeight: 700,
            }}>← Anteriores</a>
          ) : <span />}

          <span style={{ fontSize: 11.5, color: "#a8a29e" }}>
            {pagina * POR_PAGINA + 1}–{pagina * POR_PAGINA + profiles.length} de {totalAlumnas} alumnas
          </span>

          {hayMasPaginas ? (
            <a href={`/admin/users?pagina=${pagina + 1}`} style={{
              padding: "10px 18px", borderRadius: 999, textDecoration: "none",
              background: "#fff", color: "var(--pink-deep)",
              border: "1.5px solid var(--pink-line)", fontSize: 12.5, fontWeight: 700,
            }}>Siguientes →</a>
          ) : <span />}
        </div>
      )}
    </main>
  );
}
