import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { IconPlus } from "@tabler/icons-react"
import { z } from "zod"

import { ListToolbar } from "@/components/admin/list-toolbar"
import { PageHeader } from "@/components/admin/page-header"
import { RecordEmpty } from "@/components/admin/record-empty"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import { listMembersFn } from "@/server/admin/admin.functions"

const searchSchema = z.object({
  q: z.string().catch(""),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).catch("ALL"),
  page: z.coerce.number().int().min(1).catch(1),
})

export const Route = createFileRoute("/_authenticated/admin/members/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listMembersFn({
      data: {
        search: deps.q,
        status: deps.status,
        page: deps.page,
        pageSize: 20,
      },
    }),
  component: MembersPage,
})

function MembersPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const action = (
    <Button render={<Link to="/admin/members/new" />} nativeButton={false}>
      <IconPlus data-icon="inline-start" />
      Add Member
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        eyebrow="Users"
        description="Manage internal member accounts and access."
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
      {data.items.length === 0 ? (
        <RecordEmpty
          title="No members found"
          description="Create the first member or adjust your search."
          action={action}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {data.items.map((member) => (
              <Link
                key={member.id}
                to="/admin/members/$memberId"
                params={{ memberId: member.id }}
              >
                <Card>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.phone}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Created {formatDate(member.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={member.status} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        to="/admin/members/$memberId"
                        params={{ memberId: member.id }}
                      >
                        {member.name}
                      </Link>
                    </TableCell>
                    <TableCell>{member.phone}</TableCell>
                    <TableCell>
                      <StatusBadge status={member.status} />
                    </TableCell>
                    <TableCell>{formatDate(member.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data.total} member{data.total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={search.page === 1}
                onClick={() =>
                  navigate({ search: { ...search, page: search.page - 1 } })
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={search.page * data.pageSize >= data.total}
                onClick={() =>
                  navigate({ search: { ...search, page: search.page + 1 } })
                }
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
