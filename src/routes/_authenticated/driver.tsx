import { createFileRoute, redirect } from "@tanstack/react-router"

import { DriverShell } from "@/components/driver/driver-shell"
import { requireDriverAccessFn } from "@/server/driver/driver.functions"

export const Route = createFileRoute("/_authenticated/driver")({
  beforeLoad: async () => {
    try {
      return { driverAuth: await requireDriverAccessFn() }
    } catch {
      throw redirect({ to: "/" })
    }
  },
  component: DriverLayout,
})

function DriverLayout() {
  const { driverAuth } = Route.useRouteContext()
  return (
    <DriverShell
      userName={driverAuth.user.name}
      driverName={driverAuth.driver.name}
    />
  )
}
