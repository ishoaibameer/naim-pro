import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { PageHeader } from "@/components/admin/page-header"
import {
  DealInlineMasterSheet,
  DealMasterEmptyState,
} from "@/components/operations/deal-inline-master-sheet"
import type { InlineMasterResult } from "@/components/operations/deal-inline-master-sheet"
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
  createDealFn,
  createInlineLocationFn,
  createInlineMaterialFn,
  createInlineVendorFn,
  getOperationalMastersFn,
} from "@/server/operations/operations.functions"
import {
  getCustomFieldDefinitionsForCreateFn,
  saveCustomFieldValuesFn,
  validateCustomFieldValuesForCreateFn,
} from "@/server/custom-fields/custom-field.functions"

export const Route = createFileRoute("/_authenticated/app/deals/new")({
  loader: async () => {
    const [masters, customFields] = await Promise.all([
      getOperationalMastersFn(),
      getCustomFieldDefinitionsForCreateFn({ data: "DEAL" }),
    ])
    return { masters, customFields }
  },
  component: NewDeal,
})
function NewDeal() {
  const { masters: initialMasters, customFields } = Route.useLoaderData()
  const { operationsAuth } = Route.useRouteContext()
  const isAdmin = operationsAuth.membership.role === "ADMIN"
  const [masters, setMasters] = useState(initialMasters)
  const [selected, setSelected] = useState({
    vendorId: "",
    pickupLocationId: "",
    materialId: "",
  })
  const create = useServerFn(createDealFn)
  const createVendor = useServerFn(createInlineVendorFn)
  const createLocation = useServerFn(createInlineLocationFn)
  const createMaterial = useServerFn(createInlineMaterialFn)
  const saveCustomFields = useServerFn(saveCustomFieldValuesFn)
  const validateCustomFields = useServerFn(validateCustomFieldValuesForCreateFn)
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [masterNotice, setMasterNotice] = useState("")

  function mergeOption(
    items: ReadonlyArray<{ id: string; label: string }>,
    result: InlineMasterResult
  ) {
    return [
      ...items.filter((item) => item.id !== result.id),
      { id: result.id, label: result.label },
    ].sort((left, right) => left.label.localeCompare(right.label))
  }

  function createdMessage(label: string, result: InlineMasterResult) {
    return result.created
      ? `${label} created and selected.`
      : `${label} already existed and has been selected.`
  }

  function handleVendorCreated(result: InlineMasterResult) {
    setMasters((current) => ({
      ...current,
      vendors: mergeOption(current.vendors, result),
    }))
    setSelected((current) => ({ ...current, vendorId: result.id }))
    setMasterNotice(createdMessage("Vendor", result))
  }

  function handleLocationCreated(result: InlineMasterResult) {
    setMasters((current) => ({
      ...current,
      locations: [
        ...current.locations.filter((item) => item.id !== result.id),
        {
          id: result.id,
          label: result.label,
          type: result.locationType ?? "PICKUP",
        },
      ].sort((left, right) => left.label.localeCompare(right.label)),
    }))
    setSelected((current) => ({
      ...current,
      pickupLocationId: result.id,
    }))
    setMasterNotice(createdMessage("Location", result))
  }

  function handleMaterialCreated(result: InlineMasterResult) {
    setMasters((current) => ({
      ...current,
      materials: mergeOption(current.materials, result),
    }))
    setSelected((current) => ({ ...current, materialId: result.id }))
    setMasterNotice(createdMessage("Material", result))
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      const customValues = parseCustomFieldValues(form)
      await validateCustomFields({
        data: { target: "DEAL", values: customValues },
      })
      const dealInput = {
        vendorId: String(form.get("vendorId")),
        pickupLocationId: String(form.get("pickupLocationId")),
        materialId: String(form.get("materialId")),
        purchaseRate: String(form.get("purchaseRate")),
        expectedQuantityMt: String(form.get("expectedQuantityMt") ?? ""),
        notes: String(form.get("notes") ?? ""),
      }
      const deal = await create({
        data: isAdmin
          ? {
              ...dealInput,
              ownerMembershipId: String(form.get("ownerMembershipId")),
            }
          : dealInput,
      })
      await saveCustomFields({
        data: {
          target: "DEAL",
          recordId: deal.id,
          values: customValues,
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
        description="Select existing records or add missing Deal masters without leaving this form."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to create Deal</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {masterNotice ? (
        <Alert>
          <AlertTitle>Deal options updated</AlertTitle>
          <AlertDescription>{masterNotice}</AlertDescription>
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
                <div className="flex items-stretch gap-2">
                  <NativeSelect
                    id="vendorId"
                    name="vendorId"
                    value={selected.vendorId}
                    onChange={(event) =>
                      setSelected((current) => ({
                        ...current,
                        vendorId: event.target.value,
                      }))
                    }
                    required
                    disabled={masters.vendors.length === 0}
                    className="min-w-0 flex-1"
                  >
                    {options(masters.vendors)}
                  </NativeSelect>
                  {masters.vendors.length ? (
                    <DealInlineMasterSheet
                      kind="VENDOR"
                      create={(data) => createVendor({ data })}
                      onCreated={handleVendorCreated}
                    />
                  ) : null}
                </div>
                {masters.vendors.length === 0 ? (
                  <DealMasterEmptyState label="vendors">
                    <DealInlineMasterSheet
                      kind="VENDOR"
                      create={(data) => createVendor({ data })}
                      onCreated={handleVendorCreated}
                    >
                      Create Vendor
                    </DealInlineMasterSheet>
                  </DealMasterEmptyState>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="pickupLocationId">
                  Pickup Location *
                </FieldLabel>
                <div className="flex items-stretch gap-2">
                  <NativeSelect
                    id="pickupLocationId"
                    name="pickupLocationId"
                    value={selected.pickupLocationId}
                    onChange={(event) =>
                      setSelected((current) => ({
                        ...current,
                        pickupLocationId: event.target.value,
                      }))
                    }
                    required
                    disabled={masters.locations.length === 0}
                    className="min-w-0 flex-1"
                  >
                    {options(masters.locations)}
                  </NativeSelect>
                  {masters.locations.length ? (
                    <DealInlineMasterSheet
                      kind="LOCATION"
                      create={(data) => createLocation({ data })}
                      onCreated={handleLocationCreated}
                    />
                  ) : null}
                </div>
                {masters.locations.length === 0 ? (
                  <DealMasterEmptyState label="locations">
                    <DealInlineMasterSheet
                      kind="LOCATION"
                      create={(data) => createLocation({ data })}
                      onCreated={handleLocationCreated}
                    >
                      Create Location
                    </DealInlineMasterSheet>
                  </DealMasterEmptyState>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="materialId">Material *</FieldLabel>
                <div className="flex items-stretch gap-2">
                  <NativeSelect
                    id="materialId"
                    name="materialId"
                    value={selected.materialId}
                    onChange={(event) =>
                      setSelected((current) => ({
                        ...current,
                        materialId: event.target.value,
                      }))
                    }
                    required
                    disabled={masters.materials.length === 0}
                    className="min-w-0 flex-1"
                  >
                    {options(masters.materials)}
                  </NativeSelect>
                  {masters.materials.length ? (
                    <DealInlineMasterSheet
                      kind="MATERIAL"
                      create={(data) => createMaterial({ data })}
                      onCreated={handleMaterialCreated}
                    />
                  ) : null}
                </div>
                {masters.materials.length === 0 ? (
                  <DealMasterEmptyState label="materials">
                    <DealInlineMasterSheet
                      kind="MATERIAL"
                      create={(data) => createMaterial({ data })}
                      onCreated={handleMaterialCreated}
                    >
                      Create Material
                    </DealInlineMasterSheet>
                  </DealMasterEmptyState>
                ) : null}
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
              {isAdmin ? (
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
              ) : null}
              <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" name="notes" />
              </Field>
            </FieldGroup>
            <DynamicFields
              target="DEAL"
              recordId={null}
              fields={customFields.fields}
              inputName="customFields"
            />
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
