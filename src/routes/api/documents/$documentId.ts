import { createFileRoute } from "@tanstack/react-router"

import {
  ForbiddenError,
  UnauthorizedError,
  requireAuthenticatedUser,
} from "@/server/auth/policy"
import { getCurrentAuthContext } from "@/server/auth/session.server"
import { readDocumentContent } from "@/server/documents/documents.server"
import { documentIdSchema } from "@/server/documents/schemas"

function safeVersion(request: Request): number | undefined {
  const value = new URL(request.url).searchParams.get("version")
  if (!value) return undefined
  const version = Number(value)
  if (!Number.isInteger(version) || version <= 0)
    throw new Error("Invalid document version.")
  return version
}

export const Route = createFileRoute("/api/documents/$documentId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const auth = requireAuthenticatedUser(await getCurrentAuthContext())
          const { id } = documentIdSchema.parse({ id: params.documentId })
          const content = await readDocumentContent(
            auth,
            id,
            safeVersion(request)
          )
          const encodedFilename = encodeURIComponent(content.originalFilename)
          return new Response(content.bytes.slice().buffer, {
            headers: {
              "Cache-Control": "private, no-store",
              "Content-Disposition": `inline; filename="document"; filename*=UTF-8''${encodedFilename}`,
              "Content-Length": String(content.sizeBytes),
              "Content-Type": content.mimeType,
              "Content-Security-Policy": "default-src 'none'; sandbox",
              "X-Content-Type-Options": "nosniff",
            },
          })
        } catch (error) {
          if (error instanceof UnauthorizedError)
            return new Response("Authentication required.", { status: 401 })
          if (error instanceof ForbiddenError)
            return new Response("Document access denied.", { status: 403 })
          return new Response("Document unavailable.", { status: 400 })
        }
      },
    },
  },
})
