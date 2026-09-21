# COORDINACIÓN ENTRE SESIONES — cerrado el 2026-09-21

> **Este archivo ya cumplió su función.** Existió mientras dos sesiones trabajaban
> en paralelo sobre el mismo repositorio. Las dos ramas se juntaron en `main` el
> 2026-09-21 y no hay nada más que coordinar.
>
> Se conserva porque el **cómo** sirve: si alguna vez vuelven a trabajar dos
> sesiones a la vez, acá está lo que funcionó y lo que costó caro.

---

## Qué pasó

| Sesión | Alcance | Rama |
|---|---|---|
| **A · Planes de trabajo** | formulario de clases, planes, `programs`, `/admin/programs`, `/dashboard/programs` | `planes-de-trabajo` |
| **B · Portada** | FAQ, tráiler y certificados editables, landing, `/admin/portada` | `main` |

Cuatro migraciones, **las cuatro aplicadas y verificadas** antes del merge:

- `20260917_portada_editable.sql` — B. `landing_texts`, `landing_faq`, dos vistas y el bucket `landing-media`.
- `20260921_formulario_de_clases.sql` — A. `videos.content_type`, `videos.planes_permitidos`, reescribe la policy del catálogo y renueva las categorías.
- `20260921_2_vaciar_planes_no_se_repara.sql` — A.
- `20260921_3_la_lista_vacia_ahora_si_se_rechaza.sql` — A.

Las dos últimas salieron de un agujero que encontró `test:aislamiento`, no una
persona leyendo: vaciar `planes_permitidos` **ensanchaba el acceso en silencio**,
y al taparlo se destapó que el CHECK de la lista vacía nunca había funcionado
(`array_length('{}', 1)` es NULL, y un CHECK con NULL deja pasar). El detalle
completo está en `CLAUDE.md`.

---

## Las tres lecciones que valieron el dolor

### 1. Un worktree no alcanza para dos ramas

Las dos sesiones arrancaron compartiendo directorio. Git permite **una rama por
worktree**, así que cuando una creó su rama, la otra se la encontró debajo de los
pies sin haber hecho nada.

Lo que lo resolvió fue `git worktree add`: cada sesión en su carpeta y su rama.
A partir de ahí **dejó de ser posible pisarse un archivo**, y el merge final tuvo
un solo conflicto — este archivo.

Si se repite: separar los worktrees **desde el principio**, no cuando aparece el
primer choque.

### 2. `git commit` sin rutas se lleva TODO el índice

El error más caro de la sesión. Con las dos sesiones en el mismo directorio:

```bash
git add COORDINACION.md      # se agrega UN archivo
git commit -m "..."          # se commitean los 35 que estaban staged
```

La otra sesión tenía su trabajo en el índice en ese instante y entró entero, bajo
un mensaje que hablaba de otra cosa. Y de paso puso en `main` código que dependía
de una migración sin correr.

**Commitear siempre con rutas explícitas:** `git commit -- archivo1 archivo2`.

### 3. Una lista de archivos tomados envejece en minutos

La primera versión de este archivo listaba qué archivo tenía tomado cada sesión.
Quedó desactualizada casi enseguida: el trabajo real toca archivos que nadie
previó. Lo que sí sirvió fue declarar **zonas** — «la landing es de B», «programs
es de A» — y, sobre todo, separar los worktrees, que convierte el acuerdo en algo
que la herramienta garantiza en vez de algo que hay que recordar.

---

## Lo que quedó pendiente después del merge

- [ ] **Desduplicar iconos en `app/page.tsx`**: `PersonStanding` aparece dos
      veces (Método y «Sobre mí») y `Sparkles` otras dos. Es la razón de fondo
      por la que la página se sentía plantilla.
- [ ] **Anotar en `CLAUDE.md` como mejora futura**: los textos del hero y de las
      secciones en 4 idiomas editables desde el panel, con traducción asistida.
      Quedó fuera de alcance a propósito — son ~42 campos × 4 idiomas, lo más
      trabajoso de construir y lo que menos se toca.
