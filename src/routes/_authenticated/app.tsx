import { useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { logout } from "@/server/auth/auth.functions"

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: ({ context }) => {
    if (context.auth.membership.role !== "MEMBER") throw redirect({ to: "/" })
  },
  component: ProtectedAppPage,
})

function ProtectedAppPage() {
  const { auth } = Route.useRouteContext()
  const logoutFn = useServerFn(logout)
  const [isPending, setIsPending] = useState(false)

  async function handleLogout() {
    setIsPending(true)
    try {
      await logoutFn()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1>NAIM PRO</h1>
          </CardTitle>
          <CardDescription>
            Authentication foundation is active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase">Signed in as</dt>
              <dd>{auth.user.name}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase">Role</dt>
              <dd>{auth.membership.role}</dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={handleLogout}
          >
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            {isPending ? "Signing out..." : "Logout"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
