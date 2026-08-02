import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────────

type Announcement = {
  id: string;
  title: string;
  content: string;
  tier_target: string;
  is_active: boolean;
  published_at: string;
  expires_at: string | null;
};

// ── Server actions ─────────────────────────────────────────────────────────────

async function createAnnouncementAction(fd: FormData) {
  "use server";
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("studio_announcements").insert({
    title: (fd.get("title") as string).trim(),
    content: (fd.get("content") as string).trim(),
    tier_target: (fd.get("tierTarget") as string) || "all",
    is_active: true,
    expires_at: fd.get("expiresAt") ? new Date(fd.get("expiresAt") as string).toISOString() : null,
    created_by: user.id,
  });

  if (error) redirect(`/admin/announcements?error=${encodeURIComponent(error.message)}` as never);

  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
  redirect("/admin/announcements?success=Anuncio+publicado" as never);
}

async function deactivateAnnouncementAction(fd: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  await supabase.from("studio_announcements").update({ is_active: false }).eq("id", id);
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
  redirect("/admin/announcements?success=Anuncio+desactivado" as never);
}

async function deleteAnnouncementAction(fd: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  await supabase.from("studio_announcements").delete().eq("id", id);
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
  redirect("/admin/announcements?success=Anuncio+eliminado" as never);
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  all: "Todas las alumnas",
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal",
};

const TIER_STYLE: Record<string, { bg: string; color: string }> = {
  all:             { bg: "#f1f5f9", color: "#475569" },
  corps_de_ballet: { bg: "var(--pink-wash)", color: "var(--pink-deep)" },
  solista:         { bg: "var(--pink-soft)", color: "var(--pink-deep)" },
  principal:       { bg: "#1c1917", color: "var(--pink-wash)" },
};

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 10, border: "1px solid #e7e5e4",
  background: "#fff", color: "#1c1917", padding: "9px 13px",
  fontSize: 13, outline: "none", fontFamily: "inherit",
};

const sel: React.CSSProperties = {
  ...inp, appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23a8a29e' strokeWidth='1.5' strokeLinecap='round' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 34,
};

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#78716c", textTransform: "uppercase", marginBottom: 5 }}>
      {children}
    </span>
  );
}

function Flash({ msg, tone }: { msg: string | null; tone: "ok" | "err" }) {
  if (!msg) return null;
  return (
    <div style={{
      borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 600,
      background: tone === "ok" ? "#f0fdf4" : "#fef2f2",
      color: tone === "ok" ? "#166534" : "#991b1b",
      border: `1px solid ${tone === "ok" ? "#bbf7d0" : "#fecaca"}`,
      marginBottom: 20,
    }}>{msg}</div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? decodeURIComponent(params.success) : null;
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;

  const { data } = await supabase
    .from("studio_announcements")
    .select("id, title, content, tier_target, is_active, published_at, expires_at")
    .order("published_at", { ascending: false });

  const announcements = (data ?? []) as Announcement[];
  const active = announcements.filter((a) => a.is_active).length;

  return (
    <main style={{ fontFamily: "inherit" }}>
      <Flash msg={success} tone="ok" />
      <Flash msg={error} tone="err" />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { value: announcements.length, label: "Total",  sub: "anuncios creados" },
          { value: active,               label: "Activos", sub: "visibles en el studio" },
          { value: announcements.length - active, label: "Inactivos", sub: "desactivados o vencidos" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #f0eeec", borderRadius: 16, padding: "20px 22px",
          }}>
            <p style={{ fontSize: 30, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#44403c", marginTop: 6 }}>{s.label}</p>
            <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      <div style={{
        background: "#fff", border: "1px solid #f0eeec", borderRadius: 16,
        padding: "24px 22px", marginBottom: 20,
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 18 }}>
          Nuevo anuncio
        </p>
        <form action={createAnnouncementAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column" }}>
              <Lbl>Titulo</Lbl>
              <input style={inp} name="title" required placeholder="Nuevos horarios disponibles" />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>
              <Lbl>Destinatarias</Lbl>
              <select style={sel} name="tierTarget" defaultValue="all">
                <option value="all">Todas las alumnas</option>
                <option value="corps_de_ballet">Corps de Ballet y superiores</option>
                <option value="solista">Solista y superiores</option>
                <option value="principal">Solo Principal</option>
              </select>
            </label>
          </div>
          <label style={{ display: "flex", flexDirection: "column" }}>
            <Lbl>Mensaje</Lbl>
            <textarea
              style={{ ...inp, minHeight: 84, resize: "vertical" }}
              name="content"
              required
              placeholder="El mensaje que van a ver las alumnas en su dashboard..."
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column" }}>
              <Lbl>Vence el (opcional)</Lbl>
              <input style={inp} name="expiresAt" type="datetime-local" />
            </label>
          </div>
          <button type="submit" style={{
            background: "linear-gradient(135deg, var(--pink), var(--pink-mid))",
            color: "#fff", border: "none", borderRadius: 99,
            padding: "10px 24px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
            cursor: "pointer", alignSelf: "flex-start",
          }}>
            PUBLICAR ANUNCIO
          </button>
        </form>
      </div>

      {/* Announcement list */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 12 }}>
          Historial — {announcements.length}
        </p>
        {announcements.length === 0 ? (
          <div style={{
            background: "#fff", border: "1.5px dashed #f0eeec", borderRadius: 16,
            padding: "40px 24px", textAlign: "center", color: "#a8a29e", fontSize: 13,
          }}>
            No hay anuncios. Crea el primero arriba.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {announcements.map((a) => {
              const tierStyle = TIER_STYLE[a.tier_target] ?? TIER_STYLE.all;
              const pubDate = new Date(a.published_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
              const isExpired = a.expires_at ? new Date(a.expires_at) < new Date() : false;

              return (
                <div key={a.id} style={{
                  background: "#fff", border: "1px solid #f0eeec", borderRadius: 16,
                  padding: "18px 20px", opacity: !a.is_active ? 0.6 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    {/* Left: content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        {a.title && (
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#1c1917" }}>{a.title}</span>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
                          background: tierStyle.bg, color: tierStyle.color,
                        }}>{TIER_LABELS[a.tier_target] ?? a.tier_target}</span>
                        {a.is_active && !isExpired ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: "#dcfce7", color: "#166534" }}>Activo</span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: "#f1f5f9", color: "#64748b" }}>
                            {isExpired ? "Vencido" : "Inactivo"}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: "#44403c", lineHeight: 1.5, marginBottom: 8 }}>{a.content}</p>
                      <p style={{ fontSize: 11, color: "#a8a29e" }}>
                        Publicado: {pubDate}
                        {a.expires_at && ` · Vence: ${new Date(a.expires_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`}
                      </p>
                    </div>

                    {/* Right: actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {a.is_active && (
                        <form action={deactivateAnnouncementAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" style={{
                            fontSize: 10, fontWeight: 700, padding: "5px 13px", borderRadius: 99,
                            background: "#fef9c3", color: "#854d0e", border: "none", cursor: "pointer",
                          }}>Desactivar</button>
                        </form>
                      )}
                      <form action={deleteAnnouncementAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" style={{
                          fontSize: 10, fontWeight: 700, padding: "5px 13px", borderRadius: 99,
                          background: "#fee2e2", color: "#991b1b", border: "none", cursor: "pointer",
                        }}>Eliminar</button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
