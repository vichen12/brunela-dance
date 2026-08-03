import {
  deleteProgramAction,
  deleteProgramDayAction,
  upsertProgramAction,
  upsertProgramDayAction
} from "@/src/features/admin/actions";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ProgramRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: "solista" | "principal";
  status: "draft" | "published" | "archived";
  duration_days: number;
  cover_image_url: string | null;
  is_featured: boolean;
};

type ProgramDayRecord = { id: string; program_id: string; day_number: number; video_id: string };
type VideoLookup = { id: string; slug: string; title_i18n: Record<string, string> | null };

// ── Estilos compartidos con el resto del panel ────────────────────────────────
//
// Esta pantalla era la unica que seguia con el lenguaje visual viejo: cabecera
// `panel rounded-[36px]`, tarjetas `bg-white/76` y clases de Tailwind sueltas,
// mientras las otras nueve usaban hero-stage y tarjetas blancas con borde
// #f0eeec. Al entrar acá se notaba que era otro producto.

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  published: { bg: "#dcfce7", color: "#166534", label: "Publicado" },
  draft:     { bg: "#fef9c3", color: "#854d0e", label: "Borrador" },
  archived:  { bg: "#f1f5f9", color: "#475569", label: "Archivado" },
};

const TIER_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  solista:   { bg: "var(--pink-soft)", color: "var(--pink-deep)", label: "Solista" },
  principal: { bg: "#1c1917", color: "var(--pink-wash)", label: "Principal" },
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

const tarjeta: React.CSSProperties = {
  background: "#fff", border: "1px solid #f0eeec", borderRadius: 16,
};

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#78716c", textTransform: "uppercase", marginBottom: 5 }}>
      {children}
    </span>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column" }}><Lbl>{label}</Lbl>{children}</label>;
}

function Flash({ msg, tone }: { msg: string | null; tone: "ok" | "err" }) {
  if (!msg) return null;
  return (
    <div style={{
      borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 600, marginBottom: 20,
      background: tone === "ok" ? "#f0fdf4" : "#fef2f2",
      color: tone === "ok" ? "#166534" : "#991b1b",
      border: `1px solid ${tone === "ok" ? "#bbf7d0" : "#fecaca"}`,
    }}>{msg}</div>
  );
}

const tituloDe = (v: VideoLookup | undefined, fallback: string) =>
  v ? (v.title_i18n?.es ?? v.title_i18n?.en ?? v.slug) : fallback;

// ── Página ────────────────────────────────────────────────────────────────────

