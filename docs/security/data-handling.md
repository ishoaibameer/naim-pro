# Data Handling

## Data categories

| Category | Examples | Authorized access | Logging/export rules |
| --- | --- | --- | --- |
| Personal | Names, phones, driver identity and assignments | Admin; operational users where required; Vendor/Driver only within owned/assigned records | Never log passwords, phone-based credentials, session data, or full profiles. Restrict exports by role and organization. |
| Financial | Payments, Bills, allocations, receivables, settlement snapshots | Admin and authorized Members; Vendors only their permitted payment view; Drivers no internal finance | Do not send detailed values to generic error monitoring. Exports are private, bounded, and audited operationally. |
| Operational | Deals, Trips, vehicles, weights, locations | Admin/Member; Vendor owns its business records; Driver assigned Trips | Correlation logs may include entity IDs, never confidential form/document payloads. |
| Documents | Receipts, permits, weighment slips, photos, Bills | Server-authorized by role, organization, ownership/assignment, and target | Private storage only. No public URLs, body logging, or content telemetry. Preserve checksums and versions. |

Core financial, Deal, Trip, and audit records are not hard-deleted. Retention periods must be approved against Indian statutory, contractual, and privacy obligations before automated deletion exists. Data-subject/export requests require authorization, minimization, a recorded purpose, and secure delivery.

Production logs contain request IDs, route, status, duration, and appropriate internal actor/organization identifiers. The logger redacts sensitive key names and known credential/hash patterns. Access to logs and exports must be limited and retention configured at the provider.
