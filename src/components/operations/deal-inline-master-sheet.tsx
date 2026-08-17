import { useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { IconPlus } from "@tabler/icons-react"

import { mapUserFacingError } from "@/lib/user-error"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

export interface InlineMasterResult {
  id: string
  label: string
  created: boolean
  locationType?: "PICKUP" | "DESTINATION" | "OTHER" | null
}

export interface InlineVendorInput {
  name: string
  contactPerson: string
  phone: string
  location: string
  notes: string
}

export interface InlineLocationInput {
  name: string
  type: "PICKUP" | "DESTINATION" | "OTHER"
  address: string
}

export interface InlineMaterialInput {
  name: string
  description: string
}

type InlineMasterSheetProps =
  | {
      kind: "VENDOR"
      create: (input: InlineVendorInput) => Promise<InlineMasterResult>
      onCreated: (result: InlineMasterResult) => void
      children?: ReactNode
    }
  | {
      kind: "LOCATION"
      create: (input: InlineLocationInput) => Promise<InlineMasterResult>
      onCreated: (result: InlineMasterResult) => void
      children?: ReactNode
    }
  | {
      kind: "MATERIAL"
      create: (input: InlineMaterialInput) => Promise<InlineMasterResult>
      onCreated: (result: InlineMasterResult) => void
      children?: ReactNode
    }

const COPY = {
  VENDOR: {
    label: "Vendor",
    title: "Add Vendor",
    description: "Create a Vendor without leaving this Deal.",
  },
  LOCATION: {
    label: "Location",
    title: "Add Location",
    description: "Create a pickup or other Location for this Deal.",
  },
  MATERIAL: {
    label: "Material",
    title: "Add Material",
    description: "Create a Material without leaving this Deal.",
  },
} as const

export function DealInlineMasterSheet(props: InlineMasterSheetProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const copy = COPY[props.kind]

  function changeOpen(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) setError("")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setPending(true)
    setError("")
    const form = new FormData(formElement)
    try {
      let result: InlineMasterResult
      if (props.kind === "VENDOR") {
        result = await props.create({
          name: String(form.get("name") ?? ""),
          contactPerson: String(form.get("contactPerson") ?? ""),
          phone: String(form.get("phone") ?? ""),
          location: String(form.get("location") ?? ""),
          notes: String(form.get("notes") ?? ""),
        })
      } else if (props.kind === "LOCATION") {
        result = await props.create({
          name: String(form.get("name") ?? ""),
          type: String(
            form.get("type") ?? "PICKUP"
          ) as InlineLocationInput["type"],
          address: String(form.get("address") ?? ""),
        })
      } else {
        result = await props.create({
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? ""),
        })
      }
      props.onCreated(result)
      formElement.reset()
      setOpen(false)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : ""
      setError(
        /already exists but is inactive/i.test(message)
          ? message
          : mapUserFacingError(caught).message
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <IconPlus data-icon="inline-start" />
        {props.children ?? `Add ${copy.label}`}
      </Button>
      <Sheet open={open} onOpenChange={changeOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md"
          aria-describedby={`inline-${props.kind.toLowerCase()}-description`}
        >
          <SheetHeader>
            <SheetTitle>{copy.title}</SheetTitle>
            <SheetDescription
              id={`inline-${props.kind.toLowerCase()}-description`}
            >
              {copy.description}
            </SheetDescription>
          </SheetHeader>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
            <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
              {error ? (
                <Alert variant="destructive" className="mb-6">
                  <AlertTitle>Unable to add {copy.label}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <FieldGroup className="gap-6">
                <Field>
                  <FieldLabel htmlFor={`inline-${props.kind}-name`}>
                    {copy.label} Name *
                  </FieldLabel>
                  <Input
                    id={`inline-${props.kind}-name`}
                    name="name"
                    autoComplete="off"
                    disabled={pending}
                    required
                    autoFocus
                  />
                </Field>
                {props.kind === "VENDOR" ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="inline-vendor-contact">
                        Contact Person
                      </FieldLabel>
                      <Input
                        id="inline-vendor-contact"
                        name="contactPerson"
                        disabled={pending}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="inline-vendor-phone">
                        Phone
                      </FieldLabel>
                      <Input
                        id="inline-vendor-phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        disabled={pending}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="inline-vendor-location">
                        Location
                      </FieldLabel>
                      <Input
                        id="inline-vendor-location"
                        name="location"
                        disabled={pending}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="inline-vendor-notes">
                        Notes / Address
                      </FieldLabel>
                      <Textarea
                        id="inline-vendor-notes"
                        name="notes"
                        disabled={pending}
                      />
                    </Field>
                  </>
                ) : null}
                {props.kind === "LOCATION" ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="inline-location-type">
                        Type *
                      </FieldLabel>
                      <NativeSelect
                        id="inline-location-type"
                        name="type"
                        defaultValue="PICKUP"
                        disabled={pending}
                        className="w-full"
                        required
                      >
                        <NativeSelectOption value="PICKUP">
                          Pickup
                        </NativeSelectOption>
                        <NativeSelectOption value="DESTINATION">
                          Destination
                        </NativeSelectOption>
                        <NativeSelectOption value="OTHER">
                          Other
                        </NativeSelectOption>
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="inline-location-address">
                        Address
                      </FieldLabel>
                      <Textarea
                        id="inline-location-address"
                        name="address"
                        disabled={pending}
                      />
                    </Field>
                  </>
                ) : null}
                {props.kind === "MATERIAL" ? (
                  <Field>
                    <FieldLabel htmlFor="inline-material-description">
                      Description
                    </FieldLabel>
                    <Textarea
                      id="inline-material-description"
                      name="description"
                      disabled={pending}
                    />
                  </Field>
                ) : null}
              </FieldGroup>
            </div>
            <SheetFooter className="border-t">
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? "Saving…" : `Save ${copy.label}`}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={pending}
                onClick={() => changeOpen(false)}
              >
                Cancel
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function DealMasterEmptyState({
  label,
  children,
}: {
  label: "vendors" | "locations" | "materials"
  children: ReactNode
}) {
  return (
    <Empty className="border p-6">
      <EmptyHeader>
        <EmptyTitle>No {label} found.</EmptyTitle>
        <EmptyDescription>
          Create the first record without leaving this Deal.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{children}</EmptyContent>
    </Empty>
  )
}
