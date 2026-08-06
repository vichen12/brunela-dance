"use client";

import { PantallaError } from "@/components/pantalla-error";

/** Cubre TODO /dashboard. Lo que ve una alumna cuando algo revienta. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PantallaError error={error} reset={reset} ambito="estudio" />;
}
