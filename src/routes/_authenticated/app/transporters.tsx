import { createFileRoute } from "@tanstack/react-router"
import { MasterDirectory } from "@/components/operations/master-directory"
import { getOperationalMastersFn } from "@/server/operations/operations.functions"

export const Route = createFileRoute("/_authenticated/app/transporters")({
  loader: () => getOperationalMastersFn(),
  component: () => {
    const data = Route.useLoaderData()
    return (
      <MasterDirectory
        title="Transporters"
        description="Read-only operational directory. Management remains in Admin."
        records={data.transporters}
      />
    )
  },
})
