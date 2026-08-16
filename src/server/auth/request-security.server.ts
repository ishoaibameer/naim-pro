import "@tanstack/react-start/server-only"

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin) {
    throw new Error("Request origin validation failed.")
  }
}

export function getNetworkIdentifier(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  )
}
