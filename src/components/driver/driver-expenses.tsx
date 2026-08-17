import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { IconCash, IconPlus } from "@tabler/icons-react"

import { DocumentUploadCard } from "@/components/documents/document-upload-card"
import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { formatDate, formatInr } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  attachDriverExpenseReceiptFn,
  createDriverExpenseFn,
} from "@/server/driver/driver.functions"

interface DriverExpenseData {
  id: string
  type: string
  amount: string
  expenseDate: string
  note: string | null
  status: string
  receiptDocumentId: string | null
  createdAt: Date | string
  version: number
}

export function DriverExpenses({
  tripId,
  expenses,
  canCreate,
}: {
  tripId: string
  expenses: DriverExpenseData[]
  canCreate: boolean
}) {
  const router = useRouter()
  const createExpense = useServerFn(createDriverExpenseFn)
  const attachReceipt = useServerFn(attachDriverExpenseReceiptFn)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError("")
    try {
      await createExpense({
        data: {
          tripId,
          type: String(form.get("type")) as
            "DIESEL" | "TOLL" | "PARKING" | "OTHER",
          amount: String(form.get("amount")),
          expenseDate: String(form.get("expenseDate")),
          note: String(form.get("note") ?? ""),
        },
      })
      event.currentTarget.reset()
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Expense could not be submitted."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Trip expenses</h2>
      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Add expense claim</CardTitle>
            <CardDescription>
              Claims remain pending until a Member or Admin reviews them.
            </CardDescription>
          </CardHeader>
          <form onSubmit={submit}>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`expense-type-${tripId}`}>
                    Expense type
                  </FieldLabel>
                  <NativeSelect
                    id={`expense-type-${tripId}`}
                    name="type"
                    defaultValue="DIESEL"
                  >
                    <NativeSelectOption value="DIESEL">
                      Diesel
                    </NativeSelectOption>
                    <NativeSelectOption value="TOLL">Toll</NativeSelectOption>
                    <NativeSelectOption value="PARKING">
                      Parking
                    </NativeSelectOption>
                    <NativeSelectOption value="OTHER">Other</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`expense-amount-${tripId}`}>
                    Amount (INR)
                  </FieldLabel>
                  <Input
                    id={`expense-amount-${tripId}`}
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`expense-date-${tripId}`}>
                    Date
                  </FieldLabel>
                  <Input
                    id={`expense-date-${tripId}`}
                    name="expenseDate"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`expense-note-${tripId}`}>
                    Note (optional)
                  </FieldLabel>
                  <Textarea
                    id={`expense-note-${tripId}`}
                    name="note"
                    maxLength={1000}
                  />
                </Field>
              </FieldGroup>
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Expense failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <IconPlus data-icon="inline-start" />
                )}
                Submit claim
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}
      {expenses.length ? (
        <div className="flex flex-col gap-3">
          {expenses.map((expense) => (
            <div key={expense.id} className="flex flex-col gap-3">
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle>{formatInr(expense.amount)}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {expense.type} · {formatDate(expense.expenseDate)}
                    </p>
                  </div>
                  <OperationsStatusBadge status={expense.status} />
                </CardHeader>
                {expense.note ? (
                  <CardContent>
                    <p className="text-sm">{expense.note}</p>
                  </CardContent>
                ) : null}
                <CardFooter>
                  {expense.receiptDocumentId ? (
                    <a
                      href={`/api/documents/${expense.receiptDocumentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-full"
                      )}
                    >
                      <IconCash data-icon="inline-start" />
                      View receipt
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No receipt attached.
                    </p>
                  )}
                </CardFooter>
              </Card>
              {!expense.receiptDocumentId &&
              canCreate &&
              expense.status === "PENDING" ? (
                <DocumentUploadCard
                  targetType="TRIP"
                  targetId={tripId}
                  documentTypes={["OTHER"]}
                  defaultDocumentType="OTHER"
                  title="Add expense receipt"
                  onUploaded={async (result) => {
                    await attachReceipt({
                      data: {
                        expenseId: expense.id,
                        documentId: result.id,
                        version: expense.version,
                      },
                    })
                    await router.invalidate({ sync: true })
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No expense claims for this Trip.
        </p>
      )}
    </section>
  )
}
