import { createFileRoute } from "@tanstack/react-router"
import { ZodError } from "zod"

import {
  ForbiddenError,
  UnauthorizedError,
  requireAuthenticatedUser,
} from "@/server/auth/policy"
import { assertSameOrigin } from "@/server/auth/request-security.server"
import { getCurrentAuthContext } from "@/server/auth/session.server"
import { uploadDocument } from "@/server/documents/documents.server"
import { DocumentFileValidationError } from "@/server/documents/file-validation.server"
import { DocumentPolicyError } from "@/server/documents/policy"
import { documentUploadMetadataSchema } from "@/server/documents/schemas"

const MAX_MULTIPART_BYTES = 16 * 1024 * 1024
class UploadRequestError extends Error {}

function errorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError)
    return Response.json({ error: "Authentication required." }, { status: 401 })
  if (error instanceof ForbiddenError)
    return Response.json({ error: "Document access denied." }, { status: 403 })
  if (
    error instanceof UploadRequestError ||
    error instanceof DocumentFileValidationError ||
    error instanceof DocumentPolicyError
  )
    return Response.json({ error: error.message }, { status: 400 })
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues.at(0)?.message ?? "Invalid upload details." },
      { status: 400 }
    )
  return Response.json({ error: "Upload failed." }, { status: 400 })
}

export const Route = createFileRoute("/api/documents/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request)
          const auth = requireAuthenticatedUser(await getCurrentAuthContext())
          const contentLength = Number(request.headers.get("content-length"))
          if (!Number.isFinite(contentLength) || contentLength <= 0)
            throw new UploadRequestError("Upload size could not be verified.")
          if (contentLength > MAX_MULTIPART_BYTES)
            throw new UploadRequestError("Upload request is too large.")
          const form = await request.formData()
          const file = form.get("file")
          if (
            !file ||
            typeof file === "string" ||
            typeof file.arrayBuffer !== "function"
          )
            throw new UploadRequestError("Choose a file to upload.")
          const metadata = documentUploadMetadataSchema.parse({
            documentType: form.get("documentType"),
            targetType: form.get("targetType"),
            targetId: form.get("targetId"),
            title: form.get("title") ?? "",
            description: form.get("description") ?? "",
          })
          const result = await uploadDocument(auth, metadata, file)
          return Response.json(result, {
            status: 201,
            headers: { "Cache-Control": "no-store" },
          })
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
})
