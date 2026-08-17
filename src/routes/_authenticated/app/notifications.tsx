import { createFileRoute } from "@tanstack/react-router"

import { NotificationCenter } from "@/components/product/notification-center"
import { listNotificationsFn } from "@/server/product/product.functions"
import { notificationListSchema } from "@/server/product/schemas"

export const Route = createFileRoute("/_authenticated/app/notifications")({
  validateSearch: notificationListSchema,
  loaderDeps: ({ search: { tab } }) => ({ tab }),
  loader: ({ deps }) => listNotificationsFn({ data: deps }),
  component: NotificationsRoute,
})

function NotificationsRoute() {
  return (
    <NotificationCenter
      items={Route.useLoaderData()}
      tab={Route.useSearch().tab}
    />
  )
}
