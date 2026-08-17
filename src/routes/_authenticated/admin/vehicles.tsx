import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { MasterCrudPage } from "@/components/admin/master-crud-page"
import type { MasterRecord } from "@/components/admin/master-crud-page"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  listTransportersFn,
  listVehiclesFn,
  saveVehicleFn,
} from "@/server/admin/admin.functions"

const searchSchema = z.object({ q: z.string().catch("") })
export const Route = createFileRoute("/_authenticated/admin/vehicles")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => ({
    vehicles: await listVehiclesFn({ data: { search: deps.q } }),
    transporters: await listTransportersFn({ data: { search: "" } }),
  }),
  component: VehiclesPage,
})

function VehiclesPage() {
  const data = Route.useLoaderData()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const save = useServerFn(saveVehicleFn)
  const records: MasterRecord[] = data.vehicles.map((item) => ({
    id: item.id,
    title: item.registrationNumber,
    subtitle: item.transporter ?? "No transporter",
    status: item.status,
    version: item.version,
    values: {
      registrationNumber: item.registrationNumber,
      transporterId: item.transporterId,
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
        registrationNumber: String(
          form.get("registrationNumber") ??
            record?.values.registrationNumber ??
            ""
        ),
        transporterId: String(
          form.get("transporterId") ?? record?.values.transporterId ?? ""
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
      title="Vehicles"
      description="Manage normalized registrations and transporter assignment history. Vehicle photo upload is reserved for the document module."
      records={records}
      onSearch={(q) => navigate({ search: { q } })}
      onSave={persist}
      onToggle={(record) =>
        persist(
          new FormData(),
          record,
          record.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
        )
      }
      renderRecordActions={(record) => (
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              to="/app/vehicles/$vehicleId"
              params={{ vehicleId: record.id }}
            />
          }
          nativeButton={false}
        >
          Photo & documents
        </Button>
      )}
      renderFields={(record) => (
        <>
          <Field>
            <FieldLabel htmlFor="registration">Vehicle Number</FieldLabel>
            <Input
              id="registration"
              name="registrationNumber"
              defaultValue={record?.values.registrationNumber ?? ""}
              required
            />
            <FieldDescription>
              Spacing and punctuation are normalized for search.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="transporter">Transporter</FieldLabel>
            <NativeSelect
              id="transporter"
              name="transporterId"
              defaultValue={record?.values.transporterId ?? ""}
            >
              <NativeSelectOption value="">Not assigned</NativeSelectOption>
              {data.transporters.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </>
      )}
    />
  )
}
