# COORDINACIÓN

Dos sesiones trabajando en el mismo árbol al mismo tiempo. Este archivo dice
**quién tiene tomado qué**, para que nadie pise a nadie.

> **Regla:** antes de editar un archivo, buscalo acá. Si figura como tomado por
> la otra sesión, **no lo toques** — anotalo abajo en *Bloqueos* y seguí con
> otra cosa.
>
> Y commiteá seguido. Un archivo sin commitear no se puede recuperar si el otro
> lo pisa: los archivos **nuevos** ni siquiera están en el historial de git.

Actualizado: 2026-09-21

---

## Sesión A — Planes de trabajo

Formulario de clases y planes de trabajo (lo que antes se llamaba "programas").

**Migración propia:** `supabase/migrations/20260921_formulario_de_clases.sql`
*(al 2026-09-21 todavía SIN correr: `videos.content_type` no existe en la base)*

| Archivos nuevos |
|---|
| `components/bloque-solo-para-vos.tsx` |
| `components/clase-en-planes.tsx` |
| `components/selector-multiple.tsx` |
| `src/features/admin/planes-de-trabajo.ts` |
| `src/features/studio/catalogo-clases.ts` |
| `tests/aislamiento/planes.test.ts` |

| Archivos modificados |
|---|
| `app/admin/analiticas/page.tsx` |
| `app/admin/page.tsx` |
| `app/admin/programs/page.tsx`, `app/admin/programs/loading.tsx` |
| `app/admin/videos/page.tsx` |
| `app/api/admin/videos/finalize/route.ts` |
| `app/dashboard/library/page.tsx`, `app/dashboard/library/[slug]/page.tsx` |
| `app/dashboard/page.tsx` |
| `app/dashboard/programs/page.tsx`, `[slug]/page.tsx`, `loading.tsx` |
| `components/admin-header.tsx` |
| `components/admin-program-drawer.tsx` |
| `components/admin-sidebar.tsx` |
| `components/admin-video-drawer.tsx` |
| `components/admin-video-upload.tsx` |
| `components/boton-enviar.tsx` |
| `components/mobile-dashboard-nav.tsx` |
| `components/plan-client.tsx` |
| `components/studio-sidebar.tsx` |
| `src/features/admin/actions.ts` |
| `src/features/admin/dictionary.ts` |
| `src/features/studio/helpers.ts` |
| `tests/aislamiento/ayudantes.ts` |
| `tests/sistema/plata-y-acceso.test.ts` |
| `CLAUDE.md` |

> Esta lista la dedujo la sesión B de `git status` el 2026-09-21 10:55, porque
> el archivo todavía no existía. **Sesión A: corregila si falta algo** — lo que
> no esté acá, la otra sesión lo va a dar por libre.

---

## Sesión B — Portada editable (recortada)

FAQ, video del tráiler y certificados, editables desde el panel.
**Fuera de alcance por decisión:** los textos del hero y de las secciones en 4
idiomas, y la traducción automática con DeepL.

**Migración propia:** `supabase/migrations/20260917_portada_editable.sql`
*(**aplicada y verificada** el 2026-09-21 con `scripts/verificar-portada.mjs`)*

| Archivos nuevos |
|---|
| `COORDINACION.md` |
| `scripts/verificar-portada.mjs` |
| `src/lib/portada.ts` |
| `src/features/admin/portada/campos.ts` |
| `src/features/admin/portada/actions.ts` |
| `app/admin/portada/page.tsx` |
| `app/api/admin/portada/upload/route.ts` |
| `components/admin-portada-faq.tsx` |
| `components/admin-portada-media.tsx` |
| `components/landing-faq.tsx` |

| Archivos modificados |
|---|
| `app/page.tsx` |
| `app/globals.css` |
| `components/video-showcase.tsx` |
| `src/i18n/public.ts` |

**Ya commiteado por la sesión B** (no tocar sin avisar): la puerta de acceso
anticipado (`middleware.ts`, `src/lib/acceso-anticipado.ts`, `app/proximamente/`,
`app/api/acceso/`, `components/cuenta-regresiva.tsx`), las fotos de
`public/fotos-landing/`, `components/navbar.tsx`,
`components/ui/arc-gallery-hero-component.tsx`,
`components/ui/hover-footer.tsx`, `components/ultimo-estudio.tsx`,
`next.config.ts` y `scripts/verificar-guardas.mjs`.

---

## Bloqueos

Cosas que una sesión necesita y están tomadas por la otra.

| Qué | Quién lo necesita | Archivo tomado por | Estado |
|---|---|---|---|
| Enlace a `/admin/portada` en el menú lateral | B | `components/admin-sidebar.tsx` — A | ⏳ **B no lo toca.** Cuando A commitee, B agrega una línea al array `NAV`. Mientras tanto la pantalla funciona entrando por URL |
| Nota de "mejora futura: textos del hero en 4 idiomas + DeepL" | B | `CLAUDE.md` — A | ⏳ **B no lo toca.** Se agrega cuando A libere el archivo |

---

## Zonas de nadie

Archivos que ninguna de las dos tiene tomados y que, si hay que tocar, se
anotan acá primero.

- `supabase/migrations/` — cada sesión **sólo** su propia migración. Las dos
  reescriben policies distintas; si alguna necesita tocar la de la otra, se
  habla antes. ⚠️ `20260921` reescribe `videos_select_allowed_by_tier` y
  `20260917` no toca ninguna policy existente: hoy no chocan.
- `package.json` — si hace falta una dependencia nueva, avisar. Dos sesiones
  editando `package.json` a la vez dejan el `package-lock.json` inservible.
