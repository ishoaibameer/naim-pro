export function formatDate(value: Date | string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function formatDateTime(value: Date | string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function formatInr(value: string | number | null): string {
  if (value === null) return "—"
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "—"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatWeight(value: string | number | null): string {
  if (value === null) return "—"
  const weight = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(weight)) return "—"
  return `${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(weight)} t`
}

export function formatPercent(value: string | number | null): string {
  if (value === null) return "—"
  const percentage = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(percentage)) return "—"
  return `${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(percentage)}%`
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.at(0)?.toLocaleUpperCase("en-IN") ?? "")
      .join("") || "?"
  )
}
