import { useMemo, useState } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { DocumentUploadCard } from "@/components/documents/document-upload-card"
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
import { Textarea } from "@/components/ui/textarea"
import {
  CUSTOM_FIELD_TARGET_LABELS,
  TARGET_SECTIONS,
} from "@/server/custom-fields/config"
import type {
  CustomFieldRole,
  CustomFieldTarget,
  CustomFieldType,
  CustomFieldValidationConfig,
} from "@/server/custom-fields/config"
import { saveCustomFieldValuesFn } from "@/server/custom-fields/custom-field.functions"
import { DOCUMENT_TYPE_VALUES } from "@/server/db/schema/constants"
import { allowedDocumentTypes } from "@/server/documents/policy"
import type {
  DocumentTargetType,
  DocumentType,
} from "@/server/documents/policy"

export interface RenderableCustomField {
  id: string
  key: string
  label: string
  fieldType: CustomFieldType
  sectionKey: string
  required: boolean
  requiredRoles: CustomFieldRole[]
  validation: CustomFieldValidationConfig
  sortOrder: number
  options: {
    id: string
    code: string
    label: string
    status: "ACTIVE" | "INACTIVE"
  }[]
  value: unknown
  valueVersion: number | null
  historical: boolean
  canEdit: boolean
}

function documentTarget(target: CustomFieldTarget): DocumentTargetType {
  if (target === "TRIP_LOADING" || target === "TRIP_DELIVERY") return "TRIP"
  return target
}

function isDocumentType(value: string): value is DocumentType {
  return DOCUMENT_TYPE_VALUES.some((candidate) => candidate === value)
}

function uploadTypes(
  target: CustomFieldTarget,
  field: RenderableCustomField
): readonly DocumentType[] {
  const allowedForTarget = allowedDocumentTypes(documentTarget(target))
  const configured = (field.validation.allowedDocumentTypes ?? []).filter(
    isDocumentType
  )
  const intersection = configured.filter((type) =>
    allowedForTarget.includes(type)
  )
  if (intersection.length) return intersection
  return allowedForTarget
}

function inputValue(value: unknown): string | number {
  return typeof value === "string" || typeof value === "number" ? value : ""
}

function displayValue(field: RenderableCustomField): string {
  if (field.value === null || field.value === undefined || field.value === "")
    return "—"
  if (field.fieldType === "BOOLEAN") return field.value === true ? "Yes" : "No"
  if (Array.isArray(field.value)) {
    return field.value
      .map(
        (code) =>
          field.options.find((option) => option.code === code)?.label ?? code
      )
      .join(", ")
  }
  if (field.fieldType === "SELECT")
    return (
      field.options.find((option) => option.code === field.value)?.label ??
      String(field.value)
    )
  return String(field.value)
}

