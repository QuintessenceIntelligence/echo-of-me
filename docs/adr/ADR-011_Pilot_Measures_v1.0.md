# ADR-011 Pilot measures without new data collection (slice 6)

| Field | Value |
|---|---|
| Status | **Accepted** (technical decision under DR-051). **Use with real participants needs founder/legal approval and a pilot research consent ⚖** |
| Date | 19 November 2026 |
| Implements | Slice 6 "pilot telemetry" (DR-040); measures for H1, H2, H8 and context for H3/H4 (01D §5) |
| Code | `db/migrations/0012_pilot_metrics.sql`, `src/domain/progress.ts`, "Your progress" on the legacy page, `docs/operations/Pilot_Metrics_v1.0.md` |

## Decisions
1. **No new tracking.** Measures are computed from records that already exist for other reasons (items, the activity log, practice and recipient answer records, reports). No page-view analytics, no third-party telemetry, no cookies beyond the session.
2. **Operator view = aggregates only**, via `app.pilot_metrics()`, executable only by the NOLOGIN role `echo_metrics`, which cannot read any table. The application role cannot run it.
3. **Author view = their own numbers** ("Your progress"), visible only to them.
4. **Small-cohort caution:** with 10–20 households, aggregates can still be re-identifying when combined with outside knowledge; results go only to the founder and are reported as rounded percentages with denominators.
