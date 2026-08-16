import { useState } from "react"
import type { FormEvent } from "react"
import { useRouter } from "@tanstack/react-router"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/format"
import { resetUserPasswordFn } from "@/server/auth/auth.functions"
import {
  setManagedAccountStatusFn,
  setPartyStatusFn,
} from "@/server/admin/admin.functions"

export interface LinkedPartyDetailData {
  id: string
  name: string
  phone: string | null
  status: "ACTIVE" | "INACTIVE"
  userId: string | null
  loginStatus: "ACTIVE" | "INACTIVE" | null
  loginVersion: number | null
  version: number
  createdAt: Date
  contactPerson?: string | null
  location?: string | null
  notes?: string | null
  transporter?: string | null
}

export function LinkedPartyDetail({
  kind,
  party,
}: {
  kind: "VENDOR" | "DRIVER"
  party: LinkedPartyDetailData
}) {
  const router = useRouter()
  const setBusinessStatus = useServerFn(setPartyStatusFn)
  const setLoginStatus = useServerFn(setManagedAccountStatusFn)
  const resetPassword = useServerFn(resetUserPasswordFn)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!party.userId) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("Passwords do not match.")
      return
    }
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      await resetPassword({
        data: { targetUserId: party.userId, newPassword: password },
      })
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
  const label = kind === "VENDOR" ? "Vendor" : "Driver"
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={label}
        title={party.name}
        description={party.phone ?? "No phone recorded"}
        actions={
          <StatusAction
            label={
              party.status === "ACTIVE"
                ? `Deactivate ${label}`
                : `Activate ${label}`
            }
            destructive={party.status === "ACTIVE"}
            description={`This changes only the ${label.toLowerCase()} business record. Login access remains separate.`}
            onConfirm={async () => {
              await setBusinessStatus({
                data: {
                  entity: kind,
                  id: party.id,
                  status: party.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                  version: party.version,
                },
              })
              await router.invalidate({ sync: true })
            }}
          />
        }
      />
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="login">Login Access</TabsTrigger>
          <TabsTrigger value="future">
            {kind === "VENDOR" ? "Future Deals" : "Future Trips"}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>
                Business profile and current relationship.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Business status
                  </dt>
                  <dd className="mt-1">
                    <StatusBadge status={party.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd>{formatDate(party.createdAt)}</dd>
                </div>
                {party.contactPerson ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Contact person
                    </dt>
                    <dd>{party.contactPerson}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {kind === "VENDOR" ? "Location" : "Current transporter"}
                  </dt>
                  <dd>
                    {party.location ?? party.transporter ?? "Not assigned"}
                  </dd>
                </div>
                {party.notes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">
                      Address / Notes
                    </dt>
                    <dd className="whitespace-pre-wrap">{party.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="login" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Login access</CardTitle>
              <CardDescription>
                The business status and login status are independent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {party.userId && party.loginStatus && party.loginVersion ? (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between gap-4">
                    <StatusBadge status={party.loginStatus} />
                    <StatusAction
                      label={
                        party.loginStatus === "ACTIVE"
                          ? "Deactivate Login"
                          : "Activate Login"
                      }
                      destructive={party.loginStatus === "ACTIVE"}
                      description="This changes only the linked login account and revokes sessions when deactivated."
                      onConfirm={async () => {
                        await setLoginStatus({
                          data: {
                            userId: party.userId!,
                            status:
                              party.loginStatus === "ACTIVE"
                                ? "INACTIVE"
                                : "ACTIVE",
                            version: party.loginVersion!,
                          },
                        })
                        await router.invalidate({ sync: true })
                      }}
                    />
                  </div>
                  <form className="flex flex-col gap-5" onSubmit={reset}>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="new-password">
                          New Password
                        </FieldLabel>
                        <Input
                          id="new-password"
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
                      {pending ? <Spinner data-icon="inline-start" /> : null}
                      Reset Password
                    </Button>
                  </form>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No login account is linked to this {label.toLowerCase()}.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="future" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {kind === "VENDOR" ? "Deals and payments" : "Trip history"}
              </CardTitle>
              <CardDescription>
                This placeholder is reserved for a later product step.
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>
                Related human-readable activity appears on the Activity page.
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