function FieldControl({
  target,
  recordId,
  field,
  value,
  onChange,
  documentContentLinks,
}: {
  target: CustomFieldTarget
  recordId: string | null
  field: RenderableCustomField
  value: unknown
  onChange: (value: unknown) => void
  documentContentLinks: boolean
}) {
  const id = `custom-field-${field.id}`
  const disabled = !field.canEdit
  if (field.fieldType === "IMAGE" || field.fieldType === "DOCUMENT") {
    if (!recordId)
      return (
        <FieldDescription>
          Save the record before uploading this {field.fieldType.toLowerCase()}.
        </FieldDescription>
      )
    if (disabled)
      return typeof value === "string" ? (
        <Button
          variant="outline"
          size="sm"
          render={
            documentContentLinks ? (
              <a
                href={`/api/documents/${value}`}
                target="_blank"
                rel="noreferrer"
              />
            ) : (
              <Link
                to="/app/documents/$documentId"
                params={{ documentId: value }}
              />
            )
          }
          nativeButton={false}
        >
          View document
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">No document uploaded.</p>
      )
    const types = uploadTypes(target, field)
    return (
      <div className="flex flex-col gap-3">
        {typeof value === "string" ? (
          <Button
            variant="outline"
            size="sm"
            render={
              documentContentLinks ? (
                <a
                  href={`/api/documents/${value}`}
                  target="_blank"
                  rel="noreferrer"
                />
              ) : (
                <Link
                  to="/app/documents/$documentId"
                  params={{ documentId: value }}
                />
              )
            }
            nativeButton={false}
          >
            View current upload
          </Button>
        ) : null}
        <DocumentUploadCard
          targetType={documentTarget(target)}
          targetId={recordId}
          documentTypes={types}
          defaultDocumentType={types[0]}
          title={`${typeof value === "string" ? "Replace" : "Upload"} ${field.label}`}
          accept={
            field.fieldType === "IMAGE"
              ? "image/jpeg,image/png,image/webp"
              : undefined
          }
          onUploaded={(result) => onChange(result.id)}
        />
      </div>
    )
  }
  if (disabled)
    return (
      <p className="text-sm font-medium">{displayValue({ ...field, value })}</p>
    )
  if (field.fieldType === "TEXTAREA")
    return (
      <Textarea
        id={id}
        value={String(value ?? "")}
        maxLength={field.validation.maxLength}
        required={field.required}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  if (field.fieldType === "BOOLEAN")
    return (
      <NativeSelect
        id={id}
        value={value === true ? "true" : value === false ? "false" : ""}
        required={field.required}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : event.target.value === "true"
          )
        }
        className="w-full"
      >
        <NativeSelectOption value="">Choose Yes or No</NativeSelectOption>
        <NativeSelectOption value="true">Yes</NativeSelectOption>
        <NativeSelectOption value="false">No</NativeSelectOption>
      </NativeSelect>
    )
  if (field.fieldType === "SELECT")
    return (
      <NativeSelect
        id={id}
        value={String(value ?? "")}
        required={field.required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full"
      >
        <NativeSelectOption value="">Choose an option</NativeSelectOption>
        {field.options
          .filter((option) => option.status === "ACTIVE")
          .map((option) => (
            <NativeSelectOption key={option.id} value={option.code}>
              {option.label}
            </NativeSelectOption>
          ))}
      </NativeSelect>
    )
  if (field.fieldType === "MULTI_SELECT")
    return (
      <NativeSelect
        id={id}
        multiple
        value={Array.isArray(value) ? value.map(String) : []}
        onChange={(event) =>
          onChange(
            [...event.target.selectedOptions].map((option) => option.value)
          )
        }
        className="w-full"
      >
        {field.options
          .filter((option) => option.status === "ACTIVE")
          .map((option) => (
            <NativeSelectOption key={option.id} value={option.code}>
              {option.label}
            </NativeSelectOption>
          ))}
      </NativeSelect>
    )
  const numeric = ["NUMBER", "CURRENCY", "QUANTITY_TON", "PERCENTAGE"].includes(
    field.fieldType
  )
  const dateTimeValue =
    field.fieldType === "DATETIME" && typeof value === "string"
      ? value.slice(0, 16)
      : inputValue(value)
  return (
    <Input
      id={id}
      type={
        field.fieldType === "DATE"
          ? "date"
          : field.fieldType === "DATETIME"
            ? "datetime-local"
            : field.fieldType === "PHONE"
              ? "tel"
              : numeric
                ? "number"
                : "text"
      }
      inputMode={
        numeric ? "decimal" : field.fieldType === "PHONE" ? "tel" : undefined
      }
      step={
        field.fieldType === "QUANTITY_TON"
          ? "0.001"
          : numeric
            ? "0.01"
            : undefined
      }
      min={field.validation.min}
      max={field.validation.max}
      maxLength={field.validation.maxLength}
      value={dateTimeValue}
      required={field.required}
      onChange={(event) => {
        if (field.fieldType === "DATETIME") {
          onChange(
            event.target.value ? new Date(event.target.value).toISOString() : ""
          )
        } else {
          onChange(event.target.value)
        }
      }}
    />
  )
}

