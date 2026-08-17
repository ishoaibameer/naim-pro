import type { FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { IconSearch } from "@tabler/icons-react"

import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { globalSearch } from "@/server/product/search.server"

type Results = Awaited<ReturnType<typeof globalSearch>>

export function GlobalSearchPage({
  results,
  query,
}: {
  results: Results
  query: string
}) {
  const navigate = useNavigate({ from: "/app/search" })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void navigate({ search: { q: String(form.get("q") ?? "") } })
  }
  const groups = [
    ["Trips", results.trips],
    ["Deals", results.deals],
    ["Vendors and companies", results.parties],
    ["Vehicles", results.vehicles],
    ["Drivers", results.drivers],
    ["Payments", results.payments],
  ] as const
  const count = groups.reduce((total, [, items]) => total + items.length, 0)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Find records"
        title="Search"
        description="Search operational references across your organization."
      />
      <form onSubmit={submit} className="flex items-end gap-2">
        <Field className="flex-1">
          <FieldLabel htmlFor="global-search">
            Trip, Deal, vehicle, party, challan, weighment card, or receipt
          </FieldLabel>
          <Input
            id="global-search"
            name="q"
            defaultValue={query}
            minLength={2}
            maxLength={100}
          />
        </Field>
        <Button type="submit">
          <IconSearch data-icon="inline-start" />
          Search
        </Button>
      </form>
      {query.length < 2 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Search NAIM PRO</EmptyTitle>
            <EmptyDescription>
              Enter at least two characters to find authorized records.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : count === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No search results</EmptyTitle>
            <EmptyDescription>
              No authorized records match “{query}”.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups
            .filter(([, items]) => items.length)
            .map(([title, items]) => (
              <Card key={title}>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>
                    {items.length} result{items.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  {items.map((item) =>
                    item.href ? (
                      <a
                        key={item.id}
                        href={item.href}
                        className="flex min-w-0 flex-col rounded-md px-3 py-2 hover:bg-accent"
                      >
                        <span className="truncate font-medium">
                          {item.primary}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.secondary || title}
                        </span>
                      </a>
                    ) : (
                      <div
                        key={item.id}
                        className="flex min-w-0 flex-col px-3 py-2"
                      >
                        <span className="truncate font-medium">
                          {item.primary}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.secondary || "Driver"}
                        </span>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
