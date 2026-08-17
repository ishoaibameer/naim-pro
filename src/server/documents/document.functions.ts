import { createServerFn } from "@tanstack/react-start"
import { getRequest, setResponseHeader } from "@tanstack/react-start/server"

import {
  adminMiddleware,
  authMiddleware,
  operationsMiddleware,
} from "@/server/auth/middleware"
import { assertSameOrigin } from "@/server/auth/request-security.server"
import {
  getDocument,
  getDocumentMasters,
  listDocuments,
  listDocumentsForTarget,
  retireDocument,
} from "./documents.server"
import {
  documentIdSchema,
  documentListSchema,
  documentTargetSchema,
  retireDocumentSchema,
} from "./schemas"

function noStore() {
  setResponseHeader("Cache-Control", "no-store")
}

export const listDocumentsFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .validator(documentListSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listDocuments(context.auth, data)
  })

export const listDocumentsForTargetFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(documentTargetSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return listDocumentsForTarget(context.auth, data)
  })

export const getDocumentFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(documentIdSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getDocument(context.auth, data.id)
  })

export const getDocumentMastersFn = createServerFn({ method: "GET" })
  .middleware([operationsMiddleware])
  .handler(async ({ context }) => {
    noStore()
    return getDocumentMasters(context.auth)
  })

export const retireDocumentFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(retireDocumentSchema)
  .handler(async ({ context, data }) => {
    assertSameOrigin(getRequest())
    noStore()
    await retireDocument(context.auth, data)
    return { success: true }
  })
