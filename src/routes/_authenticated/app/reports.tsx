import { createFileRoute } from "@tanstack/react-router"

import { ReportsPage } from "@/components/reports/reports-page"
import {
  getReportFn,
  getReportMastersFn,
} from "@/server/product/product.functions"
import { reportFilterSchema } from "@/server/product/schemas"

export const Route = createFileRoute("/_authenticated/app/reports")({
  validateSearch: reportFilterSchema,
  loaderDeps: ({ search }) => ({
    report: search.report,
    from: search.from,
    to: search.to,
    status: search.status,
    vendorId: search.vendorId,
    vehicleId: search.vehicleId,
    driverId: search.driverId,
    transporterId: search.transporterId,
    companyId: search.companyId,
    pickupId: search.pickupId,
    destinationId: search.destinationId,
    partyType: search.partyType,
    partyId: search.partyId,
    direction: search.direction,
    paymentType: search.paymentType,
    memberId: search.memberId,
    minDifferencePct: search.minDifferencePct,
  }),
  loader: async ({ deps }) => {
    const [report, masters] = await Promise.all([
      getReportFn({ data: deps }),
      getReportMastersFn(),
    ])
    return { report, masters }
  },
  component: ReportsRoute,
})

function ReportsRoute() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  return <ReportsPage {...data} filters={search} />
}
