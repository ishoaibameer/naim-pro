import { createFileRoute, redirect } from "@tanstack/react-router"

import { MemberShell } from "@/components/operations/member-shell"
import { requireOperationsAccessFn } from "@/server/operations/operations.functions"

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: async () => {
    try {
      return { operationsAuth: await requireOperationsAccessFn() }
    } catch {
      throw redirect({ to: "/" })
    }
  },
  component: OperationsLayout,
})

function OperationsLayout() {
  const { operationsAuth } = Route.useRouteContext()
  return (
    <MemberShell
      name={operationsAuth.user.name}
      role={operationsAuth.membership.role}
    />
  )
}
