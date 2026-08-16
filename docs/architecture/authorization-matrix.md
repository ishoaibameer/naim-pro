# NAIM PRO authorization matrix

Status: proposed authorization design only. This document does not implement
authentication, route guards, middleware, server functions, or database row
security.

## 1. Role definitions

Authorization is evaluated within one active `OrganizationMembership`. A role is
necessary but never sufficient: every decision also checks organization,
resource relationship, state, field, and requested action.

### `ADMIN`

- Organization-wide administrative and operational access.
- Manages Users, Memberships, role changes, password resets, configuration,
  archive/restore, and sensitive financial approvals.
- Can view AuditEvent records, but cannot update or delete them.
- Is still subject to lifecycle, reversal, append-only, concurrency, and audit
  invariants. “Admin” does not mean direct table mutation without domain rules.

### `MEMBER`

- Shared organization-wide operational visibility under the current single-team
  assumption.
- Creates and updates operational master data, Deals, Trips, documents, draft
  Payments, and draft Bills through explicit actions.
- Cannot manage Users/roles, configure custom fields, hard-delete history, or
  mutate AuditEvent records.
- This proposal reserves payment posting/reversal, Trip settlement, and Bill
  issue/void for Admin until product owners decide whether Members may approve
  them.

### `VENDOR`

- Access exists only when the logged-in User is linked to a Vendor record in the
  active Organization.
- Can see that Vendor's record and its related Deals, Trips, posted Vendor
  Payments, and permitted Documents.
- Can see its own agreed purchase rate and purchase/payment totals under the
  current assumption.
- Cannot see other Vendors, Company billing/receivables, sale revenue, internal
  margin, Transporter costs, internal notes, or raw audit history.

### `DRIVER`

- Access exists only when the logged-in User is linked to a Driver record in the
  active Organization.
- Can see currently assigned Trips and only the permitted historical assignments.
- Can perform explicitly allowed Trip-stage actions and upload operational
  evidence for an assigned Trip.
- Cannot see Vendor pricing/payments, Company billing/receivables, profit,
  unrelated Trips, or raw audit history.

### Matrix notation

- **Org**: allowed across the active Organization, subject to state/field rules.
- **Scoped**: allowed only through ownership, relationship, or assignment rules.
- **Draft**: allowed only while the record is unposted/unissued and editable.
- **Action**: allowed only through a named domain action, never a generic update.
- **System**: emitted automatically as a consequence of an authorized operation.
- **No**: denied.

“Archive/delete” never authorizes hard deletion of Deals, Trips, Payments, Bills,
financial history, or AuditEvent records.

## 2. Resource/action matrix

### ADMIN

| Resource      | View                | Create              | Update                             | Archive/delete                | Upload              | Approve/verify                    | Configure                              |
| ------------- | ------------------- | ------------------- | ---------------------------------- | ----------------------------- | ------------------- | --------------------------------- | -------------------------------------- |
| Users         | Org                 | Org                 | Org, including activate/inactivate | Inactivate only               | No                  | Password reset and role changes   | Memberships and roles                  |
| Vendors       | Org                 | Org                 | Org                                | Archive action                | Related docs        | Verify identity/data              | No                                     |
| Transporters  | Org                 | Org                 | Org                                | Archive action                | Related docs        | Verify data                       | No                                     |
| Drivers       | Org                 | Org                 | Org                                | Archive action                | Related docs        | Verify identity/data              | Login linkage                          |
| Vehicles      | Org                 | Org                 | Org                                | Archive action                | Related docs        | Verify data                       | No                                     |
| Companies     | Org                 | Org                 | Org                                | Archive action                | Related docs        | Verify data                       | No                                     |
| Materials     | Org                 | Org                 | Org                                | Archive action                | No                  | Verify data                       | No                                     |
| Deals         | Org                 | Org                 | State/field rules                  | Lifecycle archive             | Related docs        | Activate/fulfil/cancel            | No                                     |
| Trips         | Org                 | Org                 | State/field rules                  | Lifecycle archive             | Related docs        | Corrections, delivery, settlement | No                                     |
| Payments      | Org                 | Org                 | Draft only                         | Never delete; reversal action | Receipt docs        | Post/allocate/reverse             | Payment modes only if later introduced |
| Documents     | Org by parent scope | Org by parent scope | Metadata before verification       | Retire link; retain versions  | Org by parent scope | Verify/reject document            | Document-type policy                   |
| Bills         | Org                 | Org                 | Draft only                         | Never delete; void/replace    | Bill docs           | Issue/void/replace                | Numbering policy                       |
| Custom Fields | Org                 | Org                 | Versioned update                   | Retire only after use         | No                  | Activate/retire version           | Org                                    |
| Activity      | Org                 | System              | No direct business edit            | Audited redaction only        | No                  | No                                | No                                     |
| Audit         | Org                 | System              | No                                 | No                            | No                  | Review/export                     | Retention/export policy                |
| Archive       | Org                 | No                  | Restore through action             | No hard delete                | No                  | Restore/exception action          | Retention policy                       |

