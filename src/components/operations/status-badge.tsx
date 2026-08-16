import { Badge } from "@/components/ui/badge"

export function OperationsStatusBadge({ status }: { status: string }) {
  const label = status.replaceAll("_", " ")
  return (
    <Badge
      variant={
        status === "CANCELLED"
          ? "destructive"
          : status === "DELIVERED"
            ? "secondary"
            : "outline"
      }
    >
      {label}
    </Badge>
  )
}
