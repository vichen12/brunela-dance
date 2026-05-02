import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────────

type LiveSession = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  status: "draft" | "scheduled" | "completed" | "canceled";
  membership_tier_required: "corps_de_ballet" | "solista" | "principal";
  starts_at: string;
  ends_at: string;
  session_timezone: string;
  capacity: number;
  cover_image_url: string | null;
  booking_opens_at: string | null;
  booking_closes_at: string | null;
  bookings_count: number;
  access_link: { join_url: string; passcode: string | null } | null;
};

// ── Server actions ─────────────────────────────────────────────────────────────

async function createLiveSessionAction(fd: FormData) {
  "use server";
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const slug = (fd.get("slug") as string).trim();
  const startsAt = fd.get("startsAt") as string;
  const endsAt = fd.get("endsAt") as string;
  const status = (fd.get("status") as string) || "draft";

  const { data: session, error } = await supabase
    .from("live_sessions")
    .insert({
      slug,
      title_i18n: { es: fd.get("titleEs"), en: fd.get("titleEn") || undefined },
      description_i18n: { es: fd.get("descriptionEs") || "", en: fd.get("descriptionEn") || "" },
      status,
      membership_tier_required: (fd.get("membershipTierRequired") as string) || "corps_de_ballet",
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      session_timezone: (fd.get("sessionTimezone") as string) || "America/Buenos_Aires",
      capacity: parseInt(fd.get("capacity") as string) || 20,
      cover_image_url: (fd.get("coverImageUrl") as string) || null,
      booking_opens_at: fd.get("bookingOpensAt") ? new Date(fd.get("bookingOpensAt") as string).toISOString() : null,
      booking_closes_at: fd.get("bookingClosesAt") ? new Date(fd.get("bookingClosesAt") as string).toISOString() : null,
      created_by: user.id,
      published_at: status === "scheduled" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) redirect(`/admin/live?error=${encodeURIComponent(error.message)}` as never);

  const joinUrl = (fd.get("zoomJoinUrl") as string).trim();
  if (joinUrl && session) {
    await supabase.from("live_session_access_links").insert({
      live_session_id: session.id,
      provider: "zoom",
      join_url: joinUrl,
      passcode: (fd.get("zoomPasscode") as string) || null,
    });
  }

  revalidatePath("/admin/live");
  revalidatePath("/dashboard/live");
  redirect("/admin/live?success=Sesion+creada" as never);
}

async function updateLiveSessionAction(fd: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const id = fd.get("id") as string;
  const status = fd.get("status") as string;

  const { error } = await supabase
    .from("live_sessions")
    .update({
      slug: (fd.get("slug") as string).trim(),
      title_i18n: { es: fd.get("titleEs"), en: fd.get("titleEn") || undefined },
      description_i18n: { es: fd.get("descriptionEs") || "", en: fd.get("descriptionEn") || "" },
      status,
      membership_tier_required: fd.get("membershipTierRequired") as string,
      starts_at: new Date(fd.get("startsAt") as string).toISOString(),
      ends_at: new Date(fd.get("endsAt") as string).toISOString(),
      session_timezone: (fd.get("sessionTimezone") as string) || "America/Buenos_Aires",
      capacity: parseInt(fd.get("capacity") as string) || 20,
      cover_image_url: (fd.get("coverImageUrl") as string) || null,
      booking_opens_at: fd.get("bookingOpensAt") ? new Date(fd.get("bookingOpensAt") as string).toISOString() : null,
      booking_closes_at: fd.get("bookingClosesAt") ? new Date(fd.get("bookingClosesAt") as string).toISOString() : null,
      published_at: status === "scheduled" ? new Date().toISOString() : undefined,
    })
    .eq("id", id);

  if (error) redirect(`/admin/live?error=${encodeURIComponent(error.message)}` as never);

  const joinUrl = (fd.get("zoomJoinUrl") as string).trim();
  if (joinUrl) {
    await supabase.from("live_session_access_links").upsert(
      {
        live_session_id: id,
        provider: "zoom",
        join_url: joinUrl,
        passcode: (fd.get("zoomPasscode") as string) || null,
      },
      { onConflict: "live_session_id" }
    );
  }

  revalidatePath("/admin/live");
  revalidatePath("/dashboard/live");
  redirect("/admin/live?success=Sesion+actualizada" as never);
}

async function deleteLiveSessionAction(fd: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  await supabase.from("live_sessions").delete().eq("id", id);
  revalidatePath("/admin/live");
  redirect("/admin/live?success=Sesion+eliminada" as never);
}

async function updateStatusAction(fd: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  const status = fd.get("status") as string;
  const update: Record<string, unknown> = { status };
  if (status === "scheduled") update.published_at = new Date().toISOString();
  await supabase.from("live_sessions").update(update).eq("id", id);
  revalidatePath("/admin/live");
  revalidatePath("/dashboard/live");
  redirect("/admin/live?success=Estado+actualizado" as never);
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "#fef9c3", color: "#854d0e", label: "Borrador" },
  scheduled: { bg: "#dcfce7", color: "#166534", label: "Publicada" },
  completed: { bg: "#f1f5f9", color: "#475569", label: "Completada" },
  canceled:  { bg: "#fee2e2", color: "#991b1b", label: "Cancelada" },
};

