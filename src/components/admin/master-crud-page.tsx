import { useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { IconEdit, IconPlus, IconSearch } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { RecordEmpty } from "@/components/admin/record-empty"
import { StatusAction } from "@/components/admin/status-action"
import { StatusBadge } from "@/components/admin/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"

export interface MasterRecord {
  id: string
  title: string
  subtitle?: string | null
  status: "ACTIVE" | "INACTIVE"
  version: number
  values: Record<string, string | null>
}

export function MasterCrudPage({
  title,
  description,
  records,
  renderFields,
  onSave,
  onToggle,
  onSearch,
  renderRecordActions,
}: {
  title: string
  description: string
  records: MasterRecord[]
  renderFields: (record: MasterRecord | null) => ReactNode
  onSave: (form: FormData, record: MasterRecord | null) => Promise<void>
  onToggle: (record: MasterRecord) => Promise<void>
  onSearch?: (search: string) => void
  renderRecordActions?: (record: MasterRecord) => ReactNode
}) {
  const [editing, setEditing] = useState<MasterRecord | null>(null)
  const [showForm, setShowForm] = useState(records.length === 0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await onSave(new FormData(event.currentTarget), editing)
      setEditing(null)
      setShowForm(false)
      event.currentTarget.reset()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save record."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Masters"
        title={title}
        description={description}
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
          >
            <IconPlus data-icon="inline-start" />
            Add {title.replace(/s$/, "")}
          </Button>
        }
      />
      {onSearch ? (
        <form
          className="flex gap-2 rounded-lg border bg-card p-3"
          onSubmit={(event) => {
            event.preventDefault()
            onSearch(
              String(new FormData(event.currentTarget).get("search") ?? "")
            )
          }}
        >
          <Field className="flex-1">
            <FieldLabel htmlFor="master-search" className="sr-only">
              Search
            </FieldLabel>
            <Input
              id="master-search"
              name="search"
              type="search"
              placeholder={`Search ${title.toLowerCase()}`}
            />
          </Field>
          <Button type="submit" variant="outline">
            <IconSearch data-icon="inline-start" />
            Search
          </Button>
        </form>
      ) : null}
      {showForm ? (
        <form key={editing?.id ?? "new"} onSubmit={submit}>
          <Card>
            <CardHeader>
              <CardTitle>
                {editing
                  ? `Edit ${editing.title}`
                  : `Add ${title.replace(/s$/, "")}`}
              </CardTitle>
              <CardDescription>
                Changes are organization-scoped and recorded in activity
                history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {renderFields(editing)}
                <Field>
                  <FieldLabel htmlFor="master-status">Status</FieldLabel>
                  <NativeSelect
                    id="master-status"
                    name="status"
                    defaultValue={editing?.status ?? "ACTIVE"}
                  >
                    <NativeSelectOption value="ACTIVE">
                      Active
                    </NativeSelectOption>
                    <NativeSelectOption value="INACTIVE">
                      Inactive
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
              </FieldGroup>
              {error ? (
                <Alert variant="destructive" className="mt-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
            <CardFooter className="gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}Save
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null)
                  setShowForm(false)
                }}
              >
                Cancel
              </Button>
            </CardFooter>
          </Card>
        </form>
      ) : null}
      {records.length === 0 ? (
        <RecordEmpty
          title={`No ${title.toLowerCase()} found`}
          description="Create the first record to get started."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {records.map((record) => (
            <Card key={record.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{record.title}</CardTitle>
                    {record.subtitle ? (
                      <CardDescription className="mt-1">
                        {record.subtitle}
                      </CardDescription>
                    ) : null}
                  </div>
                  <StatusBadge status={record.status} />
                </div>
              </CardHeader>
              <CardFooter className="gap-2">
                {renderRecordActions?.(record)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(record)
                    setShowForm(true)
                  }}
                >
                  <IconEdit data-icon="inline-start" />
                  Edit
                </Button>
                <StatusAction
                  label={record.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  destructive={record.status === "ACTIVE"}
                  description="This record will remain in history and can be reactivated later."
                  onConfirm={() => onToggle(record)}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
