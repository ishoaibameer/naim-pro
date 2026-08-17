import { useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { IconCheck, IconX } from "@tabler/icons-react"

import { OperationsStatusBadge } from "@/components/operations/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, formatInr } from "@/lib/format"
import { cn } from "@/lib/utils"
import { reviewDriverExpenseFn } from "@/server/driver/driver.functions"

interface Expense {
  id: string
  driver: string
  type: string
  amount: string
  expenseDate: string
  note: string | null
  status: string
  receiptDocumentId: string | null
  reviewNote: string | null
  reviewedBy: string | null
  reviewedAt: Date | string | null
  version: number
}

export function DriverExpenseReview({ expenses }: { expenses: Expense[] }) {
  const router = useRouter()
  const review = useServerFn(reviewDriverExpenseFn)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [pendingId, setPendingId] = useState("")
  const [error, setError] = useState("")
  async function decide(expense: Expense, status: "APPROVED" | "REJECTED") {
    setPendingId(expense.id)
    setError("")
    try {
      await review({
        data: {
          expenseId: expense.id,
          version: expense.version,
          status,
          note: notes[expense.id] ?? "",
        },
      })
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Expense review failed."
      )
    } finally {
      setPendingId("")
    }
  }
  if (!expenses.length)
    return (
      <p className="text-sm text-muted-foreground">
        No Driver expenses for this Trip.
      </p>
    )
  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Review failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {expenses.map((expense) => (
        <Card key={expense.id}>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{formatInr(expense.amount)}</CardTitle>
              <p className="text-sm">
                {expense.driver} · {expense.type} ·{" "}
                {formatDate(expense.expenseDate)}
              </p>
            </div>
            <OperationsStatusBadge status={expense.status} />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {expense.note ? <p className="text-sm">{expense.note}</p> : null}
            {expense.receiptDocumentId ? (
              <a
                href={`/api/documents/${expense.receiptDocumentId}`}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
              >
                View receipt
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">
                No receipt attached.
              </p>
            )}
            {expense.status === "PENDING" ? (
              <Field>
                <FieldLabel htmlFor={`review-note-${expense.id}`}>
                  Review note (optional)
                </FieldLabel>
                <Textarea
                  id={`review-note-${expense.id}`}
                  value={notes[expense.id] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [expense.id]: event.target.value,
                    }))
                  }
                  maxLength={1000}
                />
              </Field>
            ) : (
              <p className="text-sm text-muted-foreground">
                Reviewed by {expense.reviewedBy ?? "Unknown"}
                {expense.reviewNote ? ` · ${expense.reviewNote}` : ""}
              </p>
            )}
          </CardContent>
          {expense.status === "PENDING" ? (
            <CardFooter className="flex-wrap gap-2">
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button disabled={Boolean(pendingId)} />}
                >
                  {pendingId === expense.id ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <IconCheck data-icon="inline-start" />
                  )}
                  Approve
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve this expense?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This records operational approval but does not create a
                      Payment ledger entry.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void decide(expense, "APPROVED")}
                    >
                      Approve
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="outline" disabled={Boolean(pendingId)} />
                  }
                >
                  <IconX data-icon="inline-start" />
                  Reject
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject this expense?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The rejection and optional review note will be audited.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void decide(expense, "REJECTED")}
                    >
                      Reject
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          ) : null}
        </Card>
      ))}
    </div>
  )
}
