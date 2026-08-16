import { useState } from "react"
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

export function RoleLandingPage({ title }: { title: string }) {
  const logoutFn = useServerFn(logout)
  const [pending, setPending] = useState(false)
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            This role workspace is protected and ready for a later product step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No business modules have been enabled here yet.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              try {
                await logoutFn()
              } finally {
                setPending(false)
              }
            }}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Sign out
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
