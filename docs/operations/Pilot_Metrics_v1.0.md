# Pilot measures: how to run them (slice 6, ADR-011)

**Do not run this against real participants until the pilot research consent and approval exist (founder / legal ⚖).**

`app.pilot_metrics(p_since timestamptz default null)` returns aggregate rows only: `metric, value, denominator, note`.
No legacy ids, names, questions or content. It can be executed only by the NOLOGIN role `echo_metrics`.

```sql
-- once, by the database owner, for a named operator login:
grant echo_metrics to <operator_login>;
-- then, as that operator:
set role echo_metrics;
select * from app.pilot_metrics('2026-12-01');   -- legacies created since the pilot start
reset role;
```

| Metric | Hypothesis (01D §5) |
|---|---|
| `h1_five_approved_within_21_days_pct` | H1 capture, target ≥ 60 % |
| `h2_second_capture_day_within_14_days_pct` | H2 return, target ≥ 50 % |
| `practice_answers_not_recorded_pct`, `recipient_answers_not_recorded_pct` | context for H4 (abstention is measured properly by the evaluation sets) |
| `safety_routings` | H8: every routing must be reviewed as a potential incident (counts only here) |
| `answer_reports_<reason>` | H3 signal: answers recipients flagged |

H3 (blinded faithfulness review), H5 (adversarial isolation: the automated test suites), H6 and H7 (surveys) are measured outside this function.
