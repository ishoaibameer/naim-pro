// @vitest-environment node

import { describe, expect, it } from "vitest"

import {
  IMAGE_MAX_BYTES,
  PDF_MAX_BYTES,
  calculateSha256,
  detectDocumentMimeType,
  safeOriginalFilename,
  validateDocumentFile,
} from "./file-validation.server"

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
])
const pdf = new TextEncoder().encode("%PDF-1.7")

describe("document file validation", () => {
  it.each([
    [jpeg, "image/jpeg"],
    [png, "image/png"],
    [webp, "image/webp"],
    [pdf, "application/pdf"],
  ] as const)("recognizes file signatures", (bytes, mimeType) => {
    expect(detectDocumentMimeType(bytes)).toBe(mimeType)
    expect(
      validateDocumentFile({
        declaredMimeType: mimeType,
        sizeBytes: bytes.byteLength,
        bytes,
      })
    ).toBe(mimeType)
  })

  it("rejects disguised and unsupported files", () => {
    expect(() =>
      validateDocumentFile({
        declaredMimeType: "image/png",
        sizeBytes: jpeg.byteLength,
        bytes: jpeg,
      })
    ).toThrow(/does not match/)
    expect(() =>
      validateDocumentFile({
        declaredMimeType: "text/plain",
        sizeBytes: 3,
        bytes: new Uint8Array([1, 2, 3]),
      })
    ).toThrow(/Only JPEG/)
  })

  it("enforces image and PDF limits before storage", () => {
    expect(() =>
      validateDocumentFile({
        declaredMimeType: "image/jpeg",
        sizeBytes: IMAGE_MAX_BYTES + 1,
        bytes: jpeg,
      })
    ).toThrow(/10 MB/)
    expect(() =>
      validateDocumentFile({
        declaredMimeType: "application/pdf",
        sizeBytes: PDF_MAX_BYTES + 1,
        bytes: pdf,
      })
    ).toThrow(/15 MB/)
  })

  it("creates a stable SHA-256 digest and safe display filename", () => {
    expect(calculateSha256(new TextEncoder().encode("naim"))).toMatch(
      /^[a-f0-9]{64}$/
    )
    expect(safeOriginalFilename("../../unsafe\\receipt.pdf\u0000")).toBe(
      "receipt.pdf"
    )
  })
})
