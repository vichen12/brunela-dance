"use client";

import Link from "next/link";

import {
  Play, Grid2x2, AlignLeft, Users, FileText, MessageSquare, Settings, Eye,
  type LucideIcon,
} from "lucide-react";

// Un icono de lucide es un componente, o sea una FUNCION. Un server component no
// puede pasarle una funcion a uno de cliente: React serializa las props para
// mandarlas por la red y una funcion no se puede serializar. Revienta en
// tiempo de ejecucion, no al compilar -- `tsc` y `next build` pasan igual.
//
// Por eso por la frontera viaja solo una CADENA y el mapa vive de este lado.
// Si agregas un acceso rapido nuevo, sumalo aca tambien o cae en el de reserva.
const ICONOS: Record<string, LucideIcon> = {
  videos: Play, categorias: Grid2x2, programas: AlignLeft, alumnas: Users,
  documentos: FileText, chat: MessageSquare, ajustes: Settings, alumna: Eye,
};

// ─── Sparkline (SVG puro, sin interactividad) ────────────────────────────────
function Sparkline({ points, color = "var(--pink-mid)" }: { points: string; color?: string }) {
  const pts = points
    .split(" ")
    .filter(Boolean)
    .map((p) => { const [x, y] = p.split(","); return { x: +x, y: +y }; })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

  // Sin puntos no hay nada que dibujar, y `last` seria undefined.
  if (pts.length === 0) return <svg viewBox="0 0 80 32" width={80} height={32} aria-hidden />;

  const last = pts[pts.length - 1];

  // El atributo `points` de <polygon> SOLO acepta pares de numeros. La "Z" que
  // habia aca es sintaxis de <path>, y hacia que el navegador rechazara el
  // atributo entero: un error de consola por tarjeta, ocho en /admin. El
  // poligono cierra solo, no hace falta.
  const fillPath = `${points} ${last.x},32 0,32`;

  // El id tiene que ser un identificador valido para url(#...). Con tokens
  // (`var(--pink-mid)`) los parentesis y guiones rompen la referencia, asi que
  // se limpia a alfanumerico. Mismo color -> mismo id, que es lo correcto:
  // comparten el gradiente.
  const gradId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg viewBox="0 0 80 32" width={80} height={32} style={{ overflow: "visible" }} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fillPath} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </svg>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────
export function MetricCard({
  label, sub, value, sparkPoints, trend, trendUp, href,
}: {
  label: string; sub: string; value: number | string;
  sparkPoints: string; trend?: string; trendUp?: boolean; href?: string;
}) {
  const inner = (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: "20px 22px",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.2s, transform 0.2s",
        cursor: href ? "pointer" : "default",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(230, 79, 85,0.12)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "#a8a29e", textTransform: "uppercase" }}>Este mes</p>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#78716c", marginBottom: 4 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <p style={{ fontFamily: "var(--font-display), serif", fontSize: 38, fontWeight: 700, lineHeight: 1, color: "#1c1917", letterSpacing: "-0.02em" }}>{value}</p>
        <Sparkline points={sparkPoints} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 9, color: "#a8a29e", fontWeight: 600 }}>{sub}</span>
        {trend && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
            background: trendUp ? "#f0fdf4" : "#fef2f2",
            color: trendUp ? "#166534" : "#991b1b",
          }}>
            {trendUp ? "▲" : "▼"} {trend}
          </span>
        )}
      </div>
    </div>
  );

  if (href) return <Link href={href as never} style={{ textDecoration: "none", display: "block", height: "100%" }}>{inner}</Link>;
  return inner;
}

// ─── QuickLinks grid ─────────────────────────────────────────────────────────
export function QuickLinksGrid({ links }: {
  // `icono` es una clave de ICONOS, no el componente: ver el comentario de
  // arriba. Todo lo que llega aca desde el servidor tiene que ser dato plano.
  links: { href: string; icono: string; label: string; desc: string }[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
      {links.map((lnk) => (
        <Link key={lnk.href} href={lnk.href as never} style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "#fff", borderRadius: 18, padding: "18px 20px",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              transition: "box-shadow 0.2s, transform 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(230, 79, 85,0.12)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: "linear-gradient(135deg, var(--pink-wash), var(--pink-soft))",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 12, color: "var(--pink-deep)",
            }}>{(() => { const I = ICONOS[lnk.icono] ?? Play; return <I size={19} strokeWidth={1.9} />; })()}</div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>{lnk.label}</p>
            <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 3 }}>{lnk.desc}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
