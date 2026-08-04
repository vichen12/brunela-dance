export default function LibraryLoading() {
  // La animacion vive en globals.css (.sk). Antes cada loading.tsx traia
  // su propia copia del @keyframes: tres definiciones de lo mismo.
  const pulse = { borderRadius: 12 } as React.CSSProperties;

  return (
    <>
      <main className="pb-20 pt-6 md:pb-10 md:pt-10">
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ marginBottom: 24 }}>
            <div className="sk" style={{ ...pulse, height: 10, width: 80, marginBottom: 10 }} />
            <div className="sk" style={{ ...pulse, height: 32, width: 240, marginBottom: 8 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="sk" style={{ ...pulse, borderRadius: 16, aspectRatio: "16/9" }} />
                <div className="sk" style={{ ...pulse, height: 14, width: "80%" }} />
                <div className="sk" style={{ ...pulse, height: 10, width: "50%", borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
