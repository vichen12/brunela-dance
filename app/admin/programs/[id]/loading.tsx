import { Sk } from "@/components/skeleton";

/** Editor de plan: datos a la izquierda, dias a la derecha. */
export default function Loading() {
  return (
    <main style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
      <Sk h={560} r={28} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Sk h={96} r={28} />
        {Array.from({ length: 6 }, (_, i) => <Sk key={i} h={74} r={22} />)}
      </div>
    </main>
  );
}
