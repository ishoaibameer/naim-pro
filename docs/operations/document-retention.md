# Document Retention and Storage Operations

No automatic destructive cleanup is enabled. Retired documents and superseded versions remain retained.

Initial retention posture:

- Payment receipts and Bills: retain with the associated financial record and applicable statutory/business retention period.
- Weighbridge slips and delivery evidence: retain with the Trip and immutable settlement history.
- Trip/loading evidence and vehicle photos: retain all versions; a replacement does not delete prior evidence.
- Permits and supporting documents: retain while operationally or legally relevant, then retire through an explicit audited policy in a future release.

Future garbage collection must reconcile database references, retention/legal holds, object checksums, and an approved deletion manifest. It remains disabled until those controls and a recovery window exist.

## Upload and storage recovery

- Application upload requests are capped at 16 MB; images at 10 MB and PDFs at 15 MB.
- A failed database transaction attempts to delete the newly written object.
- If object deletion fails, record the request ID and object-key metadata for later reconciliation; never expose the key publicly.
- Retry only idempotent reads. A user upload retry creates a new opaque key and database transaction.
- On storage outage, disable uploads if necessary, preserve database integrity, and restore service before retrying.
- Periodically compare object inventory with `document_versions.storage_key` to identify missing or orphaned objects. Do not delete identified orphans automatically.

Malware scanning is not currently configured. The integration boundary supports fail-closed required mode, but there are no `PENDING_SCAN`/`REJECTED` database states because adding them would destabilize the current active-document workflow. This is an explicit go-live risk decision.
