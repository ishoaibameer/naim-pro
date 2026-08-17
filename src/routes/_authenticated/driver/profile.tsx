import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/admin/page-header"
import { CustomFieldsPanel } from "@/components/custom-fields/dynamic-fields"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import { getCustomFieldDataFn } from "@/server/custom-fields/custom-field.functions"
import { getDriverProfileFn } from "@/server/driver/driver.functions"

export const Route = createFileRoute("/_authenticated/driver/profile")({
  loader: async () => {
    const profile = await getDriverProfileFn()
    const fields = await getCustomFieldDataFn({
      data: { target: "DRIVER", recordId: profile.id },
    })
    return { profile, fields }
  },
  component: DriverProfile,
})

function DriverProfile() {
  const { profile, fields } = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Driver portal"
        title="Profile"
        description="Your Driver record and authorized additional fields."
        actions={<OperationsStatusBadge status={profile.status} />}
      />
      <Card>
        <CardHeader>
          <CardTitle>{profile.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="font-medium">{profile.phone ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">License number</dt>
              <dd className="font-medium">
                {profile.licenseNumber ?? "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Current transporter
              </dt>
              <dd className="font-medium">
                {profile.transporter ?? "Not assigned"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Driver since</dt>
              <dd className="font-medium">{formatDate(profile.createdAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <CustomFieldsPanel
        target="DRIVER"
        recordId={profile.id}
        fields={fields.fields}
        documentContentLinks
      />
    </div>
  )
}
