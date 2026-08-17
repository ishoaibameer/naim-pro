import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  IconArrowDown,
  IconArrowUp,
  IconEdit,
  IconLock,
  IconPlus,
} from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { DynamicFields } from "@/components/custom-fields/dynamic-fields"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  CUSTOM_FIELD_TARGET_LABELS,
  CUSTOM_FIELD_TARGET_VALUES,
  CUSTOM_FIELD_TYPE_LABELS,
  CUSTOM_FIELD_TYPE_VALUES,
  TARGET_SECTIONS,
  slugifyFieldKey,
} from "@/server/custom-fields/config"
import type {
  CustomFieldRole,
  CustomFieldTarget,
  CustomFieldType,
} from "@/server/custom-fields/config"
import {
  getFormBuilderFn,
  reorderCustomFieldsFn,
  saveCustomFieldDefinitionFn,
  setCustomFieldStatusFn,
} from "@/server/custom-fields/custom-field.functions"
import { DOCUMENT_TYPE_VALUES, ROLE_VALUES } from "@/server/db/schema/constants"
import { DOCUMENT_TYPE_LABELS } from "@/server/documents/policy"

function parseTarget(value: string): CustomFieldTarget {
  const normalized = value.toUpperCase().replaceAll("-", "_")
  const target = CUSTOM_FIELD_TARGET_VALUES.find(
    (candidate) => candidate === normalized
  )
  if (!target) throw new Error("Unsupported form target.")
  return target
}

export const Route = createFileRoute(
  "/_authenticated/admin/form-builder/$target"
)({
  loader: ({ params }) =>
    getFormBuilderFn({ data: parseTarget(params.target) }),
  component: FormBuilderPage,
})

type BuilderData = Awaited<ReturnType<typeof getFormBuilderFn>>
type BuilderField = BuilderData["customFields"][number]

function RoleSwitches({
  legend,
  value,
  onChange,
}: {
  legend: string
  value: CustomFieldRole[]
  onChange: (roles: CustomFieldRole[]) => void
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        {ROLE_VALUES.map((role) => (
          <Field key={role} orientation="horizontal">
            <FieldLabel htmlFor={`${legend}-${role}`}>{role}</FieldLabel>
            <Switch
              id={`${legend}-${role}`}
              checked={value.includes(role)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...new Set([...value, role])]
                    : value.filter((candidate) => candidate !== role)
                )
              }
            />
          </Field>
        ))}
      </FieldGroup>
    </FieldSet>
  )
}

function optionalNumber(form: FormData, key: string): number | undefined {
  const value = String(form.get(key) ?? "").trim()
  return value ? Number(value) : undefined
}

