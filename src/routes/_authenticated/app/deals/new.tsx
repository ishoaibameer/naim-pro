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
  createDealFn,
  getOperationalMastersFn,
} from "@/server/operations/operations.functions"

export const Route = createFileRoute("/_authenticated/app/deals/new")({
  loader: () => getOperationalMastersFn(),
  component: NewDeal,
})
function NewDeal() {
  const masters = Route.useLoaderData()
  const create = useServerFn(createDealFn)
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      const deal = await create({
        data: {
          vendorId: String(form.get("vendorId")),
          pickupLocationId: String(form.get("pickupLocationId")),
          materialId: String(form.get("materialId")),
          purchaseRate: String(form.get("purchaseRate")),
          expectedQuantityMt: String(form.get("expectedQuantityMt") ?? ""),
          ownerMembershipId: String(form.get("ownerMembershipId")),
          notes: String(form.get("notes") ?? ""),
        },
      })
      await navigate({ to: "/app/deals/$dealId", params: { dealId: deal.id } })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Deal could not be created."
      )
    } finally {
      setPending(false)
    }
  }
  const options = (items: ReadonlyArray<{ id: string; label: string }>) => (
    <>
      {<NativeSelectOption value="">Select…</NativeSelectOption>}
      {items.map((item) => (
        <NativeSelectOption key={item.id} value={item.id}>
          {item.label}
        </NativeSelectOption>
      ))}
    </>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Deals"
        title="Create Deal"
        description="Select existing master records; commercial values are stored exactly."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to create Deal</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={submit}>
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Purchase agreement</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="vendorId">Vendor *</FieldLabel>
                <NativeSelect
                  id="vendorId"
                  name="vendorId"
                  required
                  className="w-full"
                >
                  {options(masters.vendors)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="pickupLocationId">
                  Pickup Location *
                </FieldLabel>
                <NativeSelect
                  id="pickupLocationId"
                  name="pickupLocationId"
                  required
                  className="w-full"
                >
                  {options(masters.locations)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="materialId">Material *</FieldLabel>
                <NativeSelect
                  id="materialId"
                  name="materialId"
                  required
                  className="w-full"
                >
                  {options(masters.materials)}
                </NativeSelect>
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="purchaseRate">
                    Purchase Rate per ton *
                  </FieldLabel>
                  <Input
                    id="purchaseRate"
                    name="purchaseRate"
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="expectedQuantityMt">
                    Expected Quantity (Ton)
                  </FieldLabel>
                  <Input
                    id="expectedQuantityMt"
                    name="expectedQuantityMt"
                    inputMode="decimal"
                    placeholder="0.000"
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="ownerMembershipId">
                  Owner Member *
                </FieldLabel>
                <NativeSelect
                  id="ownerMembershipId"
                  name="ownerMembershipId"
                  required
                  className="w-full"
                >
                  {options(masters.members)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" name="notes" />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Creating…" : "Create Active Deal"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
