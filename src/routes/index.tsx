import { createFileRoute, redirect } from "@tanstack/react-router"

import { getCurrentUser } from "@/server/auth/auth.functions"
import { getRoleHomePath } from "@/lib/auth-routing"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const auth = await getCurrentUser()
    throw redirect({
      to: auth ? getRoleHomePath(auth.membership.role) : "/login",
    })
  },
})
