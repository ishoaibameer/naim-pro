import { useState } from "react"
import { IconAlertTriangle } from "@tabler/icons-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function StatusAction({
  label,
  description,
  destructive = false,
  onConfirm,
}: {
  label: string
  description: string
  destructive?: boolean
  onConfirm: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant={destructive ? "destructive" : "outline"} />}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <IconAlertTriangle />
          </AlertDialogMedia>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={async () => {
              setPending(true)
              try {
                await onConfirm()
              } finally {
                setPending(false)
              }
            }}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
