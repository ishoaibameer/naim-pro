import { createFileRoute } from "@tanstack/react-router"

import { checkDatabaseReadiness } from "@/server/db/index.server"

export const Route = createFileRoute("/health/ready")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await Promise.race([
            checkDatabaseReadiness(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Readiness timeout.")), 3_000)
            ),
          ])
          return Response.json(
            { status: "ok" },
            { headers: { "Cache-Control": "no-store" } }
          )
        } catch {
          return Response.json(
            { status: "unavailable" },
            { status: 503, headers: { "Cache-Control": "no-store" } }
          )
        }
      },
    },
  },
})
