import { Link } from "@tanstack/react-router"
import { IconFile, IconPhoto } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime } from "@/lib/format"
import { DOCUMENT_TYPE_LABELS } from "@/server/documents/policy"
import type { DocumentType } from "@/server/documents/policy"

export interface DocumentCardItem {
  id: string
  documentType: DocumentType
  title: string
  status: "ACTIVE" | "INACTIVE"
  currentVersionNumber: number
  originalFilename: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: Date | string
  relatedLabel: string
}

export function DocumentCards({
  items,
}: {
  items: readonly DocumentCardItem[]
}) {
  if (!items.length)
    return (
      <p className="text-sm text-muted-foreground">
        No documents uploaded yet.
      </p>
    )
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex-row items-start gap-3">
            {item.mimeType.startsWith("image/") ? (
              <IconPhoto className="mt-1 size-5 shrink-0" />
            ) : (
              <IconFile className="mt-1 size-5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base">{item.title}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[item.documentType]}
              </p>
            </div>
            <Badge variant={item.status === "ACTIVE" ? "secondary" : "outline"}>
              {item.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="overflow-hidden border bg-muted/20">
              {item.mimeType.startsWith("image/") ? (
                <img
                  src={`/api/documents/${item.id}`}
                  alt={item.title}
                  loading="lazy"
                  className="h-36 w-full object-contain"
                />
              ) : (
                <div className="flex h-24 items-center justify-center text-muted-foreground">
                  PDF document
                </div>
              )}
            </div>
            <p className="truncate">
              {item.relatedLabel} · v{item.currentVersionNumber}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.uploadedBy} · {formatDateTime(item.uploadedAt)}
            </p>
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  to="/app/documents/$documentId"
                  params={{ documentId: item.id }}
                />
              }
              nativeButton={false}
            >
              View details
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