function FieldEditor({
  target,
  field,
  nextSortOrder,
  onDone,
}: {
  target: CustomFieldTarget
  field: BuilderField | null
  nextSortOrder: number
  onDone: () => void
}) {
  const save = useServerFn(saveCustomFieldDefinitionFn)
  const router = useRouter()
  const [label, setLabel] = useState(field?.label ?? "")
  const [key, setKey] = useState(field?.key ?? "")
  const [fieldType, setFieldType] = useState<CustomFieldType>(
    field?.fieldType ?? "TEXT"
  )
  const [required, setRequired] = useState(field?.required ?? false)
  const [visibleRoles, setVisibleRoles] = useState<CustomFieldRole[]>(
    field?.visibleRoles ?? ["ADMIN", "MEMBER"]
  )
  const [editableRoles, setEditableRoles] = useState<CustomFieldRole[]>(
    field?.editableRoles ?? ["ADMIN", "MEMBER"]
  )
  const [requiredRoles, setRequiredRoles] = useState<CustomFieldRole[]>(
    field?.requiredRoles ?? []
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const options = String(form.get("options") ?? "")
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean)
      .map((option) => {
        const separator = option.indexOf("|")
        const code =
          separator >= 0
            ? option.slice(0, separator).trim()
            : slugifyFieldKey(option)
        const optionLabel =
          separator >= 0 ? option.slice(separator + 1).trim() : option
        return { code, label: optionLabel }
      })
    const allowedDocumentTypes = [
      ...(form.getAll("allowedDocumentTypes") as string[]),
    ].filter((value): value is (typeof DOCUMENT_TYPE_VALUES)[number] =>
      DOCUMENT_TYPE_VALUES.some((candidate) => candidate === value)
    )
    try {
      await save({
        data: {
          id: field?.id,
          version: field?.version,
          target,
          key,
          label,
          fieldType,
          sectionKey: String(form.get("sectionKey")),
          required,
          requiredRoles,
          visibleRoles,
          editableRoles,
          sortOrder: field?.sortOrder ?? nextSortOrder,
          min: optionalNumber(form, "min"),
          max: optionalNumber(form, "max"),
          maxLength: optionalNumber(form, "maxLength"),
          allowedDocumentTypes,
          options:
            fieldType === "SELECT" || fieldType === "MULTI_SELECT"
              ? options
              : [],
        },
      })
      await router.invalidate({ sync: true })
      onDone()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Field could not be saved."
      )
    } finally {
      setPending(false)
    }
  }
  const numeric = ["NUMBER", "CURRENCY", "QUANTITY_TON", "PERCENTAGE"].includes(
    fieldType
  )
  const documentField = fieldType === "IMAGE" || fieldType === "DOCUMENT"
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {field ? `Edit ${field.label}` : "Add custom field"}
        </CardTitle>
        <CardDescription>
          Saving an edit creates a new immutable definition version.
        </CardDescription>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="field-label">Label</FieldLabel>
              <Input
                id="field-label"
                value={label}
                required
                maxLength={160}
                onChange={(event) => {
                  setLabel(event.target.value)
                  if (!field) setKey(slugifyFieldKey(event.target.value))
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="field-key">Internal Key</FieldLabel>
              <Input
                id="field-key"
                value={key}
                required
                pattern="[a-z][a-z0-9_]*"
                onChange={(event) => setKey(event.target.value)}
              />
              <FieldDescription>
                Stable after first use. Lowercase letters, numbers, and
                underscores.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="field-type">Type</FieldLabel>
              <NativeSelect
                id="field-type"
                value={fieldType}
                onChange={(event) =>
                  setFieldType(event.target.value as CustomFieldType)
                }
                className="w-full"
              >
                {CUSTOM_FIELD_TYPE_VALUES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {CUSTOM_FIELD_TYPE_LABELS[type]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="section">Section</FieldLabel>
              <NativeSelect
                id="section"
                name="sectionKey"
                defaultValue={
                  field?.sectionKey ?? TARGET_SECTIONS[target][0].key
                }
                className="w-full"
              >
                {TARGET_SECTIONS[target].map((section) => (
                  <NativeSelectOption key={section.key} value={section.key}>
                    {section.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field orientation="horizontal">
              <div className="flex-1">
                <FieldLabel htmlFor="required">Required</FieldLabel>
                <FieldDescription>
                  Required rules are enforced by the server.
                </FieldDescription>
              </div>
              <Switch
                id="required"
                checked={required}
                onCheckedChange={setRequired}
              />
            </Field>
            {numeric ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="minimum">Minimum</FieldLabel>
                  <Input
                    id="minimum"
                    name="min"
                    type="number"
                    step="any"
                    defaultValue={field?.validation.min ?? ""}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="maximum">Maximum</FieldLabel>
                  <Input
                    id="maximum"
                    name="max"
                    type="number"
                    step="any"
                    defaultValue={field?.validation.max ?? ""}
                  />
                </Field>
              </div>
            ) : null}
            {fieldType === "TEXT" || fieldType === "TEXTAREA" ? (
              <Field>
                <FieldLabel htmlFor="max-length">Maximum Length</FieldLabel>
                <Input
                  id="max-length"
                  name="maxLength"
                  type="number"
                  min={1}
                  max={10000}
                  defaultValue={field?.validation.maxLength ?? ""}
                />
              </Field>
            ) : null}
            {fieldType === "SELECT" || fieldType === "MULTI_SELECT" ? (
              <Field>
                <FieldLabel htmlFor="options">Options</FieldLabel>
                <Textarea
                  id="options"
                  name="options"
                  required
                  rows={5}
                  defaultValue={
                    field?.options
                      .map((option) => `${option.code} | ${option.label}`)
                      .join("\n") ?? ""
                  }
                />
                <FieldDescription>
                  One option per line as code | label. Keep existing codes
                  stable when changing labels.
                </FieldDescription>
              </Field>
            ) : null}
            {documentField ? (
              <Field>
                <FieldLabel htmlFor="document-types">
                  Allowed Document Types
                </FieldLabel>
                <NativeSelect
                  id="document-types"
                  name="allowedDocumentTypes"
                  multiple
                  defaultValue={field?.validation.allowedDocumentTypes ?? []}
                  className="w-full"
                >
                  {DOCUMENT_TYPE_VALUES.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  Leave all unselected to use every document type allowed for
                  the related record.
                </FieldDescription>
              </Field>
            ) : null}
            <RoleSwitches
              legend="Visible To"
              value={visibleRoles}
              onChange={setVisibleRoles}
            />
            <RoleSwitches
              legend="Editable By"
              value={editableRoles}
              onChange={setEditableRoles}
            />
            {required ? (
              <RoleSwitches
                legend="Required For"
                value={requiredRoles}
                onChange={setRequiredRoles}
              />
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Save failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}Save field
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function FormBuilderPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const reorder = useServerFn(reorderCustomFieldsFn)
  const setStatus = useServerFn(setCustomFieldStatusFn)
  const [editing, setEditing] = useState<BuilderField | null | undefined>(
    undefined
  )
  const [statusReason, setStatusReason] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function run(task: () => Promise<unknown>) {
    setPending(true)
    setError("")
    try {
      await task()
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Configuration update failed."
      )
    } finally {
      setPending(false)
    }
  }
  function move(index: number, direction: -1 | 1) {
    const orderedIds = data.customFields.map((field) => field.id)
    const destination = index + direction
    if (destination < 0 || destination >= orderedIds.length) return
    const currentId = orderedIds[index]
    const destinationId = orderedIds[destination]
    if (!currentId || !destinationId) return
    orderedIds[index] = destinationId
    orderedIds[destination] = currentId
    void run(() => reorder({ data: { target: data.target, orderedIds } }))
  }
  const previewFields = data.customFields
    .filter((field) => field.status === "ACTIVE")
    .map((field) => ({
      ...field,
      value: null,
      valueVersion: null,
      historical: false,
      canEdit: true,
    }))
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Form Builder"
        title={CUSTOM_FIELD_TARGET_LABELS[data.target]}
        description="Core fields are protected. Custom configuration changes are versioned and audited."
        actions={
          <Button onClick={() => setEditing(null)}>
            <IconPlus data-icon="inline-start" />
            Add field
          </Button>
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Update failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {editing !== undefined ? (
        <FieldEditor
          key={editing?.id ?? "new"}
          target={data.target}
          field={editing}
          nextSortOrder={data.customFields.length}
          onDone={() => setEditing(undefined)}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Core Fields</CardTitle>
          <CardDescription>
            Required by NAIM PRO business logic. They cannot be removed,
            reordered, or redefined.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {data.coreFields.map((field) => (
            <div
              key={field.key}
              className="flex items-center justify-between gap-3 border p-3"
            >
              <div>
                <p className="font-medium">{field.label}</p>
                <p className="text-xs text-muted-foreground">{field.section}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {field.required ? "Required" : "Core"}
                </Badge>
                <Badge>
                  <IconLock />
                  Locked
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Custom Fields</CardTitle>
          <CardDescription>
            Use the arrows to change mobile rendering order. Deactivation
            preserves recorded values.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.customFields.length ? (
            <>
              <Field>
                <FieldLabel htmlFor="status-reason">
                  Activation / deactivation reason
                </FieldLabel>
                <Input
                  id="status-reason"
                  value={statusReason}
                  onChange={(event) => setStatusReason(event.target.value)}
                  placeholder="Required when changing status"
                />
              </Field>
              {data.customFields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-3 border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{field.label}</p>
                      <Badge
                        variant={
                          field.status === "ACTIVE" ? "secondary" : "outline"
                        }
                      >
                        {field.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {field.key} · {CUSTOM_FIELD_TYPE_LABELS[field.fieldType]}{" "}
                      · Version {field.currentVersionNumber}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Move ${field.label} up`}
                      disabled={pending || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <IconArrowUp />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Move ${field.label} down`}
                      disabled={
                        pending || index === data.customFields.length - 1
                      }
                      onClick={() => move(index, 1)}
                    >
                      <IconArrowDown />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(field)}
                    >
                      <IconEdit data-icon="inline-start" />
                      Edit
                    </Button>
                    <Button
                      variant={
                        field.status === "ACTIVE" ? "destructive" : "outline"
                      }
                      size="sm"
                      disabled={pending || statusReason.trim().length < 3}
                      onClick={() =>
                        run(() =>
                          setStatus({
                            data: {
                              id: field.id,
                              version: field.version,
                              status:
                                field.status === "ACTIVE"
                                  ? "INACTIVE"
                                  : "ACTIVE",
                              reason: statusReason,
                            },
                          })
                        )
                      }
                    >
                      {field.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No custom fields configured.
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>Mobile Preview</CardTitle>
          <CardDescription>
            Approximate one-column rendering of the active configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {previewFields.length ? (
            <DynamicFields
              target={data.target}
              recordId={null}
              fields={previewFields}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Add an active field to preview it.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
