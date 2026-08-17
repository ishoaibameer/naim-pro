# Incident Runbook

For every incident: name an incident commander, record start time and request/correlation IDs, preserve evidence, restrict communications to approved channels, and avoid copying secrets or document/financial payloads into tickets.

## Database unavailable

Confirm `/health/ready` failure, provider status, connection limits, and credentials. Pause mutations, keep liveness running if useful, fail over/restore only with approval, then reconcile writes and sessions.

## Object storage unavailable

Disable or communicate upload/download degradation. Do not switch production to ephemeral local storage. Verify bucket policy, credentials, endpoint, and provider status; reconcile incomplete/orphaned objects after recovery.

## Login outage

Check database readiness, session-secret availability, cookie/HTTPS/origin settings, trusted proxy mode, and rate-limit failure counts. Do not weaken generic errors, Secure cookies, or throttling as a workaround.

## Suspected credential leak

Revoke/rotate the affected database, storage, session, or platform credential immediately. For session-secret exposure, rotate it and revoke all active sessions. Search sanitized logs and deployment history, preserve evidence, and assess required notifications.

## Compromised user

Deactivate the user/membership, increment security version or reset password through the secure Admin path, revoke all sessions, review activity/audit history, and investigate affected resources.

## Bad deployment

Stop rollout, retain the failing image and logs, roll back to the last known-good immutable image, verify health/auth/mutations, and keep forward-compatible database changes in place.

## Failed migration

Do not rerun blindly. Capture the exact migration and database state, prevent dependent application activation, restore from the verified pre-migration backup if integrity is uncertain, and produce a new forward migration after review.

## Document access incident

Disable the affected download/upload path or credentials, identify organization/user/request IDs, inspect authorization and bucket access logs without exposing content, rotate storage credentials, and determine whether document notification obligations apply.

Escalation contacts and provider support identifiers must be filled in the go-live checklist; they are not known in this repository.
