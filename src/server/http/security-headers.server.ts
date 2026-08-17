import "@tanstack/react-start/server-only"

export function applySecurityHeaders(headers: Headers): void {
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'"
  )
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  headers.set(
    "Permissions-Policy",
    "camera=(self), geolocation=(), microphone=(), payment=(), usb=()"
  )
  headers.set("X-Frame-Options", "DENY")
  if (process.env.APP_ENV === "production")
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    )
}
