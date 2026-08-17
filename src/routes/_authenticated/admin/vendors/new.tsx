import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
import {
  DynamicFields,
  parseCustomFieldValues,
} from "@/components/custom-fields/dynamic-fields"
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { createVendorFn } from "@/server/admin/admin.functions"
import {
  getCustomFieldDefinitionsForCreateFn,
  saveCustomFieldValuesFn,
  validateCustomFieldValuesForCreateFn,
} from "@/server/custom-fields/custom-field.functions"

export const Route = createFileRoute("/_authenticated/admin/vendors/new")({
  loader: () => getCustomFieldDefinitionsForCreateFn({ data: "VENDOR" }),
  component: NewVendorPage,
})

function NewVendorPage() {
  const createVendor = useServerFn(createVendorFn)
  const saveCustomFields = useServerFn(saveCustomFieldValuesFn)
  const validateCustomFields = useServerFn(validateCustomFieldValuesForCreateFn)
  const customFields = Route.useLoaderData()
  const navigate = useNavigate()
  const [loginEnabled, setLoginEnabled] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    try {
      const customValues = parseCustomFieldValues(form)
      await validateCustomFields({
        data: { target: "VENDOR", values: customValues },
      })
      const created = await createVendor({
        data: {
          name: String(form.get("name") ?? ""),
          contactPerson: String(form.get("contactPerson") ?? ""),
          phone: String(form.get("phone") ?? ""),
          location: String(form.get("location") ?? ""),
          notes: String(form.get("notes") ?? ""),
          status: String(form.get("status")) as "ACTIVE" | "INACTIVE",
          loginEnabled,
          loginName: String(form.get("loginName") ?? ""),
          loginPhone: String(form.get("loginPhone") ?? ""),
          temporaryPassword: String(form.get("temporaryPassword") ?? ""),
        },
      })
      await saveCustomFields({
        data: {
          target: "VENDOR",
          recordId: created.id,
          values: customValues,
        },
      })
      await navigate({
        to: "/admin/vendors/$vendorId",
        params: { vendorId: created.id },
      })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create vendor."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Add vendor"
        eyebrow="Users"
        description="Create a vendor business record, with optional login access."
      />
      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle>Vendor details</CardTitle>
            <CardDescription>
              The business record remains independent from login access.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Vendor Name</FieldLabel>
                <Input id="name" name="name" required autoFocus />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-person">Contact Person</FieldLabel>
                <Input id="contact-person" name="contactPerson" />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input id="phone" name="phone" type="tel" inputMode="tel" />
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Location</FieldLabel>
                <Input id="location" name="location" />
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Address / Notes</FieldLabel>
                <Textarea id="notes" name="notes" rows={4} />
              </Field>
              <Field>
                <FieldLabel htmlFor="status">Business Status</FieldLabel>
                <NativeSelect id="status" name="status" defaultValue="ACTIVE">
                  <NativeSelectOption value="ACTIVE">Active</NativeSelectOption>
                  <NativeSelectOption value="INACTIVE">
                    Inactive
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field orientation="horizontal">
                <div className="flex-1">
                  <FieldLabel htmlFor="login-enabled">Login Enabled</FieldLabel>
                  <FieldDescription>
                    Create and link a separate VENDOR user account.
                  </FieldDescription>
                </div>
                <Switch
                  id="login-enabled"
                  checked={loginEnabled}
                  onCheckedChange={setLoginEnabled}
                />
              </Field>
            </FieldGroup>
            {loginEnabled ? (
              <Card>
                <CardHeader>
                  <CardTitle>Login access</CardTitle>
                  <CardDescription>
                    This password is hashed and must be changed after first
                    login.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="login-name">Login Name</FieldLabel>
                      <Input id="login-name" name="loginName" required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="login-phone">Login Phone</FieldLabel>
                      <Input
                        id="login-phone"
                        name="loginPhone"
                        type="tel"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="temporary-password">
                        Temporary Password
                      </FieldLabel>
                      <Input
                        id="temporary-password"
                        name="temporaryPassword"
                        type="password"
                        minLength={10}
                        required
                        autoComplete="new-password"
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>
            ) : null}
            <DynamicFields
              target="VENDOR"
              recordId={null}
              fields={customFields.fields}
              inputName="customFields"
            />
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="sticky bottom-16 gap-2 bg-card py-4 lg:bottom-0">
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}Create
              Vendor
            </Button>
            <Button
              render={
                <Link
                  to="/admin/vendors"
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
