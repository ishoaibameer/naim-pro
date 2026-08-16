import { createFileRoute, redirect } from "@tanstack/react-router"

import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminAccessFn } from "@/server/admin/admin.functions"

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    try {
      const auth = await requireAdminAccessFn()
      return { adminAuth: auth }
    } catch {
      throw redirect({ to: "/app" })
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { adminAuth } = Route.useRouteContext()
  return <AdminShell adminName={adminAuth.user.name} />
}
