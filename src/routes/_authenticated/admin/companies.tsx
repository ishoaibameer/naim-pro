import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { MasterCrudPage } from "@/components/admin/master-crud-page"
import type { MasterRecord } from "@/components/admin/master-crud-page"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { listCompaniesFn, saveCompanyFn } from "@/server/admin/admin.functions"

export const Route = createFileRoute("/_authenticated/admin/companies")({
  loader: () => listCompaniesFn({ data: { search: "" } }),
  component: CompaniesPage,
})
function CompaniesPage() {
  const rows = Route.useLoaderData()
  const router = useRouter()
  const save = useServerFn(saveCompanyFn)
  const records: MasterRecord[] = rows.map((item) => ({
    id: item.id,
    title: item.name,
    subtitle: item.location ?? item.phone,
    status: item.status,
    version: item.version,
    values: {
      name: item.name,
      contactPerson: item.contactPerson,
      phone: item.phone,
      location: item.location,
      address: item.address,
    },
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
        contactPerson: String(
          form.get("contactPerson") ?? record?.values.contactPerson ?? ""
        ),
        phone: String(form.get("phone") ?? record?.values.phone ?? ""),
        location: String(form.get("location") ?? record?.values.location ?? ""),
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
      title="Companies"
      description="Manage company contacts, locations, and addresses."
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
            <FieldLabel htmlFor="name">Company Name</FieldLabel>
            <Input
              id="name"
              name="name"
              defaultValue={record?.values.name ?? ""}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact">Contact</FieldLabel>
            <Input
              id="contact"
              name="contactPerson"
              defaultValue={record?.values.contactPerson ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={record?.values.phone ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="location">Location</FieldLabel>
            <Input
              id="location"
              name="location"
              defaultValue={record?.values.location ?? ""}
            />
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
