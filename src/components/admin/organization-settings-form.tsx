import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { IconDeviceFloppy, IconLock } from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { mapUserFacingError } from "@/lib/user-error"
import { saveOrganizationSettingsFn } from "@/server/product/product.functions"

interface Settings {
  name: string
  weightWarningThresholdPct: string
  expectedTransitDurationHours: number
  defaultPageSize: number
  version: number
}

export function OrganizationSettingsForm({ settings }: { settings: Settings }) {
  const save = useServerFn(saveOrganizationSettingsFn)
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError("")
    setSaved(false)
    try {
      await save({
        data: {
          name: String(form.get("name")),
          weightWarningThresholdPct: String(
            form.get("weightWarningThresholdPct")
          ),
          expectedTransitDurationHours: Number(
            form.get("expectedTransitDurationHours")
          ),
          defaultPageSize: Number(form.get("defaultPageSize")),
          version: settings.version,
        },
      })
      setSaved(true)
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(mapUserFacingError(caught).message)
    } finally {
      setPending(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Business settings</CardTitle>
          <CardDescription>
            These values control organization-wide operational warnings and list
            behavior.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="organization-name">
                Organization name
              </FieldLabel>
              <Input
                id="organization-name"
                name="name"
                defaultValue={settings.name}
                maxLength={160}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="weight-unit">Weight unit</FieldLabel>
              <Input
                id="weight-unit"
                value="Metric ton (t)"
                disabled
                readOnly
              />
              <FieldDescription>
                <IconLock className="inline" /> Fixed for consistent weight
                calculations.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="currency">Currency</FieldLabel>
              <Input
                id="currency"
                value="Indian Rupee (INR)"
                disabled
                readOnly
              />
              <FieldDescription>
                <IconLock className="inline" /> Fixed for authoritative
                financial records.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="weight-threshold">
                Weight warning threshold (%)
              </FieldLabel>
              <Input
                id="weight-threshold"
                name="weightWarningThresholdPct"
                type="number"
                min="0.001"
                max="100"
                step="0.001"
                defaultValue={settings.weightWarningThresholdPct}
                required
              />
              <FieldDescription>
                Delivered Trips above this absolute percentage difference
                require attention.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="transit-hours">
                Expected transit duration (hours)
              </FieldLabel>
              <Input
                id="transit-hours"
                name="expectedTransitDurationHours"
                type="number"
                min="1"
                max="720"
                defaultValue={settings.expectedTransitDurationHours}
                required
              />
              <FieldDescription>
                In-transit Trips exceeding this duration are flagged as delayed
                without changing status.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="page-size">Default page size</FieldLabel>
              <Input
                id="page-size"
                name="defaultPageSize"
                type="number"
                min="10"
                max="100"
                step="10"
                defaultValue={settings.defaultPageSize}
                required
              />
            </Field>
          </FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Settings not saved</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {saved ? (
            <Alert>
              <AlertTitle>Settings saved</AlertTitle>
              <AlertDescription>
                Organization policy has been updated.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <IconDeviceFloppy data-icon="inline-start" />
            )}
            Save settings
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
