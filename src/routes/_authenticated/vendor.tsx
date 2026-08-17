import { createFileRoute, redirect } from "@tanstack/react-router"

import { VendorShell } from "@/components/vendor/vendor-shell"
import { requireVendorAccessFn } from "@/server/vendor/vendor.functions"

export const Route = createFileRoute("/_authenticated/vendor")({
  beforeLoad: async () => {
    try {
      return { vendorAuth: await requireVendorAccessFn() }
    } catch {
      throw redirect({ to: "/" })
    }
  },
  component: VendorLayout,
})

function VendorLayout() {
  const { vendorAuth } = Route.useRouteContext()
  return (
    <VendorShell
      userName={vendorAuth.user.name}
      vendorName={vendorAuth.vendor.name}
    />
  )
}
