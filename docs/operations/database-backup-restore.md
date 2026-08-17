# Database Backup and Restore

## Required production posture

NAIM PRO requires a separate encrypted PostgreSQL production database, a least-privilege runtime role, and a separately controlled migration role. Provider backups have not been verified for this repository; go-live must remain blocked until an operator records evidence from the selected provider.

Minimum provider configuration:

- Automatic backups and point-in-time recovery where supported.
- At least 30 days of recoverable history for the MVP, reviewed against contractual requirements.
- A backup before every risky schema or bulk-data change.
- Encrypted backup storage in a separate failure domain where the provider permits it.
- Quarterly restore drills into an isolated non-production database.

The runtime role should have DML and sequence access only. It must not own schemas, create extensions, or alter/drop tables. The migration role owns schema changes. Both roles require TLS and independently rotated credentials.

## Backup verification checklist

- [ ] Provider dashboard/API confirms automatic backups are enabled.
- [ ] Point-in-time recovery window and retention are recorded.
- [ ] Latest successful backup time is within the expected interval.
- [ ] Backup encryption and access-control settings are verified.
- [ ] Backup alerts have an assigned recipient.
- [ ] A restore drill date and evidence link are recorded.
- [ ] `audit_events` immutability triggers exist in the restored database.

## Restore checklist

- [ ] Declare the incident owner and freeze application writes if required.
- [ ] Select a recovery timestamp before the damaging event.
- [ ] Restore into a new isolated database; never overwrite production first.
- [ ] Run `pnpm db:preflight` against the restored database using the migration role.
- [ ] Verify migration journal, table counts, organization isolation, and critical financial totals.
- [ ] Verify authentication, sessions, documents metadata, and audit immutability.
- [ ] Point staging at the restored database and execute smoke/E2E checks.
- [ ] Rotate credentials before production cutover.
- [ ] Change the production connection atomically, then verify `/health/ready`.
- [ ] Preserve the old database read-only until incident closure.

## Incident scenario: accidental financial mutation

1. Stop the affected mutation path and preserve logs/request IDs.
2. Identify the last known-good timestamp from audit events and operational evidence.
3. Restore to an isolated database at that timestamp.
4. Compare affected Payments, Bills, allocations, settlements, and audits with production.
5. Prefer an explicit compensating entry when the authoritative record can be repaired safely. Use full database cutover only when corruption is broad or integrity cannot be re-established.
6. Obtain business and technical approval, execute the selected recovery, and document all reconciliations.

Never run destructive restore commands automatically from CI.