### MEMBER

| Resource      | View                           | Create              | Update                        | Archive/delete                  | Upload              | Approve/verify                                   | Configure |
| ------------- | ------------------------------ | ------------------- | ----------------------------- | ------------------------------- | ------------------- | ------------------------------------------------ | --------- |
| Users         | Limited organization directory | No                  | Own non-security profile only | No                              | No                  | No                                               | No        |
| Vendors       | Org                            | Org                 | Org operational fields        | No                              | Related docs        | Verify operational data                          | No        |
| Transporters  | Org                            | Org                 | Org operational fields        | No                              | Related docs        | Verify operational data                          | No        |
| Drivers       | Org                            | Org                 | Org operational fields        | No                              | Related docs        | Verify operational data                          | No        |
| Vehicles      | Org                            | Org                 | Org operational fields        | No                              | Related docs        | Verify operational data                          | No        |
| Companies     | Org                            | Org                 | Org operational fields        | No                              | Related docs        | Verify operational data                          | No        |
| Materials     | Org                            | Org                 | Org operational fields        | No                              | No                  | Verify operational data                          | No        |
| Deals         | Org                            | Org                 | Draft/active allowed fields   | No                              | Related docs        | Activate and operational close if policy permits | No        |
| Trips         | Org                            | Org                 | Action/state/field rules      | No                              | Related docs        | Operational transitions through delivery         | No        |
| Payments      | Org financial view             | Draft               | Draft only                    | No                              | Receipt docs        | No post/reverse in baseline                      | No        |
| Documents     | Org by parent scope            | Org by parent scope | Own unverified metadata       | Retire own unverified link only | Org by parent scope | Verify if assigned by policy                     | No        |
| Bills         | Org financial view             | Draft               | Draft only                    | No                              | Bill docs           | No issue/void in baseline                        | No        |
| Custom Fields | Visible definitions/use        | No                  | Values when role/stage allows | No                              | No                  | No                                               | No        |
| Activity      | Org by resource visibility     | System              | No                            | No                              | No                  | No                                               | No        |
| Audit         | No raw audit in baseline       | System              | No                            | No                              | No                  | No                                               | No        |
| Archive       | Org records otherwise visible  | No                  | No                            | No                              | No                  | No                                               | No        |

### VENDOR

