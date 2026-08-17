import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDateTime, initials } from "@/lib/format"

function entityHref(entityType: string | null, entityId: string | null) {
  if (!entityType || !entityId) return null
  if (entityType === "TRIP") return `/app/trips/${entityId}`
  if (entityType === "DEAL") return `/app/deals/${entityId}`
  if (entityType === "PAYMENT") return `/app/payments/${entityId}`
  if (entityType === "DOCUMENT") return `/app/documents/${entityId}`
  return null
}

export function ActivityEntry({
  item,
}: {
  item: {
    id: string
    eventType: string
    message: string
    entityType: string | null
    entityId: string | null
    actorName: string | null
    createdAt: Date | string
  }
}) {
  const actor = item.actorName ?? "System"
  const href = entityHref(item.entityType, item.entityId)
  return (
    <Card size="sm">
      <CardContent className="flex items-start gap-3">
        <Avatar className="size-9">
          <AvatarFallback>{initials(actor)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{actor}</span>
            <Badge variant="secondary">
              {item.eventType.replaceAll("_", " ")}
            </Badge>
            {item.entityType ? (
              <span className="text-xs text-muted-foreground">
                {item.entityType}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm">{item.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(item.createdAt)}
          </p>
          {href ? (
            <a
              href={href}
              className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            >
              Open related record
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
