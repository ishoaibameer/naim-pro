import "@tanstack/react-start/server-only"

import { randomUUID } from "node:crypto"
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

import { getServerEnv } from "@/server/env.server"
import type { AllowedDocumentMimeType } from "./file-validation.server"

export interface DocumentStorage {
  put: (
    key: string,
    bytes: Uint8Array,
    options: { contentType: AllowedDocumentMimeType; checksumSha256: string }
  ) => Promise<void>
  read: (key: string) => Promise<Uint8Array>
  metadata: (key: string) => Promise<{ sizeBytes: number }>
  delete: (key: string) => Promise<void>
}

const EXTENSIONS: Record<AllowedDocumentMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
}

export function createStorageKey(
  _organizationId: string,
  _documentId: string,
  mimeType: AllowedDocumentMimeType
): string {
  return `objects/${randomUUID()}/${randomUUID()}.${EXTENSIONS[mimeType]}`
}

export function resolveStoragePath(root: string, key: string): string {
  if (
    !key ||
    path.isAbsolute(key) ||
    key.includes("\\") ||
    key.split("/").some((part) => !part || part === "." || part === "..") ||
    !/^[a-zA-Z0-9_./-]+$/.test(key)
  ) {
    throw new Error("Invalid storage key.")
  }
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, ...key.split("/"))
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`))
    throw new Error("Invalid storage key.")
  return resolved
}

export class LocalDocumentStorage implements DocumentStorage {
  constructor(private readonly root: string) {}

  async put(
    key: string,
    bytes: Uint8Array,
    _options: { contentType: AllowedDocumentMimeType; checksumSha256: string }
  ): Promise<void> {
    const destination = resolveStoragePath(this.root, key)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, bytes, { flag: "wx" })
  }

  async read(key: string): Promise<Uint8Array> {
    return readFile(resolveStoragePath(this.root, key))
  }

  async metadata(key: string): Promise<{ sizeBytes: number }> {
    const file = await stat(resolveStoragePath(this.root, key))
    return { sizeBytes: file.size }
  }

  async delete(key: string): Promise<void> {
    await unlink(resolveStoragePath(this.root, key)).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    })
  }
}

export class S3DocumentStorage implements DocumentStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string
  ) {}

  async put(
    key: string,
    bytes: Uint8Array,
    options: { contentType: AllowedDocumentMimeType; checksumSha256: string }
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: options.contentType,
        Metadata: { sha256: options.checksumSha256 },
      })
    )
  }

  async read(key: string): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    )
    if (!result.Body) throw new Error("Stored document body is unavailable.")
    return result.Body.transformToByteArray()
  }

  async metadata(key: string): Promise<{ sizeBytes: number }> {
    const result = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key })
    )
    if (result.ContentLength === undefined)
      throw new Error("Stored document metadata is unavailable.")
    return { sizeBytes: result.ContentLength }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    )
  }
}

let storage: DocumentStorage | undefined

export function getDocumentStorage(): DocumentStorage {
  const env = getServerEnv()
  storage ??=
    env.DOCUMENT_STORAGE_DRIVER === "s3"
      ? new S3DocumentStorage(
          new S3Client({
            region: env.DOCUMENT_STORAGE_REGION,
            endpoint: env.DOCUMENT_STORAGE_ENDPOINT,
            forcePathStyle: env.DOCUMENT_STORAGE_FORCE_PATH_STYLE,
            credentials: {
              accessKeyId: env.DOCUMENT_STORAGE_ACCESS_KEY_ID!,
              secretAccessKey: env.DOCUMENT_STORAGE_SECRET_ACCESS_KEY!,
            },
          }),
          env.DOCUMENT_STORAGE_BUCKET!
        )
      : new LocalDocumentStorage(
          path.resolve(
            process.cwd(),
            env.DOCUMENT_STORAGE_ROOT ?? ".data/documents"
          )
        )
  return storage
}

export function setDocumentStorageForTests(value: DocumentStorage | undefined) {
  storage = value
}
