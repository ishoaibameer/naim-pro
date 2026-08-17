import "@tanstack/react-start/server-only"

import { isIP } from "node:net"

import { getServerEnv } from "@/server/env.server"

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin")
  const expectedOrigin =
    getServerEnv().APP_ORIGIN ?? new URL(request.url).origin
  if (!origin || origin !== expectedOrigin) {
    throw new Error("Request origin validation failed.")
  }
}

export function getNetworkIdentifier(request: Request): string {
  const mode = getServerEnv().TRUSTED_PROXY_MODE
  const candidate =
    mode === "CLOUDFLARE"
      ? request.headers.get("cf-connecting-ip")
      : mode === "X_REAL_IP"
        ? request.headers.get("x-real-ip")
        : mode === "X_FORWARDED_FOR"
          ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          : null
  return candidate && isIP(candidate) ? candidate : "untrusted-network"
}
