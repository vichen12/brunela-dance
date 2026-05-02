export default function LibraryLoading() {
  const pulse = {
    background: "linear-gradient(90deg, #f5f0ef 25%, #ede8e6 50%, #f5f0ef 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
    borderRadius: 12,
  } as React.CSSProperties;

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <main className="pb-20 pt-6 md:pb-10 md:pt-10">
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ ...pulse, height: 10, width: 80, marginBottom: 10 }} />
            <div style={{ ...pulse, height: 32, width: 240, marginBottom: 8 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ ...pulse, borderRadius: 16, aspectRatio: "16/9" }} />
                <div style={{ ...pulse, height: 14, width: "80%" }} />
                <div style={{ ...pulse, height: 10, width: "50%", borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
