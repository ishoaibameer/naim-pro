import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/admin/page-header"
import { OrganizationSettingsForm } from "@/components/admin/organization-settings-form"
import { getOrganizationSettingsFn } from "@/server/product/product.functions"

export const Route = createFileRoute("/_authenticated/admin/settings")({
  loader: () => getOrganizationSettingsFn(),
  component: SettingsPage,
})

function SettingsPage() {
  const settings = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Organization-scoped operational policy and fixed accounting conventions."
      />
      <OrganizationSettingsForm settings={settings} />
    </div>
  )
}
