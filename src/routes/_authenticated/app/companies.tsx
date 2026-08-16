import { createFileRoute } from "@tanstack/react-router"
import { MasterDirectory } from "@/components/operations/master-directory"
import { getOperationalMastersFn } from "@/server/operations/operations.functions"

export const Route = createFileRoute("/_authenticated/app/companies")({
  loader: () => getOperationalMastersFn(),
  component: () => {
    const data = Route.useLoaderData()
    return (
      <MasterDirectory
        title="Companies"
        description="Read-only destination directory. Management remains in Admin."
        records={data.companies}
      />
    )
  },
})