export default async function AdminProgramsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const [{ data: programsData }, { data: programDaysData }, { data: videosData }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, slug, title_i18n, description_i18n, membership_tier_required, status, duration_days, cover_image_url, is_featured")
      .order("created_at", { ascending: false }),
    supabase.from("program_days").select("id, program_id, day_number, video_id").order("day_number", { ascending: true }),
    // title_i18n hace falta para que el selector de clases muestre titulos y no
    // slugs. Se ordena por titulo para que la lista se pueda recorrer con la vista.
    supabase.from("videos").select("id, slug, title_i18n").order("title_i18n->>es", { ascending: true })
  ]);

  const programs = (programsData ?? []) as ProgramRecord[];
  const programDays = (programDaysData ?? []) as ProgramDayRecord[];
  const videos = (videosData ?? []) as VideoLookup[];
  const videoById = new Map(videos.map((v) => [v.id, v]));
  const publicados = programs.filter((p) => p.status === "published").length;

  return (
    <main style={{ fontFamily: "inherit" }}>
      <header className="hero-stage">
        <p className="eyebrow">Gestión de contenido</p>
        <h1 className="display mt-5 text-5xl leading-none md:text-6xl">Programas.</h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
          Recorridos de varios días. Cada día lleva una clase, y la alumna avanza en orden.
        </p>
      </header>

      <Flash msg={success} tone="ok" />
      <Flash msg={error} tone="err" />

      {/* Resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { value: programs.length, label: "Programas", sub: "creados" },
          { value: publicados, label: "Publicados", sub: "visibles para las alumnas" },
          { value: programDays.length, label: "Días", sub: "cargados en total" },
        ].map((s) => (
          <div key={s.label} style={{ ...tarjeta, padding: "20px 22px" }}>
            <p style={{ fontSize: 30, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#44403c", marginTop: 6 }}>{s.label}</p>
            <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Nuevo programa */}
      <details style={{ ...tarjeta, marginBottom: 20, overflow: "hidden" }}>
        <summary style={{
          listStyle: "none", cursor: "pointer", userSelect: "none",
          display: "flex", alignItems: "center", gap: 12, padding: "16px 22px",
          fontSize: 13, fontWeight: 700, color: "#1c1917",
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: 8, background: "var(--pink)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 16, fontWeight: 800, flexShrink: 0,
          }}>+</span>
          Nuevo programa
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#a8a29e", fontWeight: 500 }}>
            Clic para desplegar
          </span>
        </summary>
        <div style={{ borderTop: "1px solid #f0eeec", padding: "22px" }}>
          <ProgramForm actionLabel="CREAR PROGRAMA" />
        </div>
      </details>

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {programs.length === 0 && (
          <div style={{ ...tarjeta, padding: "40px 24px", textAlign: "center", color: "#a8a29e", fontSize: 13 }}>
            Todavía no hay programas. Creá el primero arriba.
          </div>
        )}

        {programs.map((program) => {
          const days = programDays.filter((d) => d.program_id === program.id);
          const st = STATUS_STYLE[program.status] ?? STATUS_STYLE.draft;
          const tier = TIER_STYLE[program.membership_tier_required] ?? TIER_STYLE.solista;

          return (
            <details key={program.id} style={{ ...tarjeta, overflow: "hidden" }}>
              <summary style={{
                listStyle: "none", cursor: "pointer", userSelect: "none",
                display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1c1917" }}>
                    {program.title_i18n?.es ?? program.slug}
                  </p>
                  <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>
                    {days.length} de {program.duration_days} días cargados
                  </p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: tier.bg, color: tier.color }}>
                  {tier.label}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: st.bg, color: st.color }}>
                  {st.label}
                </span>
                {program.is_featured && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: "var(--pink-wash)", color: "var(--pink-deep)" }}>
                    Destacado
                  </span>
                )}
              </summary>

              <div style={{ borderTop: "1px solid #f0eeec", padding: "22px" }}>
                <ProgramForm actionLabel="GUARDAR CAMBIOS" program={program} />

                {/* Días */}
                <div style={{ marginTop: 26, borderTop: "1px solid #f0eeec", paddingTop: 20 }}>
                  <Lbl>Días del programa</Lbl>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                    {days.length === 0 && (
                      <p style={{ fontSize: 12.5, color: "#a8a29e" }}>
                        Todavía no hay días. Agregá el primero abajo.
                      </p>
                    )}
                    {days.map((day) => (
                      <div key={day.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 14, borderRadius: 12, border: "1px solid #f0eeec",
                        background: "#fafaf9", padding: "10px 14px",
                      }}>
                        <span style={{ fontSize: 13, color: "#1c1917" }}>
                          <strong style={{ fontWeight: 700 }}>Día {day.day_number}</strong>
                          {/* El titulo, no el slug: Brunela no tiene por que saber
                              que "demo-barra-suelo-i" es "Barra de suelo I". */}
                          <span style={{ color: "#78716c" }}> — {tituloDe(videoById.get(day.video_id), day.video_id)}</span>
                        </span>
                        <form action={deleteProgramDayAction}>
                          <input name="id" type="hidden" value={day.id} />
                          <button type="submit" style={{
                            background: "transparent", color: "#ef4444", border: "1px solid #fecaca",
                            borderRadius: 99, padding: "5px 14px", fontSize: 10, fontWeight: 700,
                            letterSpacing: "0.08em", cursor: "pointer",
                          }}>QUITAR</button>
                        </form>
                      </div>
                    ))}
                  </div>

                  <form action={upsertProgramDayAction} style={{
                    display: "grid", gridTemplateColumns: "120px 1fr auto",
                    gap: 12, alignItems: "end", marginTop: 14,
                  }}>
                    <input name="programId" type="hidden" value={program.id} />
                    <F label="Día número">
                      <input style={inp} min={1} max={program.duration_days} name="dayNumber" required type="number" />
                    </F>
                    <F label="Clase de ese día">
                      {/* Antes era un input donde habia que escribir el slug de
                          memoria. El datalist autocompletaba, pero listaba slugs:
                          en la practica, memorizar codigos. */}
                      <select style={sel} name="videoSlug" required defaultValue="">
                        <option value="" disabled>Elegí una clase…</option>
                        {videos.map((v) => (
                          <option key={v.id} value={v.slug}>{tituloDe(v, v.slug)}</option>
                        ))}
                      </select>
                    </F>
                    <button type="submit" style={{
                      background: "var(--pink)", color: "#fff", border: "none", borderRadius: 99,
                      padding: "9px 20px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}>AGREGAR DÍA</button>
                  </form>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </main>
  );
}

