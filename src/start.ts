import { randomUUID } from "node:crypto"
import { createMiddleware, createStart } from "@tanstack/react-start"

import { getServerEnv } from "@/server/env.server"
import { applySecurityHeaders } from "@/server/http/security-headers.server"
import { logger } from "@/server/observability/logger.server"

const productionRequestMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const startedAt = performance.now()
    const requestId = randomUUID()
    const method = request.method.toUpperCase()
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const origin = request.headers.get("origin")
      const expectedOrigin =
        getServerEnv().APP_ORIGIN ?? new URL(request.url).origin
      if (!origin || origin !== expectedOrigin)
        return new Response("Origin validation failed.", { status: 403 })
    }
    try {
      const result = await next({ context: { requestId } })
      result.response.headers.set("X-Request-Id", requestId)
      applySecurityHeaders(result.response.headers)
      logger.info("http.request", {
        requestId,
        method,
        path: new URL(request.url).pathname,
        status: result.response.status,
        durationMs: Math.round(performance.now() - startedAt),
      })
      return result
    } catch (error) {
      logger.error("http.request.failed", {
        requestId,
        method,
        path: new URL(request.url).pathname,
        durationMs: Math.round(performance.now() - startedAt),
        errorName: error instanceof Error ? error.name : "UnknownError",
      })
      throw error
    }
  }
)

export const startInstance = createStart(() => ({
  requestMiddleware: [productionRequestMiddleware],
}))
