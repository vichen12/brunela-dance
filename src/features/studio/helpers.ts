export type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";
export type VideoStatus = "draft" | "published" | "archived";
export type ProgramStatus = "draft" | "published" | "archived";
export type LiveSessionStatus = "draft" | "scheduled" | "completed" | "canceled";
export type LiveBookingStatus = "reserved" | "waitlisted" | "canceled" | "attended" | "missed";
export type I18nRecord = Record<string, string>;

export const dashboardSections = [
  { href: "/dashboard", label: "Overview", key: "overview" },
  { href: "/dashboard/library", label: "Biblioteca", key: "library" },
  { href: "/dashboard/programs", label: "Programas", key: "programs" },
  { href: "/dashboard/live", label: "En vivo", key: "live" }
] as const;

export function resolveI18nText(record: I18nRecord | null | undefined, locale: "es" | "en" = "es") {
  if (!record) return "";
  return record[locale] ?? record.es ?? record.en ?? Object.values(record)[0] ?? "";
}

export function membershipTierLabel(tier: MembershipTier) {
  switch (tier) {
    case "none":
      return "Sin acceso";
    case "corps_de_ballet":
      return "Corps de Ballet";
    case "solista":
      return "Solista";
    case "principal":
      return "Principal";
  }
}

export function bookingStatusLabel(status: LiveBookingStatus) {
  switch (status) {
    case "reserved":
      return "Reserva confirmada";
    case "waitlisted":
      return "En lista de espera";
    case "canceled":
      return "Reserva cancelada";
    case "attended":
      return "Asistencia marcada";
    case "missed":
      return "Ausente";
  }
}

export function liveSessionStatusLabel(status: LiveSessionStatus) {
  switch (status) {
    case "draft":
      return "Borrador";
    case "scheduled":
      return "Programada";
    case "completed":
      return "Finalizada";
    case "canceled":
      return "Cancelada";
  }
}

export function formatDurationLabel(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes} min`;
}

export function formatDateTimeLabel(input: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(input));
}

export function formatDateLabel(input: string | null) {
  if (!input) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(input));
}

export function safePercent(value: number | null | undefined) {
  return Math.max(0, Math.min(100, Number(value ?? 0)));
}
