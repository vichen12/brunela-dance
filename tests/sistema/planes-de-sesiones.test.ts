import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizarPlanes, planesDesde, planesEnTexto, planMinimo } from "../../src/features/studio/planes-de-sesion";

describe("planes de una sesion en vivo (20261109)", () => {
  it("los textos que ve Brunela", () => {
    expect(planesEnTexto(["corps_de_ballet", "solista", "principal"])).toBe("Todos los planes");
    expect(planesEnTexto(["principal"])).toBe("Solo Principal");
    expect(planesEnTexto(["corps_de_ballet"])).toBe("Solo Corps de Ballet");
    expect(planesEnTexto(["corps_de_ballet", "principal"])).toBe("Corps de Ballet y Principal");
  });

  it("la regla vieja, para las sesiones de antes de la migracion", () => {
    expect(planesDesde("corps_de_ballet")).toEqual(["corps_de_ballet", "solista", "principal"]);
    expect(planesDesde("solista")).toEqual(["solista", "principal"]);
    expect(planesDesde("principal")).toEqual(["principal"]);
  });

  it("lo que manda el formulario se limpia: sin 'none', sin repetidos, en orden", () => {
    expect(normalizarPlanes(["principal", "none", "corps_de_ballet", "principal", "otra"])).toEqual(["corps_de_ballet", "principal"]);
    expect(planMinimo(["solista", "principal"])).toBe("solista");
  });
});

describe("la migracion cambia SOLO la condicion de plan en los tres lugares", () => {
  const sql = readFileSync("supabase/migrations/20261109_planes_de_sesiones_en_vivo.sql", "utf8");
  const sinComentarios = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

  it("sin begin/commit (trampa 7) y la lista vacia se rechaza con cardinality", () => {
    expect(sinComentarios).not.toMatch(/^\s*(begin|commit);/m);
    expect(sinComentarios).toMatch(/cardinality\(planes_permitidos\) >= 1/);
    expect(sinComentarios).not.toMatch(/array_length\(planes_permitidos/);
  });

  it("ninguno de los tres sigue comparando rangos contra el plan minimo", () => {
    expect(sinComentarios).not.toMatch(/>= public\.membership_tier_rank\(membership_tier_required\)/);
    expect(sinComentarios).not.toMatch(/< public\.membership_tier_rank\(session_record\.membership_tier_required\)/);
    // Los tres lugares de acceso; el CHECK que prohibe 'none' no cuenta.
    expect(sinComentarios.match(/planes_permitidos @> array\[(?!'none')/g)?.length).toBe(3);
  });

  it("lo que NO tiene que cambiar sigue ahi: invitaciones, ventana, cupo y reserva para el enlace", () => {
    expect(sinComentarios).toMatch(/or public\.current_user_is_invited_to_live_session\(id\)/);
    expect(sinComentarios).toMatch(/Booking window has not opened yet/);
    expect(sinComentarios).toMatch(/Booking window is closed/);
    expect(sinComentarios).toMatch(/Live session is full/);
    expect(sinComentarios).toMatch(/reveal_link_only_to_booked_users/);
    expect(sinComentarios).toMatch(/status in \('scheduled', 'completed'\)/);
  });
});
