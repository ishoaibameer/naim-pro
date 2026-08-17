// @vitest-environment node

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

function source(file: string) {
  return readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8")
}

describe("production authorization review invariants", () => {
  it.each([
    ["Admin", "admin/admin.functions.ts", "adminMiddleware"],
    [
      "Operations",
      "operations/operations.functions.ts",
      "operationsMiddleware",
    ],
    ["Finance", "finance/finance.functions.ts", "operationsMiddleware"],
    ["Vendor", "vendor/vendor.functions.ts", "vendorMiddleware"],
    ["Driver", "driver/driver.functions.ts", "driverMiddleware"],
    [
      "Custom fields",
      "custom-fields/custom-field.functions.ts",
      "authMiddleware",
    ],
    ["Documents", "documents/document.functions.ts", "authMiddleware"],
    ["Product", "product/product.functions.ts", "operationsMiddleware"],
  ])(
    "keeps %s server functions behind an authorization middleware",
    (_, file, middleware) => {
      const contents = source(file)
      expect(contents).toContain("createServerFn")
      expect(contents).toContain(middleware)
    }
  )

  it("protects raw document and report routes at the server boundary", () => {
    for (const file of [
      "../routes/api/documents/upload.ts",
      "../routes/api/documents/$documentId.ts",
      "../routes/api/reports/export.ts",
    ]) {
      const contents = source(file)
      expect(contents).toContain("requireAuthenticatedUser")
    }
    expect(source("../routes/api/documents/upload.ts")).toContain(
      "assertSameOrigin(request)"
    )
  })

  it("globally checks mutation origins and adds response hardening", () => {
    const contents = source("../start.ts")
    expect(contents).toContain('!["GET", "HEAD", "OPTIONS"].includes(method)')
    expect(contents).toContain("origin !== expectedOrigin")
    expect(contents).toContain("applySecurityHeaders")
  })
})
