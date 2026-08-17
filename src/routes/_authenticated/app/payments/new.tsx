import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
import {
  DynamicFields,
  parseCustomFieldValues,
} from "@/components/custom-fields/dynamic-fields"
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
  createPaymentFn,
  getFinanceMastersFn,
} from "@/server/finance/finance.functions"
import { paymentCreateSearchSchema } from "@/server/finance/schemas"
import {
  getCustomFieldDefinitionsForCreateFn,
  saveCustomFieldValuesFn,
  validateCustomFieldValuesForCreateFn,
} from "@/server/custom-fields/custom-field.functions"

export const Route = createFileRoute("/_authenticated/app/payments/new")({
  validateSearch: paymentCreateSearchSchema,
  loader: async () => {
    const [masters, customFields] = await Promise.all([
      getFinanceMastersFn(),
      getCustomFieldDefinitionsForCreateFn({ data: "PAYMENT" }),
    ])
    return { masters, customFields }
  },
  component: NewPayment,
})
function NewPayment() {
  const { masters, customFields } = Route.useLoaderData()
  const prefill = Route.useSearch()
  const navigate = useNavigate()
  const create = useServerFn(createPaymentFn)
  const saveCustomFields = useServerFn(saveCustomFieldValuesFn)
  const validateCustomFields = useServerFn(validateCustomFieldValuesForCreateFn)
  const [partyType, setPartyType] = useState<
    "VENDOR" | "TRANSPORTER" | "COMPANY"
  >(prefill.partyType ?? "VENDOR")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const parties =
    partyType === "VENDOR"
      ? masters.vendors
      : partyType === "TRANSPORTER"
        ? masters.transporters
        : masters.companies
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      const customValues = parseCustomFieldValues(form)
      await validateCustomFields({
        data: { target: "PAYMENT", values: customValues },
      })
      const payment = await create({
        data: {
          idempotencyKey,
          partyType,
          partyId: String(form.get("partyId")),
          direction: partyType === "COMPANY" ? "INCOMING" : "OUTGOING",
          type: String(form.get("type")) as
            "ADVANCE" | "PARTIAL" | "FINAL" | "REFUND" | "ADJUSTMENT",
          amount: String(form.get("amount")),
          paymentDate: String(form.get("paymentDate")),
          paymentMode: String(form.get("paymentMode")) as
            "CASH" | "BANK_TRANSFER" | "CHEQUE" | "UPI" | "OTHER",
          receiptNumber: String(form.get("receiptNumber") ?? ""),
          notes: String(form.get("notes") ?? ""),
          paidByMembershipId: String(form.get("paidByMembershipId") ?? ""),
          dealId: String(form.get("dealId") ?? ""),
          tripId: String(form.get("tripId") ?? ""),
          billId: String(form.get("billId") ?? ""),
        },
      })
      await saveCustomFields({
        data: {
          target: "PAYMENT",
          recordId: payment.id,
          values: customValues,
        },
      })
      await navigate({
        to: "/app/payments/$paymentId",
        params: { paymentId: payment.id },
      })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Payment could not be recorded."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Finance"
        title="Add Payment"
        description="Payments post immediately and cannot be silently edited."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to record Payment</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={submit}>
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Payment details</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="partyType">Party Type *</FieldLabel>
                <NativeSelect
                  id="partyType"
                  value={partyType}
                  onChange={(event) =>
                    setPartyType(event.target.value as typeof partyType)
                  }
                >
                  <NativeSelectOption value="VENDOR">Vendor</NativeSelectOption>
                  <NativeSelectOption value="TRANSPORTER">
                    Transporter
                  </NativeSelectOption>
                  <NativeSelectOption value="COMPANY">
                    Company
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="partyId">Party *</FieldLabel>
                <NativeSelect
                  id="partyId"
                  name="partyId"
                  defaultValue={prefill.partyId ?? ""}
                  required
                  className="w-full"
                >
                  <NativeSelectOption value="">Select…</NativeSelectOption>
                  {parties.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="amount">Amount *</FieldLabel>
                  <Input
                    id="amount"
                    name="amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="paymentDate">Payment Date *</FieldLabel>
                  <Input
                    id="paymentDate"
                    name="paymentDate"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </Field>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="type">Payment Type *</FieldLabel>
                  <NativeSelect id="type" name="type" required>
                    {[
                      "ADVANCE",
                      "PARTIAL",
                      "FINAL",
                      "ADJUSTMENT",
                      "REFUND",
                    ].map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {value}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="paymentMode">Payment Mode *</FieldLabel>
                  <NativeSelect id="paymentMode" name="paymentMode" required>
                    {["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "OTHER"].map(
                      (value) => (
                        <NativeSelectOption key={value} value={value}>
                          {value.replaceAll("_", " ")}
                        </NativeSelectOption>
                      )
                    )}
                  </NativeSelect>
                </Field>
              </div>
              {partyType === "VENDOR" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="dealId">Related Deal</FieldLabel>
                    <NativeSelect
                      id="dealId"
                      name="dealId"
                      defaultValue={prefill.dealId ?? ""}
                      className="w-full"
                    >
                      <NativeSelectOption value="">
                        Unallocated
                      </NativeSelectOption>
                      {masters.deals
                        .filter(
                          (item) =>
                            !prefill.partyId ||
                            item.vendorId === prefill.partyId
                        )
                        .map((item) => (
                          <NativeSelectOption key={item.id} value={item.id}>
                            {item.label}
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="tripId">
                      Related Trip (instead of Deal)
                    </FieldLabel>
                    <NativeSelect
                      id="tripId"
                      name="tripId"
                      defaultValue={prefill.tripId ?? ""}
                      className="w-full"
                    >
                      <NativeSelectOption value="">None</NativeSelectOption>
                      {masters.trips.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </>
              ) : partyType === "TRANSPORTER" ? (
                <Field>
                  <FieldLabel htmlFor="tripId">Related Trip *</FieldLabel>
                  <NativeSelect
                    id="tripId"
                    name="tripId"
                    defaultValue={prefill.tripId ?? ""}
                    required
                    className="w-full"
                  >
                    <NativeSelectOption value="">Select…</NativeSelectOption>
                    {masters.trips.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="billId">
                    Related Issued Bill *
                  </FieldLabel>
                  <NativeSelect
                    id="billId"
                    name="billId"
                    defaultValue={prefill.billId ?? ""}
                    required
                    className="w-full"
                  >
                    <NativeSelectOption value="">Select…</NativeSelectOption>
                    {masters.bills
                      .filter((item) => item.status === "ISSUED")
                      .map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.label}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="paidByMembershipId">
                  Paid By Member
                </FieldLabel>
                <NativeSelect
                  id="paidByMembershipId"
                  name="paidByMembershipId"
                  className="w-full"
                >
                  <NativeSelectOption value="">Current user</NativeSelectOption>
                  {masters.members.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="receiptNumber">Receipt Number</FieldLabel>
                <Input id="receiptNumber" name="receiptNumber" />
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Receipt document upload will be added in Step 8."
                />
              </Field>
            </FieldGroup>
            <DynamicFields
              target="PAYMENT"
              recordId={null}
              fields={customFields.fields}
              inputName="customFields"
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Posting…" : "Post Payment"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
