<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

# NAIM PRO architecture

- Build NAIM PRO as a full-stack TanStack Start modular monolith.
- PostgreSQL will be the production database.
- Drizzle will be the ORM/query layer unless explicitly changed later.
- Build the UI mobile-first.
- Use metric tons as the weight unit.
- Use INR as the currency.
- Keep route files thin. Put authoritative business logic in server/domain
  services under `src/server`.
- TanStack Start code is isomorphic by default. Protect server-only modules with
  `*.server.ts`, `@tanstack/react-start/server-only`, or an appropriate TanStack
  server function boundary, and never import them into client bundles.

# Roles

- `ADMIN`
- `MEMBER`
- `VENDOR`
- `DRIVER`

# Authorization

- Role checks alone are insufficient.
- Every sensitive server operation must enforce resource-level authorization.
- Vendors may only access their own business records.
- Drivers may only access assigned trips.
- Members share authorized operational visibility.
- Admin has system-wide administrative access.
- Route guards protect navigation and user experience; authorization at the
  server operation is the authoritative security boundary.

# Core domain

- A Deal is a commercial purchase agreement.
- A Trip is the physical movement of material.
- A Deal may contain multiple Trips.
- Never merge Deal and Trip into one database entity.

# Trip lifecycle

The permitted lifecycle is:

1. `CREATED`
2. `TRUCK_ASSIGNED`
3. `LOADING`
4. `LOADED`
5. `IN_TRANSIT`
6. `DELIVERED`
7. `SETTLEMENT_PENDING`
8. `SETTLED`
9. `ARCHIVED`

Transitions must happen through explicit domain actions. Do not expose a
free-form status dropdown.

# Delivery core data

- Delivery Challan Number
- Vehicle
- Final Weight in metric tons
- Weighment Card Number

# Financial rules

- Authoritative calculations run server-side.
- Do not duplicate authoritative domain calculations across frontend and
  backend.
- Financial records must not be silently overwritten or hard-deleted.

Canonical calculations include:

```text
weightDifference = loadedWeight - finalWeight
purchaseAmount = acceptedFinalWeight * purchaseRate
vendorBalance = purchaseAmount - allocatedVendorPayments
```

# Audit rules

- Sensitive mutations must produce audit events.
- Audit history must preserve actor, action, entity, timestamp, and before/after
  values where applicable.
- Do not implement fake immutability solely in UI code.

# Dynamic fields

- Core relational fields remain fixed.
- Variable business fields may later use versioned custom-field definitions.
- Do not model Vendor, Driver, Vehicle, Trip, Deal, Payment, or other core
  relationships as generic JSON custom fields.

# UI

- Design mobile-first.
- Prefer auto-fill, entity selectors over repeated text input, compact cards,
  stage-based forms, camera-friendly uploads, clear search/filtering, and
  accessible labels.
- Dashboards show summaries, exceptions, and actionable items.
- Dashboards must not dump every active trip.
- Use existing shadcn/Base UI components and semantic design tokens before
  creating custom UI primitives.

# Coding rules

- Keep TypeScript strict.
- Avoid `any` unless unavoidable and documented.
- Keep route files thin.
- Prefer explicit domain names.
- Validate server inputs.
- Read secrets only inside explicit per-request server boundaries; never expose
  them through `VITE_` variables or client code.
- Do not hard-delete financial, audit, trip, or deal records.
- Treat `src/routeTree.gen.ts` as generated code. Never edit it manually; change
  route source files or router configuration and regenerate it.