const TIER_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  corps_de_ballet: { bg: "#fdf2f8", color: "#9d174d", label: "Corps de Ballet" },
  solista:         { bg: "#fce7f3", color: "#be185d", label: "Solista" },
  principal:       { bg: "#1c1917", color: "#fdf2f8", label: "Principal" },
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

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column" }}>
      <Lbl>{label}</Lbl>
      {children}
    </label>
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

function toLocalDatetime(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function LiveForm({ session }: { session?: LiveSession }) {
  const isNew = !session;
  const tz = session?.session_timezone ?? "America/Buenos_Aires";

  return (
    <form action={isNew ? createLiveSessionAction : updateLiveSessionAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!isNew && <input type="hidden" name="id" value={session.id} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Slug">
          <input style={inp} name="slug" required defaultValue={session?.slug ?? ""} placeholder="clase-ballet-lunes" />
        </F>
        <F label="Estado">
          <select style={sel} name="status" defaultValue={session?.status ?? "draft"}>
            <option value="draft">Borrador</option>
            <option value="scheduled">Publicada</option>
            <option value="completed">Completada</option>
            <option value="canceled">Cancelada</option>
          </select>
        </F>

        <F label="Titulo en Espanol">
          <input style={inp} name="titleEs" required defaultValue={session?.title_i18n?.es ?? ""} placeholder="Clase de Ballet — Lunes" />
        </F>
        <F label="Titulo en Ingles">
          <input style={inp} name="titleEn" defaultValue={session?.title_i18n?.en ?? ""} placeholder="Ballet Class — Monday" />
        </F>

        <F label="Inicio (fecha y hora)">
          <input style={inp} name="startsAt" type="datetime-local" required defaultValue={toLocalDatetime(session?.starts_at ?? null)} />
        </F>
        <F label="Fin (fecha y hora)">
          <input style={inp} name="endsAt" type="datetime-local" required defaultValue={toLocalDatetime(session?.ends_at ?? null)} />
        </F>

        <F label="Tier requerido">
          <select style={sel} name="membershipTierRequired" defaultValue={session?.membership_tier_required ?? "corps_de_ballet"}>
            <option value="corps_de_ballet">Corps de Ballet</option>
            <option value="solista">Solista</option>
            <option value="principal">Principal</option>
          </select>
        </F>
        <F label="Capacidad">
          <input style={inp} name="capacity" type="number" min={1} required defaultValue={session?.capacity ?? 20} />
        </F>

        <F label="Apertura de reservas">
          <input style={inp} name="bookingOpensAt" type="datetime-local" defaultValue={toLocalDatetime(session?.booking_opens_at ?? null)} />
        </F>
        <F label="Cierre de reservas">
          <input style={inp} name="bookingClosesAt" type="datetime-local" defaultValue={toLocalDatetime(session?.booking_closes_at ?? null)} />
        </F>

        <F label="URL de portada">
          <input style={inp} name="coverImageUrl" type="url" defaultValue={session?.cover_image_url ?? ""} placeholder="https://..." />
        </F>
        <F label="Zona horaria">
          <input style={inp} name="sessionTimezone" defaultValue={tz} placeholder="America/Buenos_Aires" />
        </F>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Descripcion en Espanol">
          <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} name="descriptionEs" defaultValue={session?.description_i18n?.es ?? ""} placeholder="Descripcion de la sesion..." />
        </F>
        <F label="Descripcion en Ingles">
          <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} name="descriptionEn" defaultValue={session?.description_i18n?.en ?? ""} placeholder="Session description..." />
        </F>
      </div>

      <div style={{ borderRadius: 12, border: "1px solid #f0eeec", padding: "16px 18px", background: "#fafaf9" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#78716c", textTransform: "uppercase", marginBottom: 12 }}>
          Enlace de acceso (Zoom)
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <F label="URL de ingreso">
            <input style={inp} name="zoomJoinUrl" type="url" defaultValue={session?.access_link?.join_url ?? ""} placeholder="https://zoom.us/j/..." />
          </F>
          <F label="Codigo de acceso">
            <input style={inp} name="zoomPasscode" defaultValue={session?.access_link?.passcode ?? ""} placeholder="123456" />
          </F>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button type="submit" style={{
          background: isNew ? "linear-gradient(135deg, #db2777, #be185d)" : "#1c1917",
          color: "#fff", border: "none", borderRadius: 99,
          padding: "10px 24px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          cursor: "pointer",
        }}>
          {isNew ? "CREAR SESION" : "GUARDAR CAMBIOS"}
        </button>
        {!isNew && (
          <form action={deleteLiveSessionAction} style={{ display: "inline" }}>
            <input type="hidden" name="id" value={session!.id} />
            <button type="submit" style={{
              background: "transparent", color: "#ef4444", border: "1px solid #fecaca",
              borderRadius: 99, padding: "10px 22px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.1em", cursor: "pointer",
            }}>ELIMINAR</button>
          </form>
        )}
      </div>
    </form>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminLivePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? decodeURIComponent(params.success) : null;
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;

  const { data: sessionsData } = await supabase
    .from("live_sessions")
    .select("id, slug, title_i18n, description_i18n, status, membership_tier_required, starts_at, ends_at, session_timezone, capacity, cover_image_url, booking_opens_at, booking_closes_at")
    .order("starts_at", { ascending: false });

  const { data: bookingsData } = await supabase
    .from("live_session_bookings")
    .select("live_session_id, status")
    .in("status", ["reserved", "attended"]);

  const { data: accessLinksData } = await supabase
    .from("live_session_access_links")
    .select("live_session_id, join_url, passcode");

  const bookingsBySession = (bookingsData ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.live_session_id] = (acc[b.live_session_id] ?? 0) + 1;
    return acc;
  }, {});

  const accessLinksBySession = (accessLinksData ?? []).reduce<Record<string, { join_url: string; passcode: string | null }>>((acc, a) => {
    acc[a.live_session_id] = { join_url: a.join_url, passcode: a.passcode };
    return acc;
  }, {});

  const sessions = ((sessionsData ?? []) as Omit<LiveSession, "bookings_count" | "access_link">[]).map((s) => ({
    ...s,
    bookings_count: bookingsBySession[s.id] ?? 0,
    access_link: accessLinksBySession[s.id] ?? null,
  }));

  const scheduled = sessions.filter((s) => s.status === "scheduled").length;
  const upcoming = sessions.filter((s) => s.status === "scheduled" && new Date(s.starts_at) > new Date()).length;
  const total = sessions.length;

  return (
    <main style={{ fontFamily: "inherit" }}>
      <Flash msg={success} tone="ok" />
      <Flash msg={error} tone="err" />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { value: total,     label: "Sesiones totales", sub: "en el sistema" },
          { value: scheduled, label: "Publicadas",        sub: "visibles a alumnas" },
          { value: upcoming,  label: "Proximas",          sub: "pendientes de dar" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #f0eeec", borderRadius: 16,
            padding: "20px 22px",
          }}>
            <p style={{ fontSize: 30, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#44403c", marginTop: 6 }}>{s.label}</p>
            <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Create new session */}
      <details style={{ marginBottom: 16 }}>
        <summary style={{
          listStyle: "none", cursor: "pointer",
          background: "#fff", border: "1px solid #f0eeec", borderRadius: 14,
          padding: "14px 20px", display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 700, color: "#1c1917",
          userSelect: "none",
        }}>
          <span style={{
            width: 24, height: 24, borderRadius: 8,
            background: "linear-gradient(135deg, #db2777, #be185d)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 16, fontWeight: 800, lineHeight: 1, flexShrink: 0,
          }}>+</span>
          Nueva sesion en vivo
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#a8a29e", fontWeight: 500 }}>Clic para desplegar formulario</span>
        </summary>
        <div style={{
          background: "#fff", border: "1px solid #f0eeec", borderTop: "none",
          borderRadius: "0 0 14px 14px", padding: "24px 22px",
        }}>
          <LiveForm />
        </div>
      </details>

      {/* Session list */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 12 }}>
          Sesiones — {total}
        </p>
        {sessions.length === 0 ? (
          <div style={{
            background: "#fff", border: "1.5px dashed #f0eeec", borderRadius: 16,
            padding: "40px 24px", textAlign: "center", color: "#a8a29e", fontSize: 13,
          }}>
            No hay sesiones todavia. Crea la primera arriba.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sessions.map((session) => {
              const st = STATUS_STYLE[session.status] ?? STATUS_STYLE.draft;
              const tier = TIER_STYLE[session.membership_tier_required] ?? TIER_STYLE.corps_de_ballet;
              const startDate = new Date(session.starts_at);
              const dateStr = startDate.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
              const timeStr = startDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
              const isPast = startDate < new Date();

              return (
                <div key={session.id} style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 16, overflow: "hidden" }}>
                  {/* Header row */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
                    borderBottom: "1px solid #f9f7f6",
                  }}>
                    {/* Cover */}
                    <div style={{
                      width: 64, height: 42, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                      background: "linear-gradient(145deg, #fce7f3, #f9a8d4)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {session.cover_image_url ? (
                        <img src={session.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                          <circle cx="10" cy="10" r="8" stroke="rgba(190,24,93,0.5)" strokeWidth="1.5" />
                          <polygon points="8,7 14,10 8,13" fill="rgba(190,24,93,0.6)" />
                        </svg>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1c1917" }}>
                          {session.title_i18n.es ?? session.slug}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
                          background: st.bg, color: st.color,
                        }}>{st.label}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
                          background: tier.bg, color: tier.color,
                        }}>{tier.label}</span>
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#a8a29e", flexWrap: "wrap" }}>
                        <span style={{ color: isPast ? "#a8a29e" : "#1c1917", fontWeight: isPast ? 400 : 600 }}>
                          {dateStr} a las {timeStr}
                        </span>
                        <span>{session.bookings_count} / {session.capacity} reservas</span>
                        {session.access_link && (
                          <span style={{ color: "#059669", fontWeight: 600 }}>Zoom OK</span>
                        )}
                      </div>
                    </div>

                    {/* Quick status change */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {session.status === "draft" && (
                        <form action={updateStatusAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <input type="hidden" name="status" value="scheduled" />
                          <button type="submit" style={{
                            fontSize: 10, fontWeight: 700, padding: "5px 13px", borderRadius: 99,
                            background: "#dcfce7", color: "#166534", border: "none", cursor: "pointer",
                          }}>Publicar</button>
                        </form>
                      )}
                      {session.status === "scheduled" && (
                        <form action={updateStatusAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <input type="hidden" name="status" value="completed" />
                          <button type="submit" style={{
                            fontSize: 10, fontWeight: 700, padding: "5px 13px", borderRadius: 99,
                            background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer",
                          }}>Completar</button>
                        </form>
                      )}
                      {(session.status === "draft" || session.status === "scheduled") && (
                        <form action={updateStatusAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <input type="hidden" name="status" value="canceled" />
                          <button type="submit" style={{
                            fontSize: 10, fontWeight: 700, padding: "5px 13px", borderRadius: 99,
                            background: "#fee2e2", color: "#991b1b", border: "none", cursor: "pointer",
                          }}>Cancelar</button>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Collapsible edit form */}
                  <details>
                    <summary style={{
                      listStyle: "none", cursor: "pointer",
                      padding: "10px 20px", fontSize: 11, fontWeight: 600, color: "#78716c",
                      userSelect: "none", display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 4.5h8M2 7.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      Editar sesion
                    </summary>
                    <div style={{ padding: "20px 22px", borderTop: "1px solid #f9f7f6" }}>
                      <LiveForm session={session} />
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
