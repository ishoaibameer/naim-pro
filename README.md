# NAIM PRO

Mobile-first wood trading, logistics, payment, document, and audit management
system.

## Foundation

NAIM PRO is a full-stack TanStack Start modular monolith using React 19,
TypeScript, Tailwind CSS 4, and shadcn/Base UI. PostgreSQL with Drizzle ORM is
the persistence layer.

## Development

```bash
pnpm install
pnpm dev
```

The development server runs on port 3000.

## Validation

```bash
pnpm typecheck
pnpm lint
pnpm check
pnpm test
pnpm build
```

## Environment

Copy `.env.example` to a local environment file and replace its safe
placeholders. Never commit real secrets.

## Local database workflow

1. Create a local PostgreSQL database and role for NAIM PRO.
2. Copy `.env.example` to `.env` and replace both placeholder values. Local
   environment files are ignored by Git.
3. Generate a migration after an intentional schema change with
   `pnpm db:generate`.
4. Apply committed migrations to the configured database with
   `pnpm db:migrate`.
5. Check migration history consistency with `pnpm db:check`.
6. Optionally inspect local data with `pnpm db:studio`.
7. Start the application with `pnpm dev`.

The runtime validates `DATABASE_URL` and `SESSION_SECRET` only inside the
server boundary. Migration generation and checks do not need a live database;
migration and Studio commands do.

Mutable business rows use an integer `version` starting at `1`. Future mutation
services must include the expected version in their `UPDATE` predicate and
increment it atomically; updating zero rows indicates a concurrency conflict.

## Source boundaries

- Keep route files thin.
- Put authoritative business logic in server/domain services.
- Keep secrets and persistence code behind explicit TanStack Start server
  boundaries.
- Do not import server-only modules into client bundles.

Authentication security decisions are documented in
[`docs/architecture/authentication.md`](docs/architecture/authentication.md).
