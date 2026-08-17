import { Link, createFileRoute } from "@tanstack/react-router"
import { IconArrowRight, IconForms } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  CUSTOM_FIELD_TARGET_LABELS,
  CUSTOM_FIELD_TARGET_VALUES,
} from "@/server/custom-fields/config"

export const Route = createFileRoute("/_authenticated/admin/form-builder/")({
  component: FormBuilderIndex,
})

function targetPath(target: (typeof CUSTOM_FIELD_TARGET_VALUES)[number]) {
  return target.toLowerCase().replaceAll("_", "-")
}

function FormBuilderIndex() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Configuration"
        title="Form Builder"
        description="Add controlled organization-specific fields without changing protected business data."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CUSTOM_FIELD_TARGET_VALUES.map((target) => (
          <Card key={target}>
            <CardHeader>
              <IconForms />
              <CardTitle>{CUSTOM_FIELD_TARGET_LABELS[target]}</CardTitle>
              <CardDescription>
                Review protected core fields and configure additional fields.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Changes are versioned and audited. Historical values remain
                available.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                render={
                  <Link
                    to="/admin/form-builder/$target"
                    params={{ target: targetPath(target) }}
                  />
                }
                nativeButton={false}
              >
                Configure
                <IconArrowRight data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