| Resource      | View                                                   | Create              | Update                                         | Archive/delete                               | Upload                          | Approve/verify                  | Configure |
| ------------- | ------------------------------------------------------ | ------------------- | ---------------------------------------------- | -------------------------------------------- | ------------------------------- | ------------------------------- | --------- |
| Users         | Own safe profile                                       | No                  | Own password through future secure action only | No                                           | No                              | No                              | No        |
| Vendors       | Scoped to linked Vendor                                | No                  | Limited own contact fields if enabled          | No                                           | Own Vendor docs                 | Submit changes for verification | No        |
| Transporters  | No list; assigned summary through Trip only            | No                  | No                                             | No                                           | No                              | No                              | No        |
| Drivers       | No list; assigned contact projection through Trip only | No                  | No                                             | No                                           | No                              | No                              | No        |
| Vehicles      | No list; assigned vehicle projection through Trip only | No                  | No                                             | No                                           | No                              | No                              | No        |
| Companies     | No                                                     | No                  | No                                             | No                                           | No                              | No                              | No        |
| Materials     | Scoped names on own Deals/Trips                        | No                  | No                                             | No                                           | No                              | No                              | No        |
| Deals         | Scoped to linked Vendor                                | No                  | No authoritative update                        | No                                           | Permitted Deal docs             | No                              | No        |
| Trips         | Scoped where Deal Vendor matches                       | No                  | No authoritative update                        | No                                           | Permitted loading/delivery docs | Optional acknowledgement only   | No        |
| Payments      | Scoped posted Vendor payments/allocations              | No                  | No                                             | No                                           | Own receipt/supporting docs     | No                              | No        |
| Documents     | Scoped through accessible parent                       | Scoped upload types | Own unverified metadata only                   | Withdraw unverified upload if policy permits | Scoped                          | No verification                 | No        |
| Bills         | No                                                     | No                  | No                                             | No                                           | No                              | No                              | No        |
| Custom Fields | Visible fields on accessible targets                   | No                  | Values only when role/stage allows             | No                                           | No                              | No                              | No        |
| Activity      | Scoped safe feed                                       | System              | No                                             | No                                           | No                              | No                              | No        |
| Audit         | No                                                     | System              | No                                             | No                                           | No                              | No                              | No        |
| Archive       | Scoped historical records if retention policy permits  | No                  | No                                             | No                                           | No                              | No                              | No        |

### DRIVER

| Resource      | View                                                 | Create              | Update                                         | Archive/delete                               | Upload                       | Approve/verify                       | Configure |
| ------------- | ---------------------------------------------------- | ------------------- | ---------------------------------------------- | -------------------------------------------- | ---------------------------- | ------------------------------------ | --------- |
| Users         | Own safe profile                                     | No                  | Own password through future secure action only | No                                           | No                           | No                                   | No        |
| Vendors       | No                                                   | No                  | No                                             | No                                           | No                           | No                                   | No        |
| Transporters  | Assigned Transporter projection only                 | No                  | No                                             | No                                           | No                           | No                                   | No        |
| Drivers       | Scoped to linked Driver                              | No                  | Limited own contact fields if enabled          | No                                           | Own Driver docs if enabled   | Submit changes for verification      | No        |
| Vehicles      | Currently/historically assigned projection           | No                  | No master-data update                          | No                                           | Assigned-Trip vehicle photos | Report issue only                    | No        |
| Companies     | Destination name/location on assigned Trip only      | No                  | No                                             | No                                           | No                           | No                                   | No        |
| Materials     | Material name/handling detail on assigned Trip only  | No                  | No                                             | No                                           | No                           | No                                   | No        |
| Deals         | No Deal resource; minimal context through Trip       | No                  | No                                             | No                                           | No                           | No                                   | No        |
| Trips         | Scoped by active/permitted historical TripAssignment | No                  | Permitted stage actions/fields only            | No                                           | Assigned Trip evidence       | Confirm pickup/delivery actions only | No        |
| Payments      | No                                                   | No                  | No                                             | No                                           | No                           | No                                   | No        |
| Documents     | Scoped operational types on assigned Trips           | Scoped upload types | Own unverified metadata only                   | Withdraw unverified upload if policy permits | Scoped                       | No verification                      | No        |
| Bills         | No                                                   | No                  | No                                             | No                                           | No                           | No                                   | No        |
| Custom Fields | Driver-visible fields on assigned Trips/own Driver   | No                  | Values only when role/stage allows             | No                                           | No                           | No                                   | No        |
| Activity      | Scoped safe assigned-Trip feed                       | System              | No                                             | No                                           | No                           | No                                   | No        |
| Audit         | No                                                   | System              | No                                             | No                                           | No                           | No                                   | No        |
| Archive       | Permitted historical assigned Trips only             | No                  | No                                             | No                                           | No                           | No                                   | No        |

## 3. Ownership and assignment rules

### Common organization scope

Every protected operation must derive the principal from a server-trusted
session and load its active membership. The authorization predicate begins with:

```text
session is valid
AND user is ACTIVE
AND membership is ACTIVE
AND resource.organizationId = membership.organizationId
```

The server loads resource organization from the database. A parsed client UUID
is only well-formed input; it is not evidence of membership or access.

### ADMIN scope

