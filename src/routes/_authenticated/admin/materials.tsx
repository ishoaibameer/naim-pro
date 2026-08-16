import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { MasterCrudPage } from "@/components/admin/master-crud-page"
import type { MasterRecord } from "@/components/admin/master-crud-page"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { listMaterialsFn, saveMaterialFn } from "@/server/admin/admin.functions"

export const Route = createFileRoute("/_authenticated/admin/materials")({
  loader: () => listMaterialsFn({ data: { search: "" } }),
  component: MaterialsPage,
})
function MaterialsPage() {
  const rows = Route.useLoaderData()
  const router = useRouter()
  const save = useServerFn(saveMaterialFn)
  const records: MasterRecord[] = rows.map((item) => ({
    id: item.id,
    title: item.name,
    subtitle: item.description,
    status: item.status,
    version: item.version,
    values: { name: item.name, description: item.description },
  }))
  async function persist(
    form: FormData,
    record: MasterRecord | null,
    forcedStatus?: "ACTIVE" | "INACTIVE"
  ) {
    await save({
      data: {
        id: record?.id,
        version: record?.version,
        name: String(form.get("name") ?? record?.values.name ?? ""),
        description: String(
          form.get("description") ?? record?.values.description ?? ""
        ),
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
      title="Materials"
      description="Manage flexible wood material definitions. No default material was seeded."
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
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Textarea
              id="description"
              name="description"
              defaultValue={record?.values.description ?? ""}
            />
          </Field>
        </>
      )}
    />
  )
}
