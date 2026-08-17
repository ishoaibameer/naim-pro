import { useRouter } from "@tanstack/react-router"
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { mapUserFacingError } from "@/lib/user-error"

export function RoutePendingState() {
  return (
    <main
      className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-8"
      aria-busy="true"
      aria-label="Loading page"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}

export function RouteErrorState({ error }: { error: Error }) {
  const router = useRouter()
  const safe = mapUserFacingError(error)
  return (
    <main className="mx-auto w-full max-w-2xl p-4 pt-16">
      <Alert variant="destructive">
        <IconAlertTriangle />
        <AlertTitle>{safe.title}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{safe.message}</span>
          <Button variant="outline" onClick={() => router.invalidate()}>
            <IconRefresh data-icon="inline-start" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  )
}
