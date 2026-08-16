# Authentication foundation

NAIM PRO uses first-party phone-and-password authentication backed by opaque
PostgreSQL sessions. Authentication and authorization execute only inside
TanStack Start server boundaries. Route guards improve navigation, while each
protected server function independently loads and validates its session.

## Phone and passwords

- Indian mobile inputs are normalized to `+91XXXXXXXXXX` before lookup.
- Ambiguous, non-Indian, and invalid mobile numbers are rejected.
- New and reset passwords contain 10–1024 characters. Passphrases are allowed;
  no composition rule is imposed.
- Passwords use Argon2id with 19,456 KiB memory, two iterations, parallelism
  one, and a 32-byte hash output.
- Login performs an Argon2id verification against a fixed dummy hash when the
  account does not exist, and every credential failure uses the same response.

## Sessions and cookies

- The browser receives 32 cryptographically random bytes encoded with
  base64url. PostgreSQL stores only its SHA-256 hash.
- Absolute session lifetime is seven days; idle expiration is 24 hours.
- `last_seen_at` is treated as the last-active timestamp and is refreshed at
  most once every 15 minutes.
- The session captures the user's security version. Password reset increments
  that version and revokes all active sessions in the same transaction.
- Production cookie: `__Host-naim_session`; development cookie: `naim_session`.
- Cookie flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, finite `Max-Age`, and
  `Secure` in production. No `Domain` attribute is used.
- Login rotates any existing browser session. Logout revokes the current
  database session and expires the cookie.

## Login throttling

Failed login keys are HMAC-SHA-256 values derived with `SESSION_SECRET`; raw
phone input and network identifiers are not stored in the throttling table.
Authentication is temporarily rejected when either threshold is reached in a
rolling 15-minute window:

- five failures for the account key;
- twenty failures for the network key.

Successful login clears recent failures for that account. Deployment must only
trust `CF-Connecting-IP`, `X-Real-IP`, or `X-Forwarded-For` when the application
is behind a proxy that overwrites those headers.

## Authorization and audit invariants

- Identity and role come only from a validated session, never client-supplied
  `userId`, role, membership, or organization values.
- Inactive Users, Memberships, or Organizations cannot authenticate or
  authorize.
- MVP phone-only login requires exactly one active Organization Membership.
  Multi-organization account selection remains a later explicit workflow.
- Vendor access requires the Vendor's linked User to match the session User.
- Driver access requires current or permitted historical assignment to the
  Trip. Pure scope helpers exist now; future resource services must query the
  authoritative relationship before calling them.
- Admin user creation and password reset re-check ADMIN role and Organization
  scope inside their server functions and domain services.
- `LOGIN_SUCCESS`, `LOGOUT`, `USER_CREATED`, and `PASSWORD_RESET` are audited.
  Login failures use the dedicated throttling table instead of creating noisy
  audit records.
- Passwords, password hashes, raw session tokens, token hashes, throttling
  source values, and secrets never enter client responses or audit JSON.
- Non-GET auth server functions require an exact same-origin request.

## Development bootstrap

After applying migrations to a non-production database, the first Organization
and ADMIN may be created with `pnpm auth:bootstrap`. The command refuses
`NODE_ENV=production`, refuses duplicate phone or Organization names, and reads
the following values from the process environment without printing secrets:

- `BOOTSTRAP_ORGANIZATION_NAME`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_PHONE`
- `BOOTSTRAP_ADMIN_PASSWORD`

`DATABASE_URL` and `SESSION_SECRET` must also be configured. The command creates
only the controlled Organization, ADMIN User, Membership, and audit evidence;
it does not create business fixtures.
