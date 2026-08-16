import { createFileRoute, redirect } from "@tanstack/react-router"

import { RoleLandingPage } from "@/components/admin/role-landing-page"

export const Route = createFileRoute("/_authenticated/driver")({
  beforeLoad: ({ context }) => {
    if (context.auth.membership.role !== "DRIVER") throw redirect({ to: "/" })
  },
  component: () => <RoleLandingPage title="Driver workspace" />,
})
