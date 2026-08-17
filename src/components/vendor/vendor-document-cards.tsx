import { IconExternalLink } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import { DOCUMENT_TYPE_LABELS } from "@/server/documents/policy"
import type { DocumentType } from "@/server/documents/policy"
import { VendorEmpty } from "./vendor-empty"

export interface VendorDocumentCardData {
  id: string
  documentType: string
  title: string | null
  originalFilename: string
  mimeType: string
  uploadedAt: Date | string
  relatedLabel: string
}

export function VendorDocumentCards({
  documents,
}: {
  documents: VendorDocumentCardData[]
}) {
  if (!documents.length)
    return (
      <VendorEmpty
        title="No documents found"
        description="Documents attached to your profile and loads will appear here."
      />
    )
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {documents.map((document) => {
        const preview = document.mimeType.startsWith("image/")
        return (
          <Card key={document.id} className="overflow-hidden">
            {preview ? (
              <a
                href={`/api/documents/${document.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={`/api/documents/${document.id}`}
                  alt={document.title ?? document.originalFilename}
                  className="aspect-video w-full bg-muted object-cover"
                  loading="lazy"
                />
              </a>
            ) : null}
            <CardHeader>
              <CardTitle className="truncate text-base">
                {document.title ?? document.originalFilename}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[document.documentType as DocumentType]}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="text-sm">
                <p className="font-medium">{document.relatedLabel}</p>
                <p className="text-muted-foreground">
                  {formatDate(document.uploadedAt)}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                render={
                  <a
                    href={`/api/documents/${document.id}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
                nativeButton={false}
              >
                Open securely
                <IconExternalLink data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
