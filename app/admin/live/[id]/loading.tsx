import { Sk, SkFilas, SkTarjeta } from "@/components/skeleton";

/** Perfil de una sesion: cabecera con portada y dos columnas. */
export default function Loading() {
  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Sk h={38} w={170} r={99} />
      <SkTarjeta style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Sk h={220} w={360} r={24} />
        <div style={{ flex: 1, minWidth: 220, display: "grid", gap: 12, alignContent: "center" }}>
          <Sk h={24} w={180} r={99} />
          <Sk h={40} w="70%" r={12} />
          <Sk h={16} w="45%" />
          <Sk h={60} w={340} r={20} />
          <Sk h={44} w={260} r={99} />
        </div>
      </SkTarjeta>
      <SkFilas n={5} />
    </main>
  );
}
