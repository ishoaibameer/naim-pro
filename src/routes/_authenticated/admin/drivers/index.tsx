import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { IconPlus } from "@tabler/icons-react"
import { z } from "zod"

import { ListToolbar } from "@/components/admin/list-toolbar"
import { PageHeader } from "@/components/admin/page-header"
import { PartyList } from "@/components/admin/party-list"
import { RecordEmpty } from "@/components/admin/record-empty"
import { Button } from "@/components/ui/button"
import { listDriversFn } from "@/server/admin/admin.functions"

const searchSchema = z.object({
  q: z.string().catch(""),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).catch("ALL"),
  page: z.coerce.number().int().min(1).catch(1),
})

export const Route = createFileRoute("/_authenticated/admin/drivers/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listDriversFn({
      data: {
        search: deps.q,
        status: deps.status,
        page: deps.page,
        pageSize: 20,
      },
    }),
  component: DriversPage,
})

function DriversPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const action = (
    <Button render={<Link to="/admin/drivers/new" />} nativeButton={false}>
      <IconPlus data-icon="inline-start" />
      Add Driver
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Drivers"
        eyebrow="Users"
        description="Manage drivers, current transporter relationships, and optional login accounts."
        actions={action}
      />
      <ListToolbar
        initialSearch={search.q}
        status={search.status}
        onChange={(value) =>
          navigate({
            search: { q: value.search, status: value.status, page: 1 },
          })
        }
      />
      {data.items.length ? (
        <PartyList kind="drivers" items={data.items} />
      ) : (
        <RecordEmpty
          title="No drivers found"
          description="Create the first driver or adjust your search."
          action={action}
        />
      )}
    </div>
  )
}
