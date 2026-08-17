# Performance and Capacity Review

## Current findings

- List routes are paginated and report exports are capped at 1,000 rows.
- Global search is bounded and organization-scoped, but leading-wildcard `ILIKE` searches will become expensive as tables grow.
- Dashboard summaries use grouped PostgreSQL queries rather than fetching all records.
- Report aggregation is bounded but Vendor/Transporter/Company reports perform some aggregation in application memory after database reads.
- Document listing joins the current version and target tables; existing organization/target/date indexes support the MVP pattern.
- Custom-field hydration performs bounded definition/value queries, but heavily customized organizations should be profiled for repeated hydration.
- No clear per-row query loop was found in the primary dashboard/list paths. Detail pages intentionally load related modules in parallel.

## Initial operating limits

- Keep report exports at 1,000 rows and require date/party filters for large organizations.
- Monitor p95 request duration and investigate database operations exceeding `SLOW_QUERY_THRESHOLD_MS` (default 1,000 ms).
- Do not log SQL parameter values. Use provider query fingerprints/statement statistics with restricted access.
- Keep serverless/container PostgreSQL connection count small (`DATABASE_MAX_CONNECTIONS`, default 5) and use the provider pooler endpoint.
- Add trigram/full-text indexes only after production query evidence; do not add Redis prematurely.

Before scaling beyond MVP, load-test dashboards, report variants, global search, document metadata, and custom fields with representative per-organization volumes. Record query plans and add indexes through reviewed forward migrations.
