// @vitest-environment node

import { describe, expect, it } from "vitest"

import { redactLogValue } from "./logger.server"

describe("structured log redaction", () => {
  it("redacts sensitive keys recursively", () => {
    expect(
      redactLogValue({
        sessionToken: "raw-token",
        nested: { passwordHash: "hash", organizationId: "org-1" },
      })
    ).toEqual({
      sessionToken: "[REDACTED]",
      nested: { passwordHash: "[REDACTED]", organizationId: "org-1" },
    })
  })

  it("redacts credential-like values without returning the secret", () => {
    const output = JSON.stringify(
      redactLogValue({
        message: "postgresql://user:test-only-password@example/db",
      })
    )
    expect(output).not.toContain("password")
    expect(output).toContain("[REDACTED]")
  })
})
