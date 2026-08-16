import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { createMemberFn } from "@/server/admin/admin.functions"

export const Route = createFileRoute("/_authenticated/admin/members/new")({
  component: NewMemberPage,
})

function NewMemberPage() {
  const createMember = useServerFn(createMemberFn)
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    const form = new FormData(event.currentTarget)
    try {
      const created = await createMember({
        data: {
          name: String(form.get("name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          password: String(form.get("password") ?? ""),
          status: String(form.get("status")) as "ACTIVE" | "INACTIVE",
        },
      })
      await navigate({
        to: "/admin/members/$memberId",
        params: { memberId: created.user.id },
      })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create member."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Add member"
        eyebrow="Users"
        description="Create an internal MEMBER account with a temporary password."
      />
      <form onSubmit={submit}>
        <Card>
          <CardContent className="pt-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={160}
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Temporary Password</FieldLabel>
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
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <NativeSelect id="status" name="status" defaultValue="ACTIVE">
                  <NativeSelectOption value="ACTIVE">Active</NativeSelectOption>
                  <NativeSelectOption value="INACTIVE">
                    Inactive
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
            </FieldGroup>
            {error ? (
              <Alert variant="destructive" className="mt-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="sticky bottom-16 gap-2 bg-card py-4 lg:bottom-0">
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}Create
              Member
            </Button>
            <Button
              render={
                <Link
                  to="/admin/members"
                  search={{ q: "", status: "ALL", page: 1 }}
                />
              }
              nativeButton={false}
              variant="outline"
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
