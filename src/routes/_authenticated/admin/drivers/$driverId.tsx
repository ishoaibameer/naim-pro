import { createFileRoute } from "@tanstack/react-router"

import { LinkedPartyDetail } from "@/components/admin/linked-party-detail"
import { getDriverFn } from "@/server/admin/admin.functions"

export const Route = createFileRoute("/_authenticated/admin/drivers/$driverId")(
  {
    loader: ({ params }) => getDriverFn({ data: { id: params.driverId } }),
    component: () => (
      <LinkedPartyDetail kind="DRIVER" party={Route.useLoaderData()} />
    ),
  }
)
