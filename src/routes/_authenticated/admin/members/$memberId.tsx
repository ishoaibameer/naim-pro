import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
import { StatusAction } from "@/components/admin/status-action"
import { StatusBadge } from "@/components/admin/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { formatDate, formatDateTime } from "@/lib/format"
import {
  getMemberFn,
  resetMemberPasswordFn,
  setMemberStatusFn,
} from "@/server/admin/admin.functions"

export const Route = createFileRoute("/_authenticated/admin/members/$memberId")(
  {
    loader: ({ params }) => getMemberFn({ data: { id: params.memberId } }),
    component: MemberDetailPage,
  }
)

function MemberDetailPage() {
  const member = Route.useLoaderData()
  const router = useRouter()
  const setStatus = useServerFn(setMemberStatusFn)
  const resetPassword = useServerFn(resetMemberPasswordFn)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get("password") ?? "")
    if (password !== String(data.get("confirmPassword") ?? "")) {
      setError("Passwords do not match.")
      return
    }
    setPending(true)
    setError(null)
    try {
      await resetPassword({ data: { userId: member.id, password } })
      setMessage("Password reset. All previous sessions revoked.")
      event.currentTarget.reset()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Password reset failed."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Member"
        title={member.name}
        description={member.phone}
        actions={
          <StatusAction
            label={member.status === "ACTIVE" ? "Deactivate" : "Activate"}
            destructive={member.status === "ACTIVE"}
            description={`${member.status === "ACTIVE" ? "Deactivate" : "Activate"} this login account? Business records are not deleted.`}
            onConfirm={async () => {
              await setStatus({
                data: {
                  userId: member.id,
                  status: member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                  version: member.version,
                },
              })
              await router.invalidate({ sync: true })
            }}
          />
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic profile</CardTitle>
            <CardDescription>Member identity and access state.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={member.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Created</dt>
                <dd>{formatDate(member.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Last login</dt>
                <dd>{formatDateTime(member.lastLoginAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Password change
                </dt>
                <dd>
                  {member.mustChangePassword ? "Required" : "Not required"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>
              Sets a temporary password and revokes every prior session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={reset}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="password">New Password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    minLength={10}
                    required
                    autoComplete="new-password"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    Confirm Password
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    minLength={10}
                    required
                    autoComplete="new-password"
                  />
                </Field>
              </FieldGroup>
              {message ? (
                <Alert>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : null}
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}Reset
                Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Activity summary</CardTitle>
          <CardDescription>
            Detailed user activity will appear as actions are recorded.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
