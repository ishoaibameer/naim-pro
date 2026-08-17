// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  LocalDocumentStorage,
  createStorageKey,
  resolveStoragePath,
} from "./storage.server"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
})

describe("local private document storage", () => {
  it("writes, reads, and inspects opaque organization-scoped objects", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "naim-documents-"))
    roots.push(root)
    const storage = new LocalDocumentStorage(root)
    const key = createStorageKey("org-id", "document-id", "application/pdf")
    const bytes = new TextEncoder().encode("%PDF-1.7")
    expect(key).toMatch(/^objects\/[a-f0-9-]+\/[a-f0-9-]+\.pdf$/)
    await storage.put(key, bytes, {
      contentType: "application/pdf",
      checksumSha256: "a".repeat(64),
    })
    expect(Array.from(await storage.read(key))).toEqual(Array.from(bytes))
    expect(await storage.metadata(key)).toEqual({ sizeBytes: bytes.byteLength })
  })

  it.each([
    "../secret",
    "/absolute/file",
    "organization\\bad",
    "organization//bad",
  ])("rejects unsafe key %s", (key) => {
    expect(() => resolveStoragePath("private-root", key)).toThrow(
      "Invalid storage key"
    )
  })
})
