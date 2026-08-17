import "@tanstack/react-start/server-only"

import { getServerEnv } from "@/server/env.server"

export interface DocumentScanner {
  scan: (bytes: Uint8Array) => Promise<"ACTIVE" | "REJECTED">
}

let scanner: DocumentScanner | undefined

export function assertDocumentScannerReady(): void {
  if (getServerEnv().DOCUMENT_MALWARE_SCAN_POLICY === "REQUIRED" && !scanner)
    throw new Error("Document scanning is required but unavailable.")
}

export async function scanDocument(bytes: Uint8Array): Promise<void> {
  assertDocumentScannerReady()
  if (!scanner) return
  if ((await scanner.scan(bytes)) === "REJECTED")
    throw new Error("Document rejected by malware scanning policy.")
}

export function setDocumentScannerForTests(value: DocumentScanner | undefined) {
  scanner = value
}
