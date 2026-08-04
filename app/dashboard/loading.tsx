export default function DashboardLoading() {
  // La animacion vive en globals.css (.sk). Antes cada loading.tsx traia
  // su propia copia del @keyframes: tres definiciones de lo mismo.
  const pulse = { borderRadius: 12 } as React.CSSProperties;

  return (
    <>
      <main style={{ minHeight: "100vh" }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "32px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Greeting skeleton */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="sk" style={{ ...pulse, height: 12, width: 160 }} />
            <div className="sk" style={{ ...pulse, height: 34, width: 280 }} />
            <div className="sk" style={{ ...pulse, height: 14, width: 220, borderRadius: 8 }} />
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 16, padding: "20px 22px" }}>
                <div className="sk" style={{ ...pulse, height: 28, width: 60, marginBottom: 10 }} />
                <div className="sk" style={{ ...pulse, height: 12, width: 120 }} />
              </div>
            ))}
          </div>

          {/* Continue watching */}
          <div style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f9f7f6" }}>
              <div className="sk" style={{ ...pulse, height: 10, width: 120 }} />
            </div>
            <div style={{ display: "flex", height: 88 }}>
              <div style={{ width: 140, flexShrink: 0, ...pulse, borderRadius: 0 }} />
              <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="sk" style={{ ...pulse, height: 10, width: 80 }} />
                <div className="sk" style={{ ...pulse, height: 16, width: 200 }} />
                <div className="sk" style={{ ...pulse, height: 4, width: "80%", borderRadius: 99 }} />
              </div>
            </div>
          </div>

          {/* Class grid */}
          <div>
            <div className="sk" style={{ ...pulse, height: 10, width: 80, marginBottom: 14 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="sk" style={{ ...pulse, borderRadius: 18, aspectRatio: "4/3" }} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
