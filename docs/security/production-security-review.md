# Production Security Review

Review scope: Admin, Member, Vendor, Driver, Deals, Trips, Payments, Bills, Documents, Custom Fields, Reports, Notifications, and Driver Expenses.

## Confirmed controls

- Protected server functions use Admin, operations, Vendor, Driver, or authenticated middleware; domain services additionally enforce organization and resource ownership/assignment.
- Raw document upload/download and report export authenticate directly at the HTTP boundary.
- Mutations use explicit POST boundaries and same-origin checks; global request middleware now rejects cross-origin mutations.
- Production sessions use `__Host-naim_session`, Secure, HttpOnly, SameSite=Lax, Path `/`, no Domain, seven-day absolute expiry, 24-hour idle expiry, revocation, and security-version invalidation.
- Passwords use Argon2id; generic login errors and account/network throttling are retained.
- Audit events have database-enforced UPDATE/DELETE protection.
- Storage is private, keys are opaque, downloads are authorized, and size/type/checksum integrity is validated.
- Reports/search/notifications are ADMIN/MEMBER-only and organization/recipient scoped.

## Findings fixed in Step 13

- Local-only document storage: S3-compatible adapter and production fail-closed policy added.
- Spoofable proxy headers: headers are ignored unless a specific trusted proxy mode is configured.
- Missing response hardening: CSP, frame, MIME, referrer, permissions, and production HSTS added.
- Missing correlation/safe logs: structured request logging with redaction and request IDs added.
- Missing health, CI, secret scan, test-database guard, migration preflight, and deployment contract: added.

## Open deployment decisions

- Select/configure and verify an error-monitoring provider. Only sanitized errors and identifiers should be sent; no financial/document payloads.
- Select/configure a malware scanner or explicitly accept the risk. `REQUIRED` mode fails closed without one.
- Verify platform forwarding-header behavior before enabling a trusted proxy mode.
- Execute the full PostgreSQL workflow integration suite and Playwright role workflow against isolated infrastructure; current automated coverage is foundational, not complete acceptance.
- Conduct dependency/container vulnerability scanning in the deployment platform.
