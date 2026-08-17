import { createFileRoute } from "@tanstack/react-router"

import { LinkedPartyDetail } from "@/components/admin/linked-party-detail"
import { CustomFieldsPanel } from "@/components/custom-fields/dynamic-fields"
import { getVendorFn } from "@/server/admin/admin.functions"
import { getCustomFieldDataFn } from "@/server/custom-fields/custom-field.functions"

export const Route = createFileRoute("/_authenticated/admin/vendors/$vendorId")(
  {
    loader: async ({ params }) => {
      const [party, customFields] = await Promise.all([
        getVendorFn({ data: { id: params.vendorId } }),
        getCustomFieldDataFn({
          data: { target: "VENDOR", recordId: params.vendorId },
        }),
      ])
      return { party, customFields }
    },
    component: () => {
      const { party, customFields } = Route.useLoaderData()
      return (
        <LinkedPartyDetail
          kind="VENDOR"
          party={party}
          additionalContent={
            <CustomFieldsPanel
              target="VENDOR"
              recordId={party.id}
              fields={customFields.fields}
            />
          }
        />
      )
    },
  }
)
