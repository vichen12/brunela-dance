"use client";

import { useEffect, useState } from "react";

/**
 * La hora de una clase en vivo, en la zona del estudio y en la de quien mira.
 *
 * EL PROBLEMA QUE RESUELVE
 *   `live_sessions.session_timezone` se guardaba y hasta se pedia en el
 *   formulario, pero al mostrar la hora NADIE lo usaba: se formateaba con la
 *   zona del entorno. En Vercel el servidor corre en UTC, asi que Brunela
 *   programaba una clase a las 19:00 de Madrid y el panel se la mostraba a otra
 *   hora, sin aclarar en cual. Una alumna en Buenos Aires veia una tercera.
 *
 *   Para una clase EN VIVO eso no es un detalle de formato: es llegar tarde.
 *
 * POR QUE SE RESUELVE EN EL CLIENTE
 *   La zona de la alumna solo la conoce su navegador. El servidor no puede
 *   saberla sin guardarla en el perfil, que seria una migracion para algo que
 *   el dispositivo ya sabe.
 *
 * POR QUE NO SE RENDERIZA NADA EN EL SERVIDOR
 *   Durante el primer render no hay zona del visitante, y mostrar una hora
 *   provisoria significaria mostrar una hora EQUIVOCADA por un instante. En una
 *   clase en vivo, alguien que lee de reojo y cierra se queda con esa. Mejor un
 *   espacio vacio: se reserva la altura para que no salte el layout.
 */

type Props = {
  /** ISO UTC, tal como sale de la base. */
  iso: string;
  /** Zona en la que Brunela programo la clase, ej. "Europe/Madrid". */
  zonaEstudio: string;
  /** En el panel de admin, la del estudio manda y la local es la secundaria. */
  perspectiva?: "alumna" | "admin";
  className?: string;
};

function formatear(iso: string, zona: string) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zona,
  }).format(new Date(iso));
}

/** "Europe/Madrid" -> "Madrid"; "America/Argentina/Buenos_Aires" -> "Buenos Aires" */
function nombreDeZona(zona: string) {
  const ultima = zona.split("/").pop() ?? zona;
  return ultima.replace(/_/g, " ");
}

export function HoraSesion({ iso, zonaEstudio, perspectiva = "alumna", className }: Props) {
  const [zonaLocal, setZonaLocal] = useState<string | null>(null);

  useEffect(() => {
    try {
      setZonaLocal(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setZonaLocal(null);
    }
  }, []);

  // Sin zona todavia: espacio reservado, nunca una hora provisoria.
  if (!zonaLocal) {
    return <span className={className} style={{ display: "inline-block", minHeight: "1.2em", minWidth: "12ch" }} aria-hidden />;
  }

  const mismaZona = zonaLocal === zonaEstudio;
  const principal = perspectiva === "admin" ? zonaEstudio : zonaLocal;
  const secundaria = perspectiva === "admin" ? zonaLocal : zonaEstudio;

  if (mismaZona) {
    return (
      <span className={className}>
        {formatear(iso, principal)}{" "}
        <span style={{ opacity: 0.6 }}>({nombreDeZona(principal)})</span>
      </span>
    );
  }

  return (
    <span className={className}>
      {formatear(iso, principal)}{" "}
      <span style={{ opacity: 0.6 }}>({nombreDeZona(principal)})</span>
      <span style={{ opacity: 0.6 }}> · </span>
      <span style={{ opacity: 0.75 }}>
        {formatear(iso, secundaria)} ({nombreDeZona(secundaria)})
      </span>
    </span>
  );
}
