# NAIM PRO staging acceptance results

Date: 2026-08-17  
Environment: local Windows host, production Nitro build on `127.0.0.1:3100`, isolated Neon PostgreSQL database  
Browsers: Playwright Chromium, Pixel 5 emulation and Desktop Chrome  
Accounts: isolated ADMIN, MEMBER, VENDOR, and DRIVER fixtures

`PASS` means the item was exercised with direct browser or database-backed acceptance evidence. `BLOCKED` means the complete manual interaction was not executed; passing service-level coverage is called out but is not substituted for manual evidence. No item is marked PASS by inference.

## Authentication

- PASS — Sign in with valid Admin, Member, Vendor, and Driver credentials. Playwright covered both viewports.
- PASS — Reject an invalid phone/password without revealing which credential failed. Browser displayed the generic credential error.
- PASS — Confirm signed-out users are redirected from protected URLs. Playwright covered `/app/reports`.
- PASS — Sign out, then confirm the revoked session cannot access a protected URL. Database-backed auth acceptance validated create, validate, revoke, and reject.
- BLOCKED — Confirm inactive users or memberships cannot authenticate. Existing policy tests pass; not manually exercised.

## Admin

- PASS — Dashboard shows operations, finance, master-data, and system-attention summaries. Built-app Playwright reached the rendered Dashboard after its three real loaders completed.
- BLOCKED — Quick actions open Add Member, Add Vendor, Add Driver, Create Deal, and Create Payment.
- BLOCKED — Create and edit each master record with validation and duplicate checks. Database-backed creation passed; browser forms were not all exercised.
- BLOCKED — Update organization name, warning threshold, transit hours, and page size. Database-backed persistence passed; browser form was not exercised.
- BLOCKED — Confirm metric ton and INR settings remain fixed and read-only.
- BLOCKED — Confirm a stale settings form receives a concurrency error.

## Member

- BLOCKED — Dashboard shows current operations, pending money, attention items, and limited recent activity.
- BLOCKED — Member can use authorized operational and shared-finance workflows. Service workflow passed; browser workflow was not completed.
- PASS — Member cannot open Admin routes by navigation or direct URL. Playwright verified direct `/admin` denial in both viewports.
- BLOCKED — Activity filters work for actor, type, date, and entity.

## Vendor

- BLOCKED — Vendor sees only its own loads, payments, and documents. Service isolation passed; full browser inspection was not completed.
- PASS — Vendor cannot open internal reports or Member/Admin navigation. Playwright verified direct report denial and the role home in both viewports; detailed margin inspection remains covered by server authorization.
- BLOCKED — Vendor can perform only the permitted document actions. Service authorization passed; browser upload was not completed.
- BLOCKED — Direct URLs for another vendor's records are denied. Service denial passed; direct browser record-ID substitution was not completed.

## Driver

- BLOCKED — Driver sees only assigned trips, allowed check-ins, expenses, and documents. Service isolation passed; full browser inspection was not completed.
- PASS — Driver cannot open reports/internal finance or Admin/Member navigation. Playwright verified direct payment-page denial and role home in both viewports.
- BLOCKED — Check-in and expense actions enforce current trip/state rules. Database-backed service actions passed; browser actions were not completed.
- BLOCKED — Direct URLs for an unassigned trip are denied. Service denial passed; direct browser record-ID substitution was not completed.

## Deal

- BLOCKED — Create a Deal with Vendor, Company, pickup, destination, rate, and expected quantity. Database-backed creation passed; browser form was not completed.
- BLOCKED — Deal detail shows active, completed, cancelled Trips and delivered quantity.
- BLOCKED — Close Deal explains blockers and never auto-closes solely from expected quantity.
- BLOCKED — Closed Deals cannot receive unauthorized mutations.

## Trip

- BLOCKED — Create multiple Trips under one Deal and assign truck/driver correctly. Database-backed creation passed; browser flow was not completed.
- PASS — Lifecycle permits only CREATED → TRUCK_ASSIGNED → LOADING → LOADED → IN_TRANSIT → DELIVERED. Database-backed explicit action flow passed.
- PASS — Skipped, reversed, and invalid cancellation transitions are rejected server-side. Domain tests pass.
- BLOCKED — A Trip exceeding expected transit hours shows DELAYED as an attention flag, not a status.
- BLOCKED — Long vehicle, Vendor, and Company names wrap or truncate without horizontal overflow.

## Loading

- BLOCKED — Start loading, enter exact metric-ton weight, and confirm loading. Database-backed flow passed; browser action was not completed.
- BLOCKED — Required inputs show accessible validation messages.
- BLOCKED — Repeated submission is disabled while the action is pending.
- BLOCKED — Loading photos/documents show progress and a useful empty state.

## Delivery

- BLOCKED — Confirm Delivery Challan Number, vehicle, final weight, and weighment card number. Database-backed flow passed; browser action was not completed.
- PASS — Weight difference and percentage match server calculations. Deterministic PostgreSQL fixture reconciled 10.000 MT loaded, 9.500 MT final, and 0.500 MT difference.
- BLOCKED — Threshold violations are highlighted with text/icon as well as color.
- BLOCKED — Delivery is clearly labeled as operational completion while finance may remain pending.

