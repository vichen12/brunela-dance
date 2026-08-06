"use client";

import { PantallaError } from "@/components/pantalla-error";

/** Cubre TODO /admin. Lo que ve Brunela cuando algo revienta en el panel. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PantallaError error={error} reset={reset} ambito="panel" />;
}
