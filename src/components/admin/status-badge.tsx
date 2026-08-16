import { Badge } from "@/components/ui/badge"

export function StatusBadge({
  status,
}: {
  status: "ACTIVE" | "INACTIVE" | null
}) {
  return (
    <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>
      {status ?? "No login"}
    </Badge>
  )
}