- All resources in the active Organization.
- Cross-organization access is denied even to Admin. A future platform operator
  would be a different capability, not an overloaded Organization Admin role.
- Admin operations remain subject to lifecycle and immutable-history rules.

### MEMBER scope

- Baseline assumption: all operational resources in the active Organization.
- If assigned-only Member scope is later required, add an explicit policy or
  assignment relation; do not infer access merely from `created_by`.
- Ownership controls responsibility and filtering, not exclusive visibility,
  under the shared-team model.

### VENDOR scope

Access requires:

1. `vendor.user_id = session.user_id`.
2. Vendor and membership share Organization.
3. Membership role is `VENDOR` and active.

Derived scopes:

- Deal: `deal.vendor_id = linked_vendor.id`.
- Trip: `trip.deal.vendor_id = linked_vendor.id`.
- Vendor Payment: Payment counterparty is linked Vendor; allocations are filtered
  again to own Deal/Trip.
- Document: at least one attachment targets the linked Vendor or a Deal/Trip/
  Payment already authorized to that Vendor, and document type is permitted.
- Activity/archive: target resource independently passes Vendor scope.

Linking a Document to both an allowed and forbidden resource must not broaden
access. The response projection must be safe for every visible attachment or
must expose only the authorized attachment context.

### DRIVER scope

Access requires:

1. `driver.user_id = session.user_id`.
2. Driver and membership share Organization.
3. Membership role is `DRIVER` and active.

Trip scope is proven by `TripAssignment`, not by a client-supplied Driver ID:

- Current access: an open assignment exists for Driver and Trip.
- Historical access: a closed assignment exists and the configured retention/
  operational policy permits access.
- Reassignment closes the old temporal row; it does not erase assignment history.
- Driver mutations require an active assignment at mutation time unless a
  narrowly defined historical-upload grace period is approved.

Vehicle and Transporter visibility is a projection through an authorized Trip
assignment, not permission to browse those master-data resources.

### Relationship changes

- Linking/unlinking Vendor or Driver User accounts is Admin-only, audited, and
  revokes affected sessions.
- Reassigning a Trip closes the previous TripAssignment and inserts another in
  one transaction. The old Driver immediately loses current mutation rights.
- Role, membership status, or password changes revoke/rotate sessions in the same
  transaction as their audit event.

## 4. Field-level visibility rules

Resource authorization does not imply every database column is visible. Server
services return role-specific projections; they never serialize ORM/database
rows directly.

| Field group                                | ADMIN                             | MEMBER                         | VENDOR                                       | DRIVER                                                                                                        |
| ------------------------------------------ | --------------------------------- | ------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Password hash, session token hash, secrets | Never returned                    | Never returned                 | Never returned                               | Never returned                                                                                                |
| User phone/status                          | Org                               | Operational need               | Own only                                     | Own only                                                                                                      |
| Vendor contact data                        | Org                               | Org                            | Own                                          | No, except safe pickup contact if explicitly needed                                                           |
| Driver phone/licence data                  | Org                               | Org                            | Only assigned safe contact if policy permits | Own                                                                                                           |
| Deal purchase rate                         | Org                               | Org                            | Own Deal rate                                | No                                                                                                            |
| Loaded/final/accepted weights              | Org                               | Org                            | Own Deal Trips                               | Assigned Trip loaded/final values needed operationally; accepted settlement weight optional/hidden by default |
| Vendor purchase amount/balance/payments    | Org                               | Org                            | Own posted values                            | No                                                                                                            |
| Transporter payment/cost                   | Org                               | Org                            | No                                           | No                                                                                                            |
| Company billed amount/receipts/outstanding | Org                               | Org                            | No                                           | No                                                                                                            |
| Sale revenue and profit/margin             | Org                               | Org if explicitly part of role | No                                           | No                                                                                                            |
| Bill number/document                       | Org                               | Org                            | No                                           | No                                                                                                            |
| Delivery challan/weighment card            | Org                               | Org                            | Own Deal Trips                               | Assigned Trips                                                                                                |
| Internal notes                             | Org                               | Org                            | No unless explicitly vendor-visible field    | No unless explicitly driver-visible field                                                                     |
| Audit before/after and request metadata    | Org                               | No raw access in baseline      | No                                           | No                                                                                                            |
| Activity message                           | Org                               | Org scope                      | Sanitized own-resource feed                  | Sanitized assigned-Trip feed                                                                                  |
| Custom fields                              | By definition plus Admin override | Role/stage configuration       | Role/stage configuration within own scope    | Role/stage configuration within assignment scope                                                              |

