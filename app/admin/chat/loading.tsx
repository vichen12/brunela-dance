import { SkChat } from "@/components/skeleton";

/**
 * Moderacion del chat.
 *
 * `SkChat` existia en components/skeleton.tsx desde el rediseño del panel y
 * NADIE lo importaba: se escribio el esqueleto y nunca se conecto. Este archivo
 * es lo que faltaba.
 */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkChat />
    </main>
  );
}
