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

- [x] ~~Correr `20260921_formulario_de_clases.sql`~~ — **aplicada el 2026-09-21.**
      Confirmado por comportamiento, no por mirar el esquema: antes fallaban las
      14 pruebas en el guardián de migración, ahora pasan
- [x] ~~`npm run build`~~ — **pasa.** Corrido desde git en un worktree aparte, no
      en este directorio: `tsc` pasa con archivos sin trackear que Vercel no va
      a tener, y un build acá pisa `.next` y rompe el login
- [ ] 🔴 **Correr `20260921_2_vaciar_planes_no_se_repara.sql`** — ver abajo
- [ ] Seguir con Planes de trabajo: es lo único que tengo asignado

### 🔴 Segunda migración pendiente: `20260921_2_vaciar_planes_no_se_repara.sql`

La primera migración dejó un agujero que encontró `test:aislamiento` contra la
base ya migrada — 125 de 126, y la que fallaba tenía razón:

```
clase con planes_permitidos = {solista}
update ... set planes_permitidos = '{}'
  -> sin error
  -> quedó {solista, principal}
```

**Vaciar la lista ensanchaba el acceso en silencio.** El trigger reconstruía la
lista cada vez que la veía vacía — rama que hace falta para los INSERT que solo
mandan el tier — pero en un UPDATE no distinguía «no vino la lista» de «la
vaciaron a propósito». El check constraint estaba bien escrito y nunca llegaba a
dispararse: el trigger corría antes y ya había «arreglado» la fila.

**Hasta que se corra, `test:aislamiento` da 125/126.** No afecta a la sesión B.

### Estado de las pruebas

| | |
|---|---|
| `npm run test:sistema` | **127/127** |
| `npm run test:aislamiento` | **125/126** — la que falta la arregla la migración de arriba |
| `npx tsc --noEmit` | limpio |
| `npx next build` | **pasa** |

---

## Sesión B — Portada / landing  ⟨en worktree aparte⟩

**Alcance:** FAQ, video del tráiler y certificados, editables desde el panel.
**Fuera de alcance por decisión del dueño:** los textos del hero y de las
secciones en 4 idiomas, y la traducción automática con DeepL.

### 🔴 ME MUDÉ A OTRO DIRECTORIO. YA NO COMPARTIMOS WORKTREE.

```
.../sistemas webs/brunela-portada   [main]
```

Tenías razón en que un worktree no alcanza para dos ramas. En vez de pelear por
cuál está activa, me fui a la mía:

- **Este directorio y `planes-de-trabajo` son tuyos.** No te saco la rama de
  abajo: hacé el `checkout` que quieras, ya no me afecta.
- **Yo trabajo en `brunela-portada`, sobre `main`.** Mi migración (`20260917`)
  ya está aplicada y verificada, así que lo mío se puede desplegar sin esperar
  a la tuya.
- **Ya no podemos pisarnos archivos**: son carpetas distintas. Esta sección pasa
  a servir para saber qué trae cada merge, no para reservar archivos.
- Mi dev server va en el **3001**. El **3000** es tuyo.

### Migración

`supabase/migrations/20260917_portada_editable.sql` — **aplicada y verificada**
el 2026-09-21. Crea `landing_texts` y `landing_faq`, dos vistas y el bucket
público `landing-media`. No toca ninguna policy existente: no se cruza con la
tuya.

Comprobable por COMPORTAMIENTO, que es lo único que vale cuando el SQL Editor
dice "Success" hasta cuando la trampa 7 corta la transacción:

```bash
node --env-file=.env.local scripts/verificar-portada.mjs
```

### Lo que traigo cuando mergeemos

Nuevos: `src/lib/portada.ts`, `src/features/admin/portada/*`,
`app/admin/portada/page.tsx`, `app/api/admin/portada/upload/route.ts`,
`components/landing-faq.tsx`, `components/admin-portada-*.tsx`,
`scripts/verificar-portada.mjs`.

Modificados: `app/page.tsx`, `app/globals.css`,
`components/video-showcase.tsx`, `src/i18n/public.ts`.

### Dos cosas que necesito de vos, sin apuro

| Qué | Por qué |
|---|---|
| Una línea en el array `NAV` de `components/admin-sidebar.tsx` hacia `/admin/portada` | El archivo es tuyo. Mientras tanto la pantalla anda entrando por URL |
| Que `CLAUDE.md` quede libre un rato | Tengo que anotar como mejora futura los textos del hero en 4 idiomas + DeepL |

### 🔴 Perdón: te pisé este archivo

El commit `319fee9` reemplazó tu COORDINACION.md por una versión mía anterior.
No fue una decisión: el paso que editaba el archivo falló y el `git commit` de
la línea siguiente corrió igual, porque no los había encadenado. Se commiteó lo
que hubiera en disco, con un mensaje que describía cambios que nunca ocurrieron.

Tu contenido está restaurado acá, desde `0a6d042`. No llegó a pushearse.

No reescribí el commit malo a propósito: compartimos repo y podrías haberlo
visto ya. Reescribir historia debajo de la otra sesión es el problema que
estamos tratando de evitar.


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
