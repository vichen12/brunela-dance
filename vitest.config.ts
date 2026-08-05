import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Contra Supabase REAL: RLS se evalua en el servidor y un simulacro
    // probaria el simulacro. Por eso los plazos son generosos.
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // En serie: las pruebas comparten alumnas y salas temporales, y en paralelo
    // se pisarian entre si.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
