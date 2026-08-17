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
import {
  createDriverFn,
  listTransportersFn,
} from "@/server/admin/admin.functions"
import {
  getCustomFieldDefinitionsForCreateFn,
  saveCustomFieldValuesFn,
  validateCustomFieldValuesForCreateFn,
} from "@/server/custom-fields/custom-field.functions"

export const Route = createFileRoute("/_authenticated/admin/drivers/new")({
  loader: async () => {
    const [transporters, customFields] = await Promise.all([
      listTransportersFn({ data: { search: "" } }),
      getCustomFieldDefinitionsForCreateFn({ data: "DRIVER" }),
    ])
    return { transporters, customFields }
  },
  component: NewDriverPage,
})

function NewDriverPage() {
  const { transporters, customFields } = Route.useLoaderData()
  const createDriver = useServerFn(createDriverFn)
  const saveCustomFields = useServerFn(saveCustomFieldValuesFn)
  const validateCustomFields = useServerFn(validateCustomFieldValuesForCreateFn)
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
        data: { target: "DRIVER", values: customValues },
      })
      const created = await createDriver({
        data: {
          name: String(form.get("name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          transporterId: String(form.get("transporterId") ?? ""),
          status: String(form.get("status")) as "ACTIVE" | "INACTIVE",
          loginEnabled,
          loginName: String(form.get("loginName") ?? ""),
          loginPhone: String(form.get("loginPhone") ?? ""),
          temporaryPassword: String(form.get("temporaryPassword") ?? ""),
        },
      })
      await saveCustomFields({
        data: {
          target: "DRIVER",
          recordId: created.id,
          values: customValues,
        },
      })
      await navigate({
        to: "/admin/drivers/$driverId",
        params: { driverId: created.id },
      })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create driver."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Add driver"
        eyebrow="Users"
        description="Create a driver and optionally link transporter and login access."
      />
      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle>Driver details</CardTitle>
            <CardDescription>
              Drivers are never permanently bound to vehicles.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Driver Name</FieldLabel>
                <Input id="name" name="name" required autoFocus />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input id="phone" name="phone" type="tel" />
              </Field>
              <Field>
                <FieldLabel htmlFor="transporter">
                  Current Transporter
                </FieldLabel>
                <NativeSelect
                  id="transporter"
                  name="transporterId"
                  defaultValue=""
                >
                  <NativeSelectOption value="">Not assigned</NativeSelectOption>
                  {transporters.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
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
                    Create and link a separate DRIVER user account.
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
              target="DRIVER"
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
              Driver
            </Button>
            <Button
              render={
                <Link
                  to="/admin/drivers"
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
