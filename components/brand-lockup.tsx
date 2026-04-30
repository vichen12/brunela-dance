import Image from "next/image";
import Link from "next/link";

type BrandLockupProps = {
  href?: "/";
  centered?: boolean;
  compact?: boolean;
  light?: boolean;
  markOnly?: boolean;
  showWordmark?: boolean;
  className?: string;
};

export function BrandLockup({
  href = "/",
  centered = false,
  compact = false,
  light = false,
  markOnly = false,
  showWordmark = false,
  className = ""
}: BrandLockupProps) {
  const textColor = light ? "#ffffff" : "#D93438";
  const subtitleColor = light ? "rgba(255,255,255,0.78)" : "#E64F55";
  const markWidth = markOnly ? (compact ? 42 : 78) : compact ? 36 : 50;
  const markHeight = markOnly ? (compact ? 42 : 78) : compact ? 50 : 70;
  const wordmarkWidth = compact ? 132 : 260;
  const wordmarkHeight = compact ? 38 : 76;

  return (
    <Link
      href={href}
      aria-label="Brunela Dance Trainer"
      className={className}
      suppressHydrationWarning
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: centered ? "center" : "flex-start",
        gap: compact ? "0.55rem" : "0.9rem",
        textDecoration: "none",
        width: "fit-content"
      }}
    >
      <div
        style={{
          position: "relative",
          width: markWidth,
          height: markHeight,
          flexShrink: 0
        }}
      >
        <Image
          src="/brand/isologo-icon.png"
          alt="Logo Brunela Dance Trainer"
          fill
          priority
          style={{ objectFit: "contain", objectPosition: "center" }}
        />
      </div>

      {showWordmark ? (
        <div
          style={{
            position: "relative",
            width: wordmarkWidth,
            height: wordmarkHeight,
            flexShrink: 0
          }}
        >
          <Image
            src="/brand/brunela-dance-trainer-wordmark.png"
            alt="Brunela Dance Trainer"
            fill
            priority
            style={{ objectFit: "contain", objectPosition: "left center" }}
          />
        </div>
      ) : !markOnly && (
      <div style={{ display: "grid", gap: compact ? "0.12rem" : "0.18rem", textAlign: centered ? "center" : "left" }}>
        <span
          style={{
            color: textColor,
            fontFamily: "var(--font-display), serif",
            fontSize: compact ? "1.38rem" : "clamp(2.25rem, 4.6vw, 3.4rem)",
            fontWeight: 700,
            letterSpacing: "0.04em",
            lineHeight: compact ? 0.94 : 0.88,
            textTransform: "uppercase"
          }}
        >
          Brunela
        </span>
        <span
          style={{
            color: subtitleColor,
            fontSize: compact ? "0.62rem" : "0.74rem",
            fontWeight: 800,
            letterSpacing: compact ? "0.28em" : "0.34em",
            lineHeight: 1.1,
            textTransform: "uppercase"
          }}
        >
          Dance Trainer
        </span>
      </div>
      )}
    </Link>
  );
}