export function DynamicFields({
  target,
  recordId,
  fields,
  inputName,
  onValuesChange,
  documentContentLinks = false,
}: {
  target: CustomFieldTarget
  recordId: string | null
  fields: RenderableCustomField[]
  inputName?: string
  onValuesChange?: (values: { definitionId: string; value: unknown }[]) => void
  documentContentLinks?: boolean
}) {
  const initialValues = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.id, field.value])),
    [fields]
  )
  const [values, setValues] = useState<Record<string, unknown>>(initialValues)
  const serialized = fields
    .filter((field) => field.canEdit)
    .map((field) => ({ definitionId: field.id, value: values[field.id] }))
  function update(id: string, value: unknown) {
    const next = { ...values, [id]: value }
    setValues(next)
    onValuesChange?.(
      fields
        .filter((field) => field.canEdit)
        .map((field) => ({ definitionId: field.id, value: next[field.id] }))
    )
  }
  if (!fields.length) return null
  return (
    <div className="flex flex-col gap-5">
      {inputName ? (
        <input
          type="hidden"
          name={inputName}
          value={JSON.stringify(serialized)}
        />
      ) : null}
      {TARGET_SECTIONS[target].map((section) => {
        const sectionFields = fields.filter(
          (field) => field.sectionKey === section.key
        )
        if (!sectionFields.length) return null
        return (
          <FieldSet key={section.key}>
            <FieldLegend>{section.label}</FieldLegend>
            <FieldGroup>
              {sectionFields.map((field) => (
                <Field key={field.id} data-disabled={!field.canEdit}>
                  <div className="flex items-center gap-2">
                    <FieldLabel htmlFor={`custom-field-${field.id}`}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </FieldLabel>
                    {field.historical ? (
                      <Badge variant="outline">Historical</Badge>
                    ) : null}
                  </div>
                  <FieldControl
                    target={target}
                    recordId={recordId}
                    field={field}
                    value={values[field.id]}
                    onChange={(value) => update(field.id, value)}
                    documentContentLinks={documentContentLinks}
                  />
                  {field.fieldType === "CURRENCY" ? (
                    <FieldDescription>Amount in INR.</FieldDescription>
                  ) : field.fieldType === "QUANTITY_TON" ? (
                    <FieldDescription>
                      Quantity in metric tons.
                    </FieldDescription>
                  ) : field.fieldType === "MULTI_SELECT" ? (
                    <FieldDescription>
                      Hold Ctrl or Command to select multiple options.
                    </FieldDescription>
                  ) : null}
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>
        )
      })}
    </div>
  )
}

export function CustomFieldsPanel({
  target,
  recordId,
  fields,
  documentContentLinks = false,
}: {
  target: CustomFieldTarget
  recordId: string
  fields: RenderableCustomField[]
  documentContentLinks?: boolean
}) {
  const router = useRouter()
  const save = useServerFn(saveCustomFieldValuesFn)
  const [values, setValues] = useState(
    fields
      .filter((field) => field.canEdit)
      .map((field) => ({ definitionId: field.id, value: field.value }))
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const editable = fields.some((field) => field.canEdit)
  if (!fields.length) return null
  async function submit() {
    setPending(true)
    setError("")
    try {
      await save({ data: { target, recordId, values } })
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Custom fields could not be saved."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Additional fields</CardTitle>
        <CardDescription>
          Configured for {CUSTOM_FIELD_TARGET_LABELS[target]}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DynamicFields
          key={fields
            .map((field) => `${field.id}:${field.valueVersion ?? "new"}`)
            .join("|")}
          target={target}
          recordId={recordId}
          fields={fields}
          onValuesChange={setValues}
          documentContentLinks={documentContentLinks}
        />
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Save failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      {editable ? (
        <CardFooter>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Save additional fields
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

export function parseCustomFieldValues(form: FormData) {
  const raw = String(form.get("customFields") ?? "[]")
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error("Invalid custom field values.")
  return parsed.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("definitionId" in entry) ||
      typeof entry.definitionId !== "string" ||
      !("value" in entry)
    )
      throw new Error("Invalid custom field values.")
    return { definitionId: entry.definitionId, value: entry.value }
  })
}