## Payments

- BLOCKED — Record Vendor, Transporter, and Company payments with the correct direction/type. Database-backed workflow passed; browser forms were not completed.
- PASS — Allocation totals cannot exceed the payment or payable/receivable balance. Finance policy tests pass.
- BLOCKED — Receipt documents remain linked and downloadable only by authorized roles.
- PASS — Reversal preserves the original financial record and audit history. PostgreSQL acceptance verified reversal rather than deletion.

## Bills

- BLOCKED — Create and issue a Company bill with correct Trip lines and INR totals. Database-backed workflow passed; browser flow was not completed.
- BLOCKED — Void flow requires authorization and preserves the original bill.
- PASS — Company report excludes void bills from billed/receivable totals. Report/domain test coverage passes.

## Settlement

- PASS — Settlement summary shows Vendor pending, Transporter pending, and Company receivable separately. Deterministic service-level reconciliation passed.
- PASS — Current policy blocks SETTLED until all three balances are zero. PostgreSQL acceptance verified a blocker then successful zero-balance settlement.
- PASS — Settlement and archive actions are Admin-only and audited. Service authorization and audit rows were verified.
- BLOCKED — UI explains operational delivery versus financial settlement.

## Archive

- BLOCKED — Archive shows Trip, vehicle, Vendor → Company, final weight, settlement summary, and archived date.
- BLOCKED — Search and every archive filter work together.
- BLOCKED — No mutation action appears on the Archive page.
- PASS — Direct mutation attempts against archived financial/Trip records are rejected. Domain policies pass.

## Documents

- PASS — Upload allowed image/PDF content and reject disallowed MIME, extension, or oversized content. Validation tests and database-backed PNG/PDF acceptance pass.
- BLOCKED — Long filenames remain usable at mobile widths.
- PASS — Version upload preserves prior document versions. Vehicle-photo supersession retained two version rows and served the current checksum-backed object.
- PASS — Download authorization is enforced by role, organization, ownership, and assignment. Cross-vendor access was denied in the PostgreSQL suite.

## Form Builder

- BLOCKED — Admin creates, versions, reorders, activates, and retires a custom-field definition. Creation/version persistence passed; complete browser lifecycle was not exercised.
- PASS — Required, visibility, and edit-role rules are enforced server-side. Policy tests pass.
- PASS — Core relationships cannot be replaced with generic custom fields. Schema/domain design remains relational.
- PASS — Historical values remain readable after a definition version changes. PostgreSQL acceptance verified a value after version 2.

## Reports

- PASS — Admin and Member can open all six reports; Vendor and Driver receive access denied. Server authorization tests pass; browser role denial was additionally checked for Vendor/Driver.
- BLOCKED — Trip report filters date, status, Vendor, vehicle, driver, Transporter, Company, pickup, and destination.
- PASS — Vendor, Transporter, and Company report totals reconcile with source records. Deterministic PostgreSQL assertions passed.
- BLOCKED — Payment report filters party, direction, type, date, and member.
- BLOCKED — Weight report minimum percentage and threshold highlighting work. Deterministic totals passed; browser highlighting/filter interaction was not exercised.
- BLOCKED — CSV export matches visible filters, remains bounded, escapes cells, and exposes no hidden role data.

## Notifications

- BLOCKED — Weight issue, delay, payment, delivery, document, and settlement events appear for scoped recipients.
- BLOCKED — Unread/read tabs and mark-one/mark-all actions work.
- PASS — A user cannot read or mutate another user's notification by direct request. Server authorization tests pass.
- BLOCKED — Duplicate delayed notifications are not created on refresh.

## Mobile layouts

- BLOCKED — Test critical screens at 360 px, 390 px, 430 px, 768 px, and desktop widths. Pixel 5 and desktop auth/route coverage passed, but all required widths and screens were not exercised.
- BLOCKED — Confirm no page-level horizontal overflow or inaccessible dense tables.
- BLOCKED — Buttons remain reachable, labels remain associated, and dialogs retain keyboard focus.
- BLOCKED — Large INR values, weights, names, and filenames wrap safely.
- BLOCKED — Role navigation remains usable by touch and exposes no irrelevant items. Role homes passed on Pixel 5, but complete navigation was not manually inspected.

## Authorization and direct URL attempts

- BLOCKED — Repeat protected report, search, notification, Admin, Vendor, and Driver URLs with every role. Representative Admin/report/payment routes passed; the full matrix was not executed.
- BLOCKED — Change record IDs to another organization and confirm Not Found/Access Denied without data leakage. PostgreSQL service isolation passed; browser substitutions were not completed.
- BLOCKED — Attempt CSV export directly while signed out and as Vendor/Driver.
- PASS — Attempt stale-version, duplicate-submit, and cross-organization mutations. Optimistic concurrency and cross-organization rollback passed in PostgreSQL.
- PASS — Confirm user-facing errors never expose SQL, stack traces, hashes, tokens, or secrets. Browser errors were generic and the secret scan is part of final validation.
