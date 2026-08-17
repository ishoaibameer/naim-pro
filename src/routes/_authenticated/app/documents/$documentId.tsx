import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime } from "@/lib/format"
import {
  getDocumentFn,
  retireDocumentFn,
} from "@/server/documents/document.functions"
import { DOCUMENT_TYPE_LABELS } from "@/server/documents/policy"

export const Route = createFileRoute(
  "/_authenticated/app/documents/$documentId"
)({
  loader: ({ params }) => getDocumentFn({ data: { id: params.documentId } }),
  component: DocumentDetailPage,
})

function DocumentDetailPage() {
  const document = Route.useLoaderData()
  const { auth } = Route.useRouteContext()
  const router = useRouter()
  const retire = useServerFn(retireDocumentFn)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      await retire({
        data: {
          id: document.id,
          version: document.version,
          reason: String(form.get("reason")),
        },
      })
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to supersede document."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={DOCUMENT_TYPE_LABELS[document.documentType]}
        title={document.title}
        description={`${document.relatedType}: ${document.relatedLabel}`}
      />
      <div>
        <Badge variant={document.status === "ACTIVE" ? "secondary" : "outline"}>
          {document.status}
        </Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {document.mimeType.startsWith("image/") ? (
            <img
              src={`/api/documents/${document.id}`}
              alt={document.title}
              className="max-h-[70svh] w-full object-contain"
            />
          ) : (
            <iframe
              src={`/api/documents/${document.id}`}
              title={document.title}
              className="h-[70svh] w-full border"
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {document.versions.map((version) => (
            <a
              key={version.id}
              href={`/api/documents/${document.id}?version=${version.versionNumber}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col gap-1 border-b py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                Version {version.versionNumber} · {version.originalFilename}
              </span>
              <span className="text-xs text-muted-foreground">
                {version.uploadedBy} · {formatDateTime(version.uploadedAt)} ·{" "}
                {(version.sizeBytes / 1_048_576).toFixed(2)} MB
              </span>
            </a>
          ))}
        </CardContent>
      </Card>
      {document.description ? (
        <p className="text-sm text-muted-foreground">{document.description}</p>
      ) : null}
      {auth.membership.role === "ADMIN" && document.status === "ACTIVE" ? (
        <Card>
          <CardHeader>
            <CardTitle>Supersede document</CardTitle>
          </CardHeader>
          <form onSubmit={submit}>
            <CardContent className="space-y-3">
              <Field>
                <FieldLabel htmlFor="reason">Reason *</FieldLabel>
                <Textarea
                  id="reason"
                  name="reason"
                  required
                  minLength={3}
                  maxLength={1000}
                />
              </Field>
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Action failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}Supersede
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}
    </div>
  )
}
