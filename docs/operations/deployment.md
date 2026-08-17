# Production Deployment

## Recommended target

Deploy the existing TanStack Start SSR application as a Node.js 22 container on a managed container platform. This matches the current Node APIs, native Argon2 dependency, PostgreSQL driver, server functions, and private object-storage adapter without a framework migration. Use Neon PostgreSQL or equivalent and S3-compatible private storage such as Cloudflare R2 or AWS S3.

The build uses TanStack Start with the Nitro Node adapter and starts `.output/server/index.mjs`.

## Environment separation

Development, staging, and production require separate databases, session secrets, storage buckets/prefixes, credentials, origins, and deployment variables. Do not copy `.env` into a deployed image. Configure secrets in the hosting platform and rotate them independently.

Required server variables:

- `APP_ENV`, `APP_ORIGIN`, `DATABASE_URL`, `DATABASE_MAX_CONNECTIONS`
- `SESSION_SECRET` (independent value with at least 48 characters)
- `DOCUMENT_STORAGE_DRIVER=s3`
- `DOCUMENT_STORAGE_BUCKET`, `DOCUMENT_STORAGE_REGION`
- `DOCUMENT_STORAGE_ACCESS_KEY_ID`, `DOCUMENT_STORAGE_SECRET_ACCESS_KEY`
- `DOCUMENT_STORAGE_ENDPOINT` for non-AWS S3-compatible providers
- `DOCUMENT_STORAGE_FORCE_PATH_STYLE` where required
- `TRUSTED_PROXY_MODE` matching the actual platform
- `LOG_LEVEL`, `SLOW_QUERY_THRESHOLD_MS`
- `DOCUMENT_MALWARE_SCAN_POLICY`

Never use `VITE_` prefixes for these variables.

## Build and start

```text
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

The container exposes port 3000. The platform must terminate HTTPS, preserve the original host/scheme, strip untrusted forwarding headers, and pass only the header selected by `TRUSTED_PROXY_MODE`.

## Database migration

1. Verify a current backup and restoration path.
2. Run CI and `pnpm db:preflight` with the migration role.
3. Review generated SQL; never edit an applied migration.
4. Apply forward migrations with `pnpm db:migrate` before activating code that requires them.
5. Verify `/health/ready`, critical queries, and migration journal.

Use expand/migrate/contract sequencing for incompatible changes. Add nullable/defaulted structures first, backfill in bounded batches, deploy compatible code, and remove old structures only in a later reviewed release.

## Storage

The bucket must be private with public listing and public object access disabled. Application credentials need only get/head/put/delete permissions for the configured bucket. Downloads remain proxied through application authorization; no permanent public URLs are created. Object keys are opaque and checksums are verified on every read.

`DOCUMENT_MALWARE_SCAN_POLICY=REQUIRED` intentionally rejects uploads until a real scanner adapter is configured. No scanner is bundled and no claim of malware scanning should be made.

## Initial Admin

Use `pnpm auth:bootstrap:production` once with explicit one-time variables, `APP_ENV=production`, `NODE_ENV=production`, and `PRODUCTION_BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN`. The password must be at least 14 characters with upper/lowercase, a number, and a symbol. The created Admin must change it on first use.

After success, remove every `BOOTSTRAP_*` and confirmation variable from the platform, rotate any temporary delivery channel, and preserve the audit event. Never put bootstrap credentials in repository files.

## Health and post-deploy verification

- `/health/live`: process liveness only.
- `/health/ready`: bounded database connectivity check.

After deployment, verify HTTPS redirect, security headers, login/logout, direct unauthorized URLs, one server mutation, document upload/download, reports/CSV, logging/request IDs, and staging rollback.

## Rollback

Roll back the application image to the last known-good immutable version. Forward-compatible migrations normally remain in place. Never reverse a production migration by deleting columns/tables automatically. If a database restore is necessary, follow the backup/restore runbook and reconcile all writes after the recovery timestamp.
