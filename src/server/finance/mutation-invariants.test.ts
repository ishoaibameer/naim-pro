// @vitest-environment node

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

describe("finance mutation invariants", () => {
  const mutationFiles = [
    "payments.server.ts",
    "bills.server.ts",
    "settlement.server.ts",
  ]

  it("contains no hard-delete path", () => {
    for (const file of mutationFiles) {
      const source = readFileSync(
        fileURLToPath(new URL(file, import.meta.url)),
        "utf8"
      )
      expect(source).not.toContain(".delete(")
    }
  })

  it("routes material finance mutations through activity and audit recording", () => {
    for (const file of mutationFiles) {
      const source = readFileSync(
        fileURLToPath(new URL(file, import.meta.url)),
        "utf8"
      )
      expect(source).toContain("recordOperationalMutation")
    }
  })
})
