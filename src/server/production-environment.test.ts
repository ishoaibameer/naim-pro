// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"

import { getNetworkIdentifier } from "./auth/request-security.server"
import {
  assertDocumentScannerReady,
  setDocumentScannerForTests,
} from "./documents/scanner.server"
import { getServerEnv } from "./env.server"

function baseEnvironment() {
  vi.stubEnv("DATABASE_URL", "postgresql://user:test-only@localhost/naim_test")
  vi.stubEnv(
    "SESSION_SECRET",
    "test-only-session-secret-longer-than-forty-eight-characters-for-tests"
  )
  vi.stubEnv("APP_ENV", "development")
  vi.stubEnv("DOCUMENT_STORAGE_DRIVER", "local")
  vi.stubEnv("TRUSTED_PROXY_MODE", "NONE")
  vi.stubEnv("DOCUMENT_MALWARE_SCAN_POLICY", "DISABLED")
}

afterEach(() => {
  setDocumentScannerForTests(undefined)
  vi.unstubAllEnvs()
})

describe("production environment policy", () => {
  it("refuses local storage and unencrypted PostgreSQL in production", () => {
    baseEnvironment()
    vi.stubEnv("APP_ENV", "production")
    vi.stubEnv("APP_ORIGIN", "https://naim.example")
    expect(() => getServerEnv()).toThrow(
      "DATABASE_URL, DOCUMENT_STORAGE_DRIVER"
    )
  })

  it("accepts a complete private S3 production configuration", () => {
    baseEnvironment()
    vi.stubEnv("APP_ENV", "production")
    vi.stubEnv("APP_ORIGIN", "https://naim.example")
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:test-only@database.example/naim?sslmode=require"
    )
    vi.stubEnv("DOCUMENT_STORAGE_DRIVER", "s3")
    vi.stubEnv("DOCUMENT_STORAGE_BUCKET", "private-documents")
    vi.stubEnv("DOCUMENT_STORAGE_REGION", "auto")
    vi.stubEnv("DOCUMENT_STORAGE_ACCESS_KEY_ID", "test-only-key")
    vi.stubEnv("DOCUMENT_STORAGE_SECRET_ACCESS_KEY", "test-only-secret")
    expect(getServerEnv()).toMatchObject({
      APP_ENV: "production",
      DOCUMENT_STORAGE_DRIVER: "s3",
    })
  })

  it("ignores spoofable forwarding headers until a proxy mode is selected", () => {
    baseEnvironment()
    const request = new Request("https://naim.example/login", {
      headers: { "x-forwarded-for": "203.0.113.4" },
    })
    expect(getNetworkIdentifier(request)).toBe("untrusted-network")
    vi.stubEnv("TRUSTED_PROXY_MODE", "X_FORWARDED_FOR")
    expect(getNetworkIdentifier(request)).toBe("203.0.113.4")
  })

  it("fails closed when malware scanning is required but unconfigured", () => {
    baseEnvironment()
    vi.stubEnv("DOCUMENT_MALWARE_SCAN_POLICY", "REQUIRED")
    expect(() => assertDocumentScannerReady()).toThrow(
      "Document scanning is required but unavailable."
    )
  })
})
