export default function LiveLoading() {
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
          <div style={{ marginBottom: 28 }}>
            <div style={{ ...pulse, height: 10, width: 100, marginBottom: 10 }} />
            <div style={{ ...pulse, height: 32, width: 200 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ ...pulse, borderRadius: 20, height: 100 }} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
