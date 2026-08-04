export default function LiveLoading() {
  // La animacion vive en globals.css (.sk). Antes cada loading.tsx traia
  // su propia copia del @keyframes: tres definiciones de lo mismo.
  const pulse = { borderRadius: 12 } as React.CSSProperties;

  return (
    <>
      <main className="pb-20 pt-6 md:pb-10 md:pt-10">
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ marginBottom: 28 }}>
            <div className="sk" style={{ ...pulse, height: 10, width: 100, marginBottom: 10 }} />
            <div className="sk" style={{ ...pulse, height: 32, width: 200 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="sk" style={{ ...pulse, borderRadius: 20, height: 100 }} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
