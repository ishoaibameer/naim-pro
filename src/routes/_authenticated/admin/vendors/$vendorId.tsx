import { createFileRoute } from "@tanstack/react-router"

import { LinkedPartyDetail } from "@/components/admin/linked-party-detail"
import { getVendorFn } from "@/server/admin/admin.functions"

export const Route = createFileRoute("/_authenticated/admin/vendors/$vendorId")(
  {
    loader: ({ params }) => getVendorFn({ data: { id: params.vendorId } }),
    component: () => (
      <LinkedPartyDetail kind="VENDOR" party={Route.useLoaderData()} />
    ),
  }
)
