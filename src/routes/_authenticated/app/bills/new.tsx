import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  createBillFn,
  getFinanceMastersFn,
} from "@/server/finance/finance.functions"
import { billCreateSearchSchema } from "@/server/finance/schemas"

export const Route = createFileRoute("/_authenticated/app/bills/new")({
  validateSearch: billCreateSearchSchema,
  loader: () => getFinanceMastersFn(),
  component: NewBill,
})
function NewBill() {
  const masters = Route.useLoaderData()
  const prefill = Route.useSearch()
  const create = useServerFn(createBillFn)
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [key] = useState(() => crypto.randomUUID())
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      const bill = await create({
        data: {
          idempotencyKey: key,
          companyId: String(form.get("companyId")),
          billNumber: String(form.get("billNumber")),
          billDate: String(form.get("billDate")),
          tripId: String(form.get("tripId")),
          billedAmount: String(form.get("billedAmount")),
          notes: String(form.get("notes") ?? ""),
        },
      })
      await navigate({ to: "/app/bills/$billId", params: { billId: bill.id } })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Bill could not be prepared."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Finance"
        title="Prepare Bill"
        description="Creates an immutable draft line for one delivered Trip. An Administrator issues it."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to prepare Bill</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={submit}>
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Company Bill</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="companyId">Company *</FieldLabel>
                <NativeSelect
                  id="companyId"
                  name="companyId"
                  required
                  className="w-full"
                >
                  <NativeSelectOption value="">Select…</NativeSelectOption>
                  {masters.companies.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="tripId">Delivered Trip *</FieldLabel>
                <NativeSelect
                  id="tripId"
                  name="tripId"
                  defaultValue={prefill.tripId ?? ""}
                  required
                  className="w-full"
                >
                  <NativeSelectOption value="">Select…</NativeSelectOption>
                  {masters.trips
                    .filter((item) =>
                      ["DELIVERED", "SETTLEMENT_PENDING", "SETTLED"].includes(
                        item.status
                      )
                    )
                    .map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.label}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="billNumber">Bill Number *</FieldLabel>
                  <Input id="billNumber" name="billNumber" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="billDate">Bill Date *</FieldLabel>
                  <Input
                    id="billDate"
                    name="billDate"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="billedAmount">Billed Amount *</FieldLabel>
                <Input
                  id="billedAmount"
                  name="billedAmount"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Bill document upload will be added in Step 8."
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}Prepare
              Draft Bill
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
