import { createFileRoute } from "@tanstack/react-router"

import { LinkedPartyDetail } from "@/components/admin/linked-party-detail"
import { CustomFieldsPanel } from "@/components/custom-fields/dynamic-fields"
import { getDriverFn } from "@/server/admin/admin.functions"
import { getCustomFieldDataFn } from "@/server/custom-fields/custom-field.functions"

export const Route = createFileRoute("/_authenticated/admin/drivers/$driverId")(
  {
    loader: async ({ params }) => {
      const [party, customFields] = await Promise.all([
        getDriverFn({ data: { id: params.driverId } }),
        getCustomFieldDataFn({
          data: { target: "DRIVER", recordId: params.driverId },
        }),
      ])
      return { party, customFields }
    },
    component: () => {
      const { party, customFields } = Route.useLoaderData()
      return (
        <LinkedPartyDetail
          kind="DRIVER"
          party={party}
          additionalContent={
            <CustomFieldsPanel
              target="DRIVER"
              recordId={party.id}
              fields={customFields.fields}
            />
          }
        />
      )
    },
  }
)
