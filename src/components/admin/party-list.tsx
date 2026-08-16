import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { StatusBadge } from "@/components/admin/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface PartyListItem {
  id: string
  name: string
  phone: string | null
  location?: string | null
  transporter?: string | null
  status: "ACTIVE" | "INACTIVE"
  loginStatus: "ACTIVE" | "INACTIVE" | null
}

function PartyDetailLink({
  kind,
  id,
  children,
}: {
  kind: "vendors" | "drivers"
  id: string
  children: ReactNode
}) {
  return kind === "vendors" ? (
    <Link to="/admin/vendors/$vendorId" params={{ vendorId: id }}>
      {children}
    </Link>
  ) : (
    <Link to="/admin/drivers/$driverId" params={{ driverId: id }}>
      {children}
    </Link>
  )
}

export function PartyList({
  kind,
  items,
}: {
  kind: "vendors" | "drivers"
  items: PartyListItem[]
}) {
  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <PartyDetailLink key={item.id} kind={kind} id={item.id}>
            <Card>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.phone ?? "No phone"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.location ?? item.transporter ?? "Not assigned"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={item.status} />
                  <StatusBadge status={item.loginStatus} />
                </div>
              </CardContent>
            </Card>
          </PartyDetailLink>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{kind === "vendors" ? "Vendor" : "Driver"}</TableHead>
              <TableHead>
                {kind === "vendors" ? "Location" : "Transporter"}
              </TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <PartyDetailLink kind={kind} id={item.id}>
                    <span className="font-medium hover:underline">
                      {item.name}
                    </span>
                  </PartyDetailLink>
                </TableCell>
                <TableCell>
                  {item.location ?? item.transporter ?? "—"}
                </TableCell>
                <TableCell>{item.phone ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={item.loginStatus} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
