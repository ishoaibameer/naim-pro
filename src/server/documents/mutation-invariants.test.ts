// @vitest-environment node

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const source = readFileSync(
  fileURLToPath(new URL("documents.server.ts", import.meta.url)),
  "utf8"
)

describe("document mutation invariants", () => {
  it("does not hard-delete relational document evidence", () => {
    expect(source).not.toContain(".delete(documents)")
    expect(source).not.toContain(".delete(documentVersions)")
    expect(source).toContain('status: "INACTIVE"')
  })

  it("records uploads, versions, and supersession in activity and audit", () => {
    expect(source).toContain("DOCUMENT_UPLOADED")
    expect(source).toContain("DOCUMENT_VERSION_UPLOADED")
    expect(source).toContain("DOCUMENT_SUPERSEDED")
    expect(source).toContain("recordOperationalMutation")
  })
})
