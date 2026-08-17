import type { getReport } from "./reports.server"

export type AwaitedReport = Awaited<ReturnType<typeof getReport>>
