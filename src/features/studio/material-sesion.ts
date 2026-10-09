/**
 * Los ids de documentos adjuntos a una sesion en vivo, que viven en
 * `live_sessions.metadata.documentos` (ver src/features/admin/live-material-actions.ts).
 *
 * Funcion comun, NO server action: vive fuera del archivo "use server" porque
 * todo lo que se exporta de uno de esos es un endpoint POST publico.
 * Lo que no sea un uuid se descarta: el metadata es jsonb libre.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idsMaterial(metadata: unknown): string[] {
  const crudo = (metadata as { documentos?: unknown } | null)?.documentos;
  if (!Array.isArray(crudo)) return [];
  return Array.from(new Set(crudo.filter((x): x is string => typeof x === "string" && UUID.test(x))));
}
