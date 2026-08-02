import { updateProfileAdminAction } from "@/src/features/admin/actions";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  membership_tier: "none" | "corps_de_ballet" | "solista" | "principal";
  technical_level: "principiante" | "intermedio" | "avanzado" | "profesional" | "maestro";
  onboarding_completed: boolean;
  is_admin: boolean;
  created_at: string;
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

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, membership_tier, technical_level, onboarding_completed, is_admin, created_at")
    .order("created_at", { ascending: false });

  const profiles = (data ?? []) as ProfileRow[];
  const tierCounts = profiles.reduce<Record<string, number>>((acc, p) => {
    acc[p.membership_tier] = (acc[p.membership_tier] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main style={{ fontFamily: "inherit" }}>
      <Flash message={success} tone="success" />
      <Flash message={error} tone="error" />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { value: profiles.length,                   label: "Total alumnas",   color: "#1c1917" },
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
          <span>Alumna</span>
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
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#78716c", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Plan / Tier</span>
                      <select style={sel} defaultValue={profile.membership_tier} name="membershipTier">
                        <option value="none">Sin plan</option>
                        <option value="corps_de_ballet">Corps de Ballet</option>
                        <option value="solista">Solista</option>
                        <option value="principal">Principal</option>
                      </select>
                    </label>

                    <label style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#78716c", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Nivel tecnico</span>
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
    </main>
  );
}
