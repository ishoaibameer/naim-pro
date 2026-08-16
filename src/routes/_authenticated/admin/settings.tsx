import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/admin/page-header"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Organization settings will be introduced when their business rules are defined."
      />
      <Card>
        <CardHeader>
          <CardTitle>Settings foundation</CardTitle>
          <CardDescription>
            No speculative settings or fake controls have been added.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