// ── Formulario ────────────────────────────────────────────────────────────────

function ProgramForm({ actionLabel, program }: { actionLabel: string; program?: ProgramRecord }) {
  const esNuevo = !program;

  return (
    <form action={upsertProgramAction}>
      <input name="id" type="hidden" value={program?.id ?? ""} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label={esNuevo ? "Dirección del programa" : "Dirección"}>
          {/* Al editar es solo lectura: cambiarla rompe cualquier enlace ya
              compartido. Al crear hace falta, porque todavia no existe. */}
          <input
            style={esNuevo ? inp : { ...inp, background: "#fafaf9", color: "#78716c" }}
            defaultValue={program?.slug ?? ""}
            name="slug"
            required
            readOnly={!esNuevo}
            placeholder="fundamentos-7-dias"
          />
        </F>

        <F label="Cuántos días dura">
          <input style={inp} defaultValue={program?.duration_days ?? 14} min={1} name="durationDays" required type="number" />
        </F>

        <F label="Título en español">
          <input style={inp} defaultValue={program?.title_i18n?.es ?? ""} name="titleEs" required placeholder="Fundamentos en 7 días" />
        </F>

        <F label="Título en inglés">
          <input style={inp} defaultValue={program?.title_i18n?.en ?? ""} name="titleEn" placeholder="Fundamentals in 7 days" />
        </F>

        <F label="Plan que lo puede ver">
          <select style={sel} defaultValue={program?.membership_tier_required ?? "solista"} name="membershipTierRequired">
            <option value="solista">Solista</option>
            <option value="principal">Principal</option>
          </select>
        </F>

        <F label="Estado">
          <select style={sel} defaultValue={program?.status ?? "draft"} name="status">
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>
        </F>

        <F label="Imagen de portada">
          <input style={inp} defaultValue={program?.cover_image_url ?? ""} name="coverImageUrl" placeholder="https://..." />
        </F>

        <div style={{ display: "flex", alignItems: "center", paddingTop: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input defaultChecked={program?.is_featured ?? false} name="isFeatured" type="checkbox" style={{ width: 16, height: 16, accentColor: "var(--pink)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#44403c" }}>Destacar este programa</span>
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <F label="Descripción en español">
          <textarea style={{ ...inp, minHeight: 78, resize: "vertical" }} defaultValue={program?.description_i18n?.es ?? ""} name="descriptionEs" required placeholder="Qué trabaja este programa…" />
        </F>
        <F label="Descripción en inglés">
          <textarea style={{ ...inp, minHeight: 78, resize: "vertical" }} defaultValue={program?.description_i18n?.en ?? ""} name="descriptionEn" />
        </F>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button type="submit" style={{
          background: esNuevo ? "var(--pink)" : "#1c1917", color: "#fff", border: "none",
          borderRadius: 99, padding: "10px 24px", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.1em", cursor: "pointer",
        }}>{actionLabel}</button>

        {!esNuevo && (
          <button type="submit" formAction={deleteProgramAction} style={{
            background: "transparent", color: "#ef4444", border: "1px solid #fecaca",
            borderRadius: 99, padding: "10px 22px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", cursor: "pointer",
          }}>ELIMINAR</button>
        )}
      </div>
    </form>
  );
}
