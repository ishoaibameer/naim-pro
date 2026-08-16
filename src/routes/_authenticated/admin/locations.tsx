import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { MasterCrudPage } from "@/components/admin/master-crud-page"
import type { MasterRecord } from "@/components/admin/master-crud-page"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { listLocationsFn, saveLocationFn } from "@/server/admin/admin.functions"

export const Route = createFileRoute("/_authenticated/admin/locations")({
  loader: () => listLocationsFn({ data: { search: "" } }),
  component: LocationsPage,
})
function LocationsPage() {
  const rows = Route.useLoaderData()
  const router = useRouter()
  const save = useServerFn(saveLocationFn)
  const records: MasterRecord[] = rows.map((item) => ({
    id: item.id,
    title: item.name,
    subtitle: item.type ?? item.address,
    status: item.status,
    version: item.version,
    values: { name: item.name, type: item.type, address: item.address },
  }))
  async function persist(
    form: FormData,
    record: MasterRecord | null,
    forcedStatus?: "ACTIVE" | "INACTIVE"
  ) {
    const type = String(form.get("type") ?? record?.values.type ?? "")
    await save({
      data: {
        id: record?.id,
        version: record?.version,
        name: String(form.get("name") ?? record?.values.name ?? ""),
        type: type ? (type as "PICKUP" | "DESTINATION" | "OTHER") : null,
        address: String(form.get("address") ?? record?.values.address ?? ""),
        status:
          forcedStatus ??
          (String(form.get("status") ?? record?.status ?? "ACTIVE") as
            "ACTIVE" | "INACTIVE"),
      },
    })
    await router.invalidate({ sync: true })
  }
  return (
    <MasterCrudPage
      title="Locations"
      description="Manage flexible pickup, destination, and other locations."
      records={records}
      onSave={persist}
      onToggle={(record) =>
        persist(
          new FormData(),
          record,
          record.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
        )
      }
      renderFields={(record) => (
        <>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              name="name"
              defaultValue={record?.values.name ?? ""}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="type">Type</FieldLabel>
            <NativeSelect
              id="type"
              name="type"
              defaultValue={record?.values.type ?? ""}
            >
              <NativeSelectOption value="">Unspecified</NativeSelectOption>
              <NativeSelectOption value="PICKUP">Pickup</NativeSelectOption>
              <NativeSelectOption value="DESTINATION">
                Destination
              </NativeSelectOption>
              <NativeSelectOption value="OTHER">Other</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="address">Address</FieldLabel>
            <Textarea
              id="address"
              name="address"
              defaultValue={record?.values.address ?? ""}
            />
          </Field>
        </>
      )}
    />
  )
}
