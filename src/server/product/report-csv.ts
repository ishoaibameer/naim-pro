import type { AwaitedReport } from "./types"

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const columns = {
  TRIPS: [
    "tripNumber",
    "vehicle",
    "vendor",
    "company",
    "loadedWeightMt",
    "finalWeightMt",
    "differenceMt",
    "status",
    "dispatchedAt",
    "deliveredAt",
  ],
  VENDORS: [
    "vendor",
    "trips",
    "deliveredWeightMt",
    "materialValue",
    "paid",
    "pending",
  ],
  TRANSPORTERS: ["transporter", "trips", "freight", "paid", "pending"],
  COMPANIES: [
    "company",
    "tripsDelivered",
    "finalWeightMt",
    "billed",
    "received",
    "receivable",
  ],
  PAYMENTS: [
    "paymentDate",
    "paymentNumber",
    "party",
    "partyType",
    "amount",
    "direction",
    "type",
    "status",
    "recordedBy",
    "receipt",
  ],
  WEIGHT: [
    "tripNumber",
    "vehicle",
    "vendor",
    "loadedWeightMt",
    "finalWeightMt",
    "differenceMt",
    "differencePct",
    "deliveredAt",
  ],
} as const

export function reportToCsv(report: AwaitedReport): string {
  const keys = columns[report.type]
  const rows = report.rows as ReadonlyArray<Record<string, unknown>>
  return [
    keys.map(csvCell).join(","),
    ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(",")),
  ].join("\r\n")
}
