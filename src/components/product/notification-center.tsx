import { useState } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { IconBell, IconCheck } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { formatDateTime } from "@/lib/format"
import type { listNotifications } from "@/server/product/notifications.server"
import {
  markAllNotificationsReadFn,
  markNotificationReadFn,
} from "@/server/product/product.functions"

type Items = Awaited<ReturnType<typeof listNotifications>>

function notificationHref(item: Items[number]) {
  if (!item.entityId) return null
  if (item.entityType === "TRIP") return `/app/trips/${item.entityId}`
  if (item.entityType === "PAYMENT") return `/app/payments/${item.entityId}`
  if (item.entityType === "DOCUMENT") return `/app/documents/${item.entityId}`
  if (item.entityType === "DEAL") return `/app/deals/${item.entityId}`
  return null
}

export function NotificationCenter({
  items,
  tab,
}: {
  items: Items
  tab: "UNREAD" | "READ"
}) {
  const router = useRouter()
  const markOne = useServerFn(markNotificationReadFn)
  const markAll = useServerFn(markAllNotificationsReadFn)
  const [pendingId, setPendingId] = useState("")
  async function read(id: string) {
    setPendingId(id)
    try {
      await markOne({ data: { id } })
      await router.invalidate({ sync: true })
    } finally {
      setPendingId("")
    }
  }
  async function readAll() {
    setPendingId("ALL")
    try {
      await markAll()
      await router.invalidate({ sync: true })
    } finally {
      setPendingId("")
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Updates"
        title="Notifications"
        description="Organization-scoped operational alerts; no SMS, email, or push is sent."
        actions={
          tab === "UNREAD" && items.length ? (
            <Button
              variant="outline"
              onClick={readAll}
              disabled={Boolean(pendingId)}
            >
              {pendingId === "ALL" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <IconCheck data-icon="inline-start" />
              )}
              Mark all read
            </Button>
          ) : undefined
        }
      />
      <div className="flex gap-2">
        <Button
          render={<Link to="/app/notifications" search={{ tab: "UNREAD" }} />}
          nativeButton={false}
          variant={tab === "UNREAD" ? "default" : "outline"}
        >
          Unread
        </Button>
        <Button
          render={<Link to="/app/notifications" search={{ tab: "READ" }} />}
          nativeButton={false}
          variant={tab === "READ" ? "default" : "outline"}
        >
          Read
        </Button>
      </div>
      {!items.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconBell />
            </EmptyMedia>
            <EmptyTitle>No {tab.toLowerCase()} notifications</EmptyTitle>
            <EmptyDescription>
              Relevant operational updates will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const href = notificationHref(item)
            return (
              <Card key={item.id} size="sm">
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{item.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      item.type === "WARNING" ? "destructive" : "secondary"
                    }
                  >
                    {item.type.replaceAll("_", " ")}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p>{item.message}</p>
                </CardContent>
                <CardFooter className="flex-wrap gap-2">
                  {href ? (
                    <Button
                      render={<a href={href} />}
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                    >
                      Open record
                    </Button>
                  ) : null}
                  {!item.readAt ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => read(item.id)}
                      disabled={Boolean(pendingId)}
                    >
                      {pendingId === item.id ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <IconCheck data-icon="inline-start" />
                      )}
                      Mark read
                    </Button>
                  ) : null}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
