import "@tanstack/react-start/server-only"

import { createHash } from "node:crypto"
import path from "node:path"

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const
export type AllowedDocumentMimeType =
  (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number]

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const PDF_MAX_BYTES = 15 * 1024 * 1024

export class DocumentFileValidationError extends Error {}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

export function detectDocumentMimeType(
  bytes: Uint8Array
): AllowedDocumentMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
  )
    return "image/webp"
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return "application/pdf"
  return null
}

export function validateDocumentFile(input: {
  declaredMimeType: string
  sizeBytes: number
  bytes: Uint8Array
}): AllowedDocumentMimeType {
  if (
    !ALLOWED_DOCUMENT_MIME_TYPES.includes(
      input.declaredMimeType as AllowedDocumentMimeType
    )
  )
    throw new DocumentFileValidationError(
      "Only JPEG, PNG, WEBP, and PDF files are allowed."
    )
  if (input.sizeBytes <= 0)
    throw new DocumentFileValidationError(
      "The uploaded file is empty or incomplete."
    )
  const limit =
    input.declaredMimeType === "application/pdf"
      ? PDF_MAX_BYTES
      : IMAGE_MAX_BYTES
  if (input.sizeBytes > limit)
    throw new DocumentFileValidationError(
      input.declaredMimeType === "application/pdf"
        ? "PDF files must be 15 MB or smaller."
        : "Image files must be 10 MB or smaller."
    )
  if (input.bytes.byteLength !== input.sizeBytes)
    throw new DocumentFileValidationError(
      "The uploaded file is empty or incomplete."
    )
  const detected = detectDocumentMimeType(input.bytes)
  if (!detected || detected !== input.declaredMimeType)
    throw new DocumentFileValidationError(
      "The file content does not match its declared type."
    )
  return detected
}

export function calculateSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

export function safeOriginalFilename(filename: string): string {
  const cleaned = path
    .basename(filename.replaceAll("\\", "/"))
    .split("")
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint > 31 && codePoint !== 127
    })
    .join("")
    .trim()
    .slice(0, 255)
  return cleaned || "upload"
}
