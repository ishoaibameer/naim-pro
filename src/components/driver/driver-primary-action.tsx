import { useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { IconMapPin, IconRoute } from "@tabler/icons-react"

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
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  createDriverCheckInFn,
  startDriverJourneyFn,
} from "@/server/driver/driver.functions"

type DriverAction = "REACHED_PICKUP" | "START_JOURNEY" | "REACHED_DESTINATION"

const labels: Record<DriverAction, string> = {
  REACHED_PICKUP: "I reached pickup",
  START_JOURNEY: "Start journey",
  REACHED_DESTINATION: "I reached destination",
}

export function DriverPrimaryAction({
  action,
  tripId,
  version,
}: {
  action: DriverAction
  tripId: string
  version: number
}) {
  const router = useRouter()
  const checkIn = useServerFn(createDriverCheckInFn)
  const startJourney = useServerFn(startDriverJourneyFn)
  const [note, setNote] = useState("")
  const [locationText, setLocationText] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setPending(true)
    setError("")
    try {
      if (action === "START_JOURNEY")
        await startJourney({ data: { id: tripId, version } })
      else
        await checkIn({
          data: { id: tripId, version, type: action, note, locationText },
        })
      await router.invalidate({ sync: true })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Action could not be recorded. Refresh and try again."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Next action</CardTitle>
        <CardDescription>
          {action === "START_JOURNEY"
            ? "This changes the Trip to In Transit."
            : "This records a timestamped operational check-in only."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {action !== "START_JOURNEY" ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`location-${tripId}`}>
                Location text (optional)
              </FieldLabel>
              <Input
                id={`location-${tripId}`}
                value={locationText}
                onChange={(event) => setLocationText(event.target.value)}
                maxLength={240}
                placeholder="Landmark or location name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`note-${tripId}`}>
                Note (optional)
              </FieldLabel>
              <Textarea
                id={`note-${tripId}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
              />
            </Field>
          </FieldGroup>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                size="lg"
                className="min-h-16 w-full"
                disabled={pending}
              />
            }
          >
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : action === "START_JOURNEY" ? (
              <IconRoute data-icon="inline-start" />
            ) : (
              <IconMapPin data-icon="inline-start" />
            )}
            {labels[action]}
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Confirm {labels[action].toLowerCase()}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {action === "START_JOURNEY"
                  ? "The Trip will move from Loaded to In Transit. Delivery and final weight still require Member or Admin confirmation."
                  : "Your current time and the optional details entered will be recorded. This does not confirm delivery."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go back</AlertDialogCancel>
              <AlertDialogAction onClick={() => void submit()}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
