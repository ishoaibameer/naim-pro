import { IconExternalLink } from "@tabler/icons-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { DOCUMENT_TYPE_LABELS } from "@/server/documents/policy"
import type { DocumentType } from "@/server/documents/policy"
import { DriverEmpty } from "./driver-empty"

export interface DriverDocumentData {
  id: string
  documentType: string
  title: string
  originalFilename: string
  mimeType: string
  uploadedAt: Date | string
}

export function DriverDocuments({
  documents,
}: {
  documents: DriverDocumentData[]
}) {
  if (!documents.length)
    return (
      <DriverEmpty
        title="No documents"
        description="Allowed Trip documents will appear here."
      />
    )
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {documents.map((document) => (
        <Card key={document.id} className="overflow-hidden">
          {document.mimeType.startsWith("image/") ? (
            <a
              href={`/api/documents/${document.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={`/api/documents/${document.id}`}
                alt={document.title}
                className="aspect-video w-full bg-muted object-cover"
                loading="lazy"
              />
            </a>
          ) : null}
          <CardHeader>
            <CardTitle className="truncate text-base">
              {document.title || document.originalFilename}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {DOCUMENT_TYPE_LABELS[document.documentType as DocumentType]}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {formatDate(document.uploadedAt)}
            </p>
            <a
              href={`/api/documents/${document.id}`}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Open securely <IconExternalLink data-icon="inline-end" />
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
