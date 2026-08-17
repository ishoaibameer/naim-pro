// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest"

import { applySecurityHeaders } from "./security-headers.server"

const originalAppEnv = process.env.APP_ENV

afterEach(() => {
  process.env.APP_ENV = originalAppEnv
})

describe("production security headers", () => {
  it("sets browser hardening without exposing server details", () => {
    process.env.APP_ENV = "development"
    const headers = new Headers()
    applySecurityHeaders(headers)
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'"
    )
    expect(headers.has("Strict-Transport-Security")).toBe(false)
  })

  it("enables HSTS only for production", () => {
    process.env.APP_ENV = "production"
    const headers = new Headers()
    applySecurityHeaders(headers)
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=")
  })
})
