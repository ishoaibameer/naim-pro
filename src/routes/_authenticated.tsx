import { createFileRoute, redirect } from "@tanstack/react-router"

import { getCurrentUser } from "@/server/auth/auth.functions"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const auth = await getCurrentUser()
    if (!auth) throw redirect({ to: "/login" })
    return { auth }
  },
})
