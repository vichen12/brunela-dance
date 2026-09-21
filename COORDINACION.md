# COORDINACIÓN ENTRE SESIONES

Dos sesiones de Claude Code trabajando en paralelo sobre este repo.
**Antes de editar un archivo, buscalo acá.** Si figura en la lista de la otra
sesión, no lo toques: avisá y esperá.

Última actualización: **2026-09-21**, por la sesión **Planes de trabajo**.

---

## 🔴 LEER PRIMERO: hay UN SOLO worktree

```
$ git worktree list
C:/Users/viche/.../brunela   [main]     <- uno solo, compartido
```

Las dos sesiones comparten **el mismo directorio y la misma rama activa**. No hay
dos copias: si una cambia de rama, la otra cambia con ella.

**La rama activa ahora es `planes-de-trabajo`.** La creé para no dejar en `main`
código que depende de una migración que todavía no corrió (ver abajo).

👉 **Sesión de la portada: tus commits van a caer en `planes-de-trabajo`, no en
`main`.** Si preferís seguir en main:

```bash
git checkout main          # mi trabajo queda guardado en la rama, no se pierde
```

Si ya commiteaste algo de portada en `planes-de-trabajo`, se rescata con
`git cherry-pick <sha>` desde main. No hay nada roto, solo mal ubicado.

---

## Sesión A — Planes de trabajo  ⟨activa⟩

**Alcance:** `programs`, `program_days`, `/dashboard/programs`, `/admin/programs`
y su migración. **No toco nada de portada ni de landing.**

**Rama:** `planes-de-trabajo` · **Último commit mío:** ver `git log`

### Archivos que tengo tomados

Míos, creados en esta sesión:

| Archivo | Qué es |
|---|---|
| `src/features/studio/catalogo-clases.ts` | vocabulario de una clase (tipo, categoría, nivel, materiales, planes) |
| `src/features/admin/planes-de-trabajo.ts` | planes vistos desde una clase + primer día libre |
| `components/selector-multiple.tsx` | selección múltiple en fichas |
| `components/bloque-solo-para-vos.tsx` | recuadro de campos internos |
| `components/clase-en-planes.tsx` | a qué planes pertenece una clase |
| `supabase/migrations/20260921_formulario_de_clases.sql` | **sin correr** |
| `tests/aislamiento/planes.test.ts` | combinación libre de planes |

Modificados por mí:

```
app/admin/analiticas/page.tsx        components/admin-header.tsx
app/admin/page.tsx                   components/admin-program-drawer.tsx
app/admin/programs/loading.tsx       components/admin-sidebar.tsx
app/admin/programs/page.tsx          components/admin-video-drawer.tsx
app/admin/videos/page.tsx            components/admin-video-upload.tsx
app/api/admin/videos/finalize/route.ts   components/boton-enviar.tsx
app/dashboard/library/[slug]/page.tsx    components/mobile-dashboard-nav.tsx
app/dashboard/library/page.tsx       components/plan-client.tsx
app/dashboard/page.tsx               components/studio-sidebar.tsx
app/dashboard/programs/[slug]/page.tsx   src/features/admin/actions.ts
app/dashboard/programs/loading.tsx   src/features/admin/dictionary.ts
app/dashboard/programs/page.tsx      src/features/studio/helpers.ts
CLAUDE.md                            tests/aislamiento/ayudantes.ts
                                     tests/sistema/plata-y-acceso.test.ts
```

⚠️ **`CLAUDE.md` lo escribimos las dos.** Está en la lista porque ya lo edité,
pero no lo reclamo en exclusiva: es de las dos. Editalo, pero **en tu propia
sección** y releelo antes, que ya se movió.

⚠️ **`src/features/admin/actions.ts` es un archivo compartido de hecho**: tiene
las actions de videos, programas, ajustes y usuarios. Yo toqué solo las de
videos y las dos nuevas de `program_days`. Si necesitás otra, avisá.

### 🔴 Migración pendiente

`supabase/migrations/20260921_formulario_de_clases.sql` — **escrita, sin correr.**
La corre el dueño del proyecto en el SQL Editor de Supabase, **sin `begin;` /
`commit;`** (trampa 7 de CLAUDE.md) y **al final de todo** (trampa 8: redefine
`videos_select_allowed_by_tier`, que ya se reescribió tres veces).

Mientras no corra:

- `/admin/videos` no puede guardar — la columna `planes_permitidos` no existe
- `npm run test:aislamiento` da **14 en rojo**, con el mensaje que lo dice
- los otros **112 siguen en verde**: no rompí nada de lo que ya andaba

### Qué me falta

- [ ] **Correr la migración** (la corre el dueño) y después `npm run test:aislamiento` → tienen que dar 126
- [ ] **`npm run build`** — no lo corrí: hay un dev server levantado en el 3000 y
      un build en el mismo directorio pisa `.next` y rompe el login
      (ya pasó dos veces, está en CLAUDE.md). `tsc` está limpio
- [ ] Seguir con Planes de trabajo: es lo único que tengo asignado

---

## Sesión B — Portada / landing

**Esta sección la completa esa sesión.** Lo de abajo es lo que deduje mirando
git, no lo que ella declaró: **corregilo.**

**Archivos que veo tocados** (commits `23169a2..6419681`):

```
app/globals.css                      components/ultimo-estudio.tsx
app/proximamente/page.tsx            public/fotos-landing/*.jpg
components/navbar.tsx                public/fotos-landing/hero-mobile.avif
components/ui/arc-gallery-hero-component.tsx
scripts/verificar-guardas.mjs
```

**Sin commitear, y no lo toqué:** `scripts/verificar-portada.mjs` — consulta
`landing_texts` y `landing_faq`, que parecen tablas de una migración suya
todavía sin correr. **No lo staged ni lo commiteé: es tuyo.**

**Migración pendiente:** ⟨completar⟩

**Qué le falta:** ⟨completar⟩

---

## Lo que NO se pisa

| Zona | De quién |
|---|---|
| `app/page.tsx`, `components/navbar.tsx`, `components/ui/*`, `public/fotos-landing/`, `app/proximamente/`, `app/globals.css` | **Sesión B** — no lo toco |
| `app/dashboard/programs/`, `app/admin/programs/`, `components/admin-program-drawer.tsx`, `components/clase-en-planes.tsx` | **Sesión A** |
| `CLAUDE.md`, `src/features/admin/actions.ts`, `COORDINACION.md` | **compartidos** — releer antes de escribir |

### Las dos migraciones no se pisan entre sí

La mía toca `videos`, `programs` y `categories`. La de la portada parece crear
`landing_texts` y `landing_faq`, que son tablas nuevas. **Pueden correrse en
cualquier orden**, pero cada una respetando su propio orden interno.

⚠️ Cuando las dos estén, `npm run verificar` va a contar más tablas. Si el
conteo no cuadra, es porque falta correr una de las dos — no porque haya una
tabla sin RLS.