Hard visibility ceilings override configurable custom-field visibility. A custom
field or Document link cannot be configured to expose Company receivables,
margin, other Vendors, password/session data, or unrelated Trip data to Vendor
or Driver roles.

### Mutation field allowlists

- Generic object spreading from client input into database updates is forbidden.
- Every action validates a named input DTO/schema and maps an explicit field
  allowlist.
- Vendor/Driver profile edits, if enabled, are limited to approved contact fields;
  role/status/user linkage remains Admin-only.
- Driver Trip actions may set only action-specific fields, such as upload
  evidence, challan data, or timestamps allowed at that stage. They cannot set
  status directly; the action computes the valid transition.
- Once a Trip passes a field's lock stage, correction uses a separate elevated
  action with reason, optimistic version, and audit.

## 5. Sensitive financial permissions

Financial capabilities are distinct even when they eventually map to one role:

| Capability                      | ADMIN           | MEMBER baseline                                | VENDOR                     | DRIVER |
| ------------------------------- | --------------- | ---------------------------------------------- | -------------------------- | ------ |
| View organization financials    | Yes             | Yes                                            | Own Vendor projection only | No     |
| Record Payment draft            | Yes             | Yes                                            | No                         | No     |
| Post Payment                    | Yes             | No pending product decision                    | No                         | No     |
| Allocate Payment                | Yes             | Draft proposal only                            | No                         | No     |
| Reverse/adjust Payment          | Yes with reason | No pending product decision                    | No                         | No     |
| Create Bill draft               | Yes             | Yes                                            | No                         | No     |
| Issue/void/replace Bill         | Yes             | No pending product decision                    | No                         | No     |
| Determine accepted final weight | Yes             | Propose/record if policy allows                | No                         | No     |
| Post/reverse Trip settlement    | Yes             | No pending product decision                    | No                         | No     |
| View sale margin                | Yes             | Yes only if confirmed as Member responsibility | No                         | No     |

Rules:

- Posted Payments, allocations, issued Bills, BillLines, and settlement snapshots
  are immutable.
- Reversal/adjustment/void actions reference the original, require reason, use
  idempotency keys where applicable, and insert AuditEvent in the same transaction.
- Balances are derived from posted records; no role may edit a balance field.
- Vendor-facing results are filtered by linked Vendor and exclude Company revenue
  and margin even if those values were used server-side.
- Financial responses should default to `Cache-Control: no-store` or an
  identity-safe private policy; they must never use shared public caching.

The Member approval split is deliberately conservative and remains a product
decision. Do not silently broaden it during implementation.

## 6. Audit and admin permissions

### Audit creation

- Users never call a generic “create audit event” endpoint.
- Authorized domain services generate audit rows as part of the same transaction
  as sensitive writes.
- Direct business-table maintenance outside those services is prohibited for the
  runtime database role.
- Audit values use an allowlist and redact credentials, session identifiers,
  secrets, and file bodies.

### Audit reading

- Admin can query AuditEvents for its active Organization and export them through
  a separately authorized action.
- Member receives ActivityEvent history, not raw audit before/after or request
  metadata, in the baseline policy.
- Vendor and Driver receive sanitized ActivityEvent projections for authorized
  resources, never AuditEvent rows.
- Cross-organization audit access is denied.

### Audit mutation

- No application role, including Admin, may update/delete/truncate AuditEvent.
- Runtime database privileges and database triggers provide append-only defense.
- Exceptional legal retention/purge operations, if ever required, use a separate
  operational role and produce external evidence; they are not normal app actions.

### Administrative actions that always audit

- User creation/inactivation and phone change.
- Password reset.
- Membership role/status change.
- Vendor/Driver login linkage change.
- Archive/restore.
- Post/reverse/adjust Payment.
- Issue/void/replace Bill.
- Settlement post/reversal.
- Post-dispatch Trip assignment, weight, challan, weighment, or timestamp correction.
- Custom-field configuration activation/retirement.
- Document verification/rejection/redaction.

