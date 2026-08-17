# NAIM PRO MVP Manual QA Checklist

Record the browser, viewport, test account, and result notes for each run. Use organization-separated test data for authorization checks.

## Authentication

- [ ] Sign in with valid Admin, Member, Vendor, and Driver credentials.
- [ ] Reject an invalid phone/password without revealing which credential failed.
- [ ] Confirm signed-out users are redirected from protected URLs.
- [ ] Sign out, then confirm the revoked session cannot access a protected URL.
- [ ] Confirm inactive users or memberships cannot authenticate.

## Admin

- [ ] Dashboard shows operations, finance, master-data, and system-attention summaries.
- [ ] Quick actions open Add Member, Add Vendor, Add Driver, Create Deal, and Create Payment.
- [ ] Create and edit each master record with validation and duplicate checks.
- [ ] Update organization name, warning threshold, transit hours, and page size.
- [ ] Confirm metric ton and INR settings remain fixed and read-only.
- [ ] Confirm a stale settings form receives a concurrency error.

## Member

- [ ] Dashboard shows current operations, pending money, attention items, and limited recent activity.
- [ ] Member can use authorized operational and shared-finance workflows.
- [ ] Member cannot open Admin routes by navigation or direct URL.
- [ ] Activity filters work for actor, type, date, and entity.

## Vendor

- [ ] Vendor sees only its own loads, payments, and documents.
- [ ] Vendor cannot see internal reports, other vendors, internal margins, or Admin/Member navigation.
- [ ] Vendor can perform only the permitted document actions.
- [ ] Direct URLs for another vendor's records are denied.

## Driver

- [ ] Driver sees only assigned trips, allowed check-ins, expenses, and documents.
- [ ] Driver cannot see reports, internal finance, unassigned trips, or Admin/Member navigation.
- [ ] Check-in and expense actions enforce current trip/state rules.
- [ ] Direct URLs for an unassigned trip are denied.

## Deal

- [ ] Create a Deal with Vendor, Company, pickup, destination, rate, and expected quantity.
- [ ] Deal detail shows active, completed, cancelled Trips and delivered quantity.
- [ ] Close Deal explains blockers and never auto-closes solely from expected quantity.
- [ ] Closed Deals cannot receive unauthorized mutations.

## Trip

- [ ] Create multiple Trips under one Deal and assign truck/driver correctly.
- [ ] Lifecycle permits only CREATED → TRUCK_ASSIGNED → LOADING → LOADED → IN_TRANSIT → DELIVERED.
- [ ] Skipped, reversed, and invalid cancellation transitions are rejected server-side.
- [ ] A Trip exceeding expected transit hours shows DELAYED as an attention flag, not a status.
- [ ] Long vehicle, Vendor, and Company names wrap or truncate without horizontal overflow.

## Loading

- [ ] Start loading, enter exact metric-ton weight, and confirm loading.
- [ ] Required inputs show accessible validation messages.
- [ ] Repeated submission is disabled while the action is pending.
- [ ] Loading photos/documents show progress and a useful empty state.

## Delivery

- [ ] Confirm Delivery Challan Number, vehicle, final weight, and weighment card number.
- [ ] Weight difference and percentage match server calculations.
- [ ] Threshold violations are highlighted with text/icon as well as color.
- [ ] Delivery is clearly labeled as operational completion while finance may remain pending.

## Payments

- [ ] Record Vendor, Transporter, and Company payments with the correct direction/type.
- [ ] Allocation totals cannot exceed the payment or payable/receivable balance.
- [ ] Receipt documents remain linked and downloadable only by authorized roles.
- [ ] Reversal preserves the original financial record and audit history.

## Bills

- [ ] Create and issue a Company bill with correct Trip lines and INR totals.
- [ ] Void flow requires authorization and preserves the original bill.
- [ ] Company report excludes void bills from billed/receivable totals.

## Settlement

- [ ] Settlement summary shows Vendor pending, Transporter pending, and Company receivable separately.
- [ ] Current policy blocks SETTLED until all three balances are zero.
- [ ] Settlement and archive actions are Admin-only and audited.
- [ ] UI explains operational delivery versus financial settlement.

## Archive

- [ ] Archive shows Trip, vehicle, Vendor → Company, final weight, settlement summary, and archived date.
- [ ] Search and every archive filter work together.
- [ ] No mutation action appears on the Archive page.
- [ ] Direct mutation attempts against archived financial/Trip records are rejected.

## Documents

- [ ] Upload every allowed file type and reject disallowed MIME, extension, or oversized files.
- [ ] Long filenames remain usable at mobile widths.
- [ ] Version upload preserves prior document versions.
- [ ] Download authorization is enforced by role, organization, ownership, and assignment.

## Form Builder

- [ ] Admin creates, versions, reorders, activates, and retires a custom-field definition.
- [ ] Required, visibility, and edit-role rules are enforced server-side.
- [ ] Core relationships cannot be replaced with generic custom fields.
- [ ] Historical values remain readable after a definition version changes.

## Reports

- [ ] Admin and Member can open all six reports; Vendor and Driver receive access denied.
- [ ] Trip report filters date, status, Vendor, vehicle, driver, Transporter, Company, pickup, and destination.
- [ ] Vendor, Transporter, and Company report totals reconcile with source records.
- [ ] Payment report filters party, direction, type, date, and member.
- [ ] Weight report minimum percentage and threshold highlighting work.
- [ ] CSV export matches visible filters, remains bounded, escapes cells, and exposes no hidden role data.

## Notifications

- [ ] Weight issue, delay, payment, delivery, document, and settlement events appear for scoped recipients.
- [ ] Unread/read tabs and mark-one/mark-all actions work.
- [ ] A user cannot read or mutate another user's notification by direct request.
- [ ] Duplicate delayed notifications are not created on refresh.

## Mobile layouts

- [ ] Test critical screens at 360 px, 390 px, 430 px, 768 px, and desktop widths.
- [ ] Confirm no page-level horizontal overflow or inaccessible dense tables.
- [ ] Buttons remain reachable, labels remain associated, and dialogs retain keyboard focus.
- [ ] Large INR values, weights, names, and filenames wrap safely.
- [ ] Role navigation remains usable by touch and exposes no irrelevant items.

## Authorization and direct URL attempts

- [ ] Repeat protected report, search, notification, Admin, Vendor, and Driver URLs with every role.
- [ ] Change record IDs to another organization and confirm Not Found/Access Denied without data leakage.
- [ ] Attempt CSV export directly while signed out and as Vendor/Driver.
- [ ] Attempt stale-version, duplicate-submit, and cross-organization mutations.
- [ ] Confirm user-facing errors never expose SQL, stack traces, hashes, tokens, or secrets.
