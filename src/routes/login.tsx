import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { getCurrentUser, login } from "@/server/auth/auth.functions"
import { getRoleHomePath } from "@/lib/auth-routing"

const GENERIC_CREDENTIAL_ERROR = "Invalid phone number or password."

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const auth = await getCurrentUser()
    if (auth) throw redirect({ to: getRoleHomePath(auth.membership.role) })
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const loginFn = useServerFn(login)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsPending(true)

    const formData = new FormData(event.currentTarget)
    try {
      const auth = await loginFn({
        data: {
          phone: String(formData.get("phone") ?? ""),
          password: String(formData.get("password") ?? ""),
        },
      })
      await router.navigate({ to: getRoleHomePath(auth.membership.role) })
    } catch {
      setError(GENERIC_CREDENTIAL_ERROR)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            NAIM PRO
          </p>
          <CardTitle>
            <h1>Sign in</h1>
          </CardTitle>
          <CardDescription>
            Use the phone number and password assigned by your administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <FieldGroup className="gap-5">
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="9876543210"
                  aria-invalid={Boolean(error)}
                  disabled={isPending}
                  required
                  autoFocus
                />
              </Field>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(error)}
                  disabled={isPending}
                  required
                />
              </Field>
            </FieldGroup>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              {isPending ? "Signing in..." : "Login"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Access and password resets are managed by an administrator.
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}
