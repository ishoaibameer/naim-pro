import { createFileRoute } from "@tanstack/react-router"
import { ZodError } from "zod"

import {
  ForbiddenError,
  UnauthorizedError,
  requireAuthenticatedUser,
} from "@/server/auth/policy"
import { getCurrentAuthContext } from "@/server/auth/session.server"
import { reportToCsv } from "@/server/product/report-csv"
import { getReport } from "@/server/product/reports.server"
import { reportFilterSchema } from "@/server/product/schemas"

export const Route = createFileRoute("/api/reports/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const actor = requireAuthenticatedUser(await getCurrentAuthContext())
          const params = new URL(request.url).searchParams
          const input = reportFilterSchema.parse(Object.fromEntries(params))
          const report = await getReport(actor, input)
          return new Response(`\uFEFF${reportToCsv(report)}`, {
            headers: {
              "Cache-Control": "private, no-store",
              "Content-Disposition": `attachment; filename="naim-pro-${input.report.toLowerCase()}-report.csv"`,
              "Content-Type": "text/csv; charset=utf-8",
              "X-Content-Type-Options": "nosniff",
            },
          })
        } catch (error) {
          if (error instanceof UnauthorizedError)
            return new Response("Authentication required.", { status: 401 })
          if (error instanceof ForbiddenError)
            return new Response("Report access denied.", { status: 403 })
          if (error instanceof ZodError)
            return new Response("Invalid report filters.", { status: 400 })
          return new Response("Report export unavailable.", { status: 400 })
        }
      },
    },
  },
})
