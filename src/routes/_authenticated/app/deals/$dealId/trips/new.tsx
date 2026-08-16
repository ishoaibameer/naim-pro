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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import {
  createTripFn,
  getDealFn,
  getOperationalMastersFn,
} from "@/server/operations/operations.functions"

export const Route = createFileRoute(
  "/_authenticated/app/deals/$dealId/trips/new"
)({
  loader: async ({ params }) => {
    const [deal, masters] = await Promise.all([
      getDealFn({ data: { id: params.dealId } }),
      getOperationalMastersFn(),
    ])
    return { deal, masters }
  },
  component: NewTrip,
})
function NewTrip() {
  const { deal, masters } = Route.useLoaderData()
  const create = useServerFn(createTripFn)
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const options = (items: ReadonlyArray<{ id: string; label: string }>) => (
    <>
      <NativeSelectOption value="">Select…</NativeSelectOption>
      {items.map((item) => (
        <NativeSelectOption key={item.id} value={item.id}>
          {item.label}
        </NativeSelectOption>
      ))}
    </>
  )
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      const trip = await create({
        data: {
          dealId: deal.id,
          transporterId: String(form.get("transporterId")),
          vehicleId: String(form.get("vehicleId")),
          driverId: String(form.get("driverId")),
          destinationCompanyId: String(form.get("destinationCompanyId")),
          destinationLocationId: String(form.get("destinationLocationId")),
        },
      })
      await navigate({ to: "/app/trips/$tripId", params: { tripId: trip.id } })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Trip could not be created."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={deal.dealNumber}
        title="Assign Truck"
        description={`Pickup defaults to ${deal.pickup}. Only active organization records are selectable.`}
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to assign truck</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={submit}>
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Trip assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {[
                ["transporterId", "Transporter", masters.transporters],
                ["vehicleId", "Vehicle", masters.vehicles],
                ["driverId", "Driver", masters.drivers],
                [
                  "destinationCompanyId",
                  "Destination Company",
                  masters.companies,
                ],
                [
                  "destinationLocationId",
                  "Destination Location",
                  masters.locations,
                ],
              ].map(([name, label, items]) => (
                <Field key={String(name)}>
                  <FieldLabel htmlFor={String(name)}>
                    {String(label)} *
                  </FieldLabel>
                  <NativeSelect
                    id={String(name)}
                    name={String(name)}
                    required
                    className="w-full"
                  >
                    {options(items as Array<{ id: string; label: string }>)}
                  </NativeSelect>
                </Field>
              ))}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Assigning…" : "Create Trip"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
