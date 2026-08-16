import { useState } from "react"
import type { FormEvent } from "react"
import { IconSearch } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

export function ListToolbar({
  initialSearch,
  status,
  onChange,
}: {
  initialSearch: string
  status: "ALL" | "ACTIVE" | "INACTIVE"
  onChange: (value: {
    search: string
    status: "ALL" | "ACTIVE" | "INACTIVE"
  }) => void
}) {
  const [search, setSearch] = useState(initialSearch)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onChange({ search, status })
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end"
      onSubmit={submit}
    >
      <FieldGroup className="flex-1 gap-3 sm:flex-row">
        <Field className="flex-1">
          <FieldLabel htmlFor="record-search" className="sr-only">
            Search
          </FieldLabel>
          <Input
            id="record-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or phone"
          />
        </Field>
        <Field className="sm:w-44">
          <FieldLabel htmlFor="record-status" className="sr-only">
            Status
          </FieldLabel>
          <NativeSelect
            id="record-status"
            value={status}
            onChange={(event) =>
              onChange({
                search,
                status: event.target.value as "ALL" | "ACTIVE" | "INACTIVE",
              })
            }
          >
            <NativeSelectOption value="ALL">All statuses</NativeSelectOption>
            <NativeSelectOption value="ACTIVE">Active</NativeSelectOption>
            <NativeSelectOption value="INACTIVE">Inactive</NativeSelectOption>
          </NativeSelect>
        </Field>
      </FieldGroup>
      <Button type="submit" variant="outline">
        <IconSearch data-icon="inline-start" />
        Search
      </Button>
    </form>
  )
}
