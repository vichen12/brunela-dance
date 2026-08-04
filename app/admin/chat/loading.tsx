import { Sk, SkChat } from "@/components/skeleton";

/** Chat de admin: pestanas arriba y la conversacion abajo. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <div style={{ display: "flex", gap: 8, padding: "0 0 18px" }}>
        {[92, 116, 104, 100].map((w, i) => <Sk key={i} h={38} w={w} r={999} />)}
      </div>
      <div style={{ height: "calc(100vh - 120px)", border: "1.5px solid #f0eeec", borderRadius: 18, overflow: "hidden" }}>
        <SkChat />
      </div>
    </main>
  );
}
