import { createFileRoute, redirect } from "@tanstack/react-router"

import { RoleLandingPage } from "@/components/admin/role-landing-page"

export const Route = createFileRoute("/_authenticated/vendor")({
  beforeLoad: ({ context }) => {
    if (context.auth.membership.role !== "VENDOR") throw redirect({ to: "/" })
  },
  component: () => <RoleLandingPage title="Vendor workspace" />,
})