## 7. Server authorization principles

TanStack Start route guards improve navigation but do not protect data endpoints.
Every server function/server route must enforce authorization inside its handler
or server middleware.

### Required decision sequence

For every non-public server operation:

1. Authenticate the opaque session token from a secure server-side cookie.
2. Load a nonexpired, nonrevoked Session from the database.
3. Load active User and active OrganizationMembership from trusted Session data.
4. Validate input shape. Treat every client ID and field as untrusted.
5. Load the target using both `organization_id` and resource ID.
6. Check role plus ownership/relationship/assignment scope.
7. Check field-level visibility or mutation allowlist.
8. Check current lifecycle state, invariant guards, and optimistic `version`.
9. Execute the business write, history row, derived notifications/activity, and
   AuditEvent in one transaction.
10. Return an explicit role-safe projection, never a raw database row.

### Error and enumeration behavior

- For scoped Vendor/Driver resources, prefer a uniform not-found response when
  revealing existence would leak other-party data.
- Login errors do not reveal whether a phone exists; password verification uses
  timing-resistant handling including a dummy hash for unknown users.
- Admin-controlled reset never exposes stored hashes and revokes all sessions.
- Rate-limit login and administrative reset attempts.

### Session and request security

- Store only a hash of the session token in PostgreSQL.
- Cookie is `HttpOnly`, `Secure`, finite-lived, `SameSite`, and preferably uses
  the `__Host-` prefix.
- Mutations use non-GET methods and CSRF/same-origin protection.
- Read cookies, secrets, and environment values only inside per-request server
  boundaries, never at module scope or in client code.
- Revalidate membership/resource scope on each sensitive operation; do not trust
  stale role claims embedded in the browser.
- Rotate/revoke sessions on password, role, membership, or login-link change.

### Concurrency and authorization

- Authorization and state checks occur inside the same transaction as mutation
  when a concurrent change could invalidate access.
- Trip reassignment locks the Trip/current assignment so the former Driver cannot
  race an update after reassignment.
- Financial post/allocation/reversal locks the authoritative Payment/Bill/Trip
  rows and rechecks organization/counterparty scope.
- Optimistic version conflicts return a conflict; the server never applies a
  stale write over a newer authorized change.

### Database defense in depth

- Composite organization foreign keys prevent cross-tenant relationships.
- The runtime database role receives least privilege.
- PostgreSQL RLS may later enforce organization filters and selected ownership
  policies, but service-layer authorization remains mandatory because table
  owners/superusers can bypass ordinary RLS and complex field/action rules do not
  belong solely in policies.
- Audit tables receive append-only privileges and rejection triggers.

### Authorization tests required during implementation

For every sensitive server operation, test at least:

- Anonymous request is rejected.
- Inactive/revoked session is rejected.
- Wrong Organization is rejected.
- Correct role with unrelated resource is rejected.
- Vendor cannot access another Vendor's resource.
- Driver cannot access an unassigned or no-longer-permitted Trip.
- Forbidden fields never appear in response serialization.
- Forbidden fields are ignored/rejected rather than mass-assigned.
- Invalid lifecycle transition is rejected.
- Stale version is rejected without partial mutation.
- Successful mutation and AuditEvent commit together; forced audit failure rolls
  back the business mutation.

## Product decisions still required

1. Whether Members may post/reverse Payments, settle Trips, and issue/void Bills,
   or whether these remain Admin-only approvals.
2. Whether Members see sale margin by default.
3. Whether Vendors see line-level purchase rates/allocations or summary values
   only. This matrix assumes own detailed values without Company revenue/margin.
4. Which Driver stage actions are permitted: accept assignment, start loading,
   confirm loaded, dispatch, and/or confirm delivery.
5. Historical Driver Trip access duration and any post-delivery document-upload
   grace period.
6. Whether Vendor/Driver users may edit limited contact fields directly or only
   submit changes for Member/Admin verification.
7. Whether future Members need assigned-only scope instead of organization-wide
   operational visibility.

Until these decisions are made, implementation must use the conservative
baseline in this document and must not infer broader rights from UI visibility.
