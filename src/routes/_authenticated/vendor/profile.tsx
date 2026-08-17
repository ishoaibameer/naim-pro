import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/admin/page-header"
import { CustomFieldsPanel } from "@/components/custom-fields/dynamic-fields"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import { getCustomFieldDataFn } from "@/server/custom-fields/custom-field.functions"
import { getVendorProfileFn } from "@/server/vendor/vendor.functions"

export const Route = createFileRoute("/_authenticated/vendor/profile")({
  loader: async () => {
    const profile = await getVendorProfileFn()
    const fields = await getCustomFieldDataFn({
      data: { target: "VENDOR", recordId: profile.id },
    })
    return { profile, fields }
  },
  component: VendorProfile,
})

function VendorProfile() {
  const { profile, fields } = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Vendor portal"
        title="Profile"
        description="Your vendor account information and authorized additional fields."
        actions={<OperationsStatusBadge status={profile.status} />}
      />
      <Card>
        <CardHeader>
          <CardTitle>{profile.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Contact person</dt>
              <dd className="font-medium">
                {profile.contactPerson ?? "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="font-medium">{profile.phone ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Location</dt>
              <dd className="font-medium">
                {profile.location ?? "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Vendor since</dt>
              <dd className="font-medium">{formatDate(profile.createdAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <CustomFieldsPanel
        target="VENDOR"
        recordId={profile.id}
        fields={fields.fields}
        documentContentLinks
      />
    </div>
  )
}
