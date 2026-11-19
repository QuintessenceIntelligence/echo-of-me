# 06 | MVP Build and Execution Plan

| Field | Value |
|---|---|
| Document | 06 (required build document) |
| Version | v1.0 |
| Date | 19 November 2026 |
| Status | **PROPOSED plan for founder review.** Nothing here is approved spending: authority is R0 (DR-054). Prices are list prices from dated sources (end of document), mostly secondary sources that must be re-checked on the vendors' own pages before any commitment. Effort figures are Claude's estimates with stated assumptions. |
| Supersedes | The historical **12–14 weeks / US$20,500–30,000** (DR-033, HISTORICAL) — see §2 |

---

## 1. Where the build stands (19 Nov 2026)
| Area | State |
|---|---|
| MVP modules 01–06 (profiles, vault, provider-free answers, practice/simulator, prompts, dashboard and safeguards) | **Built and tested locally** on synthetic data (ADR-001…013, 016) |
| Real sign-in with TOTP; hosted media storage | **Built**, tested against local stand-ins only (ADR-014, 015) |
| Evidence | 151 automated tests; 10 browser walkthroughs (123 steps); 0 automated accessibility violations; answer evaluation gates green (doc 04 §9) |
| Not started | Hosting (runbook ready), email delivery of invitations, AI provider (ADR-007), legal and clinical reviews, pilot recruitment |
| Build documents | 03 v1.2, 04 v1.0, 05 v0.1, 07 v1.0, this 06 v1.0; 02 PRD still to write |

## 2. Re-estimate of the historical figures (DR-033)
The 2025 figures assumed a contracted team building a React Native app with an AI persona over 12–14 weeks. The actual path has been different: a web-first MVP built by the founder with Claude in four working sessions (16–19 Nov 2026), with no AI model and no paid services. The historical numbers therefore **do not describe this project any more**. What remains is not mostly engineering; it is reviews, operations and the pilot:

| Remaining work to a private adult pilot | Who | Estimate (assumptions) |
|---|---|---|
| Hosted preview and its checks (runbook) | Founder + Claude | ~1 session; founder 30–40 min |
| Fix any differences between the real Supabase APIs and the stand-ins | Claude | 0.5–1 session |
| Email delivery of invitations and account emails | Claude, after a vendor decision | ~1 session |
| Lost-phone recovery process; email change | Claude + founder (admin process) | ~1 session |
| Backups and a restore drill (needs a paid database plan) | Claude + founder | ~0.5 session |
| Legal review: consent texts, privacy notice, terms, doc 05 L-01…L-16 | **External lawyer** | Quote needed (not estimated: no source) |
| Clinical / safe-messaging review: C-01, C-02 | **External clinician** | Quote needed |
| Editorial review of 35 prompts | Founder (or editor) | 2–4 hours |
| Accessibility check with real assistive-technology users | Founder-recruited testers | 2–3 sessions of 1 hour |
| Pilot recruitment, research consent, support | Founder | Ongoing during the pilot |
| Optional: AI provider integration (doc 04 §10) | Claude, after ADR-007 | 2–3 sessions incl. evaluation |

"Session" = one Claude working session of several hours with checkpoints, as in sessions 3 and 4. These are planning estimates, not quotes.

## 3. Running costs (USD list prices; ZAR at a planning rate of **R17.00 per US$**)
Exchange-rate sources checked on 19 Nov 2026 disagreed (roughly R16.4 to R18.1 per US$ across converters [S8]); R17.00 is a planning assumption only.

| Service | Today (preview) | Pilot (what changes and why) | Source |
|---|---|---|---|
| Supabase (database, sign-in, storage) | Free plan: pauses after ~7 days idle, no backups | **Pro: from US$25/month per organisation**, includes US$10 compute credit (one Micro instance) and daily backups; needed before any real data (backups, no pausing) | [S1][S2] |
| Vercel (hosting) | Hobby: free, **non-commercial only** (DR-056) | **Pro: US$20 per seat/month** with US$20 usage credit, if the pilot is treated as commercial use ⚖/founder | [S3][S4] |
| Email (invitations, sign-in emails) | Not connected | e.g. Resend free tier: 3,000 emails/month, 100/day; Pro from US$20/month for 50,000 | [S5] |
| Transcription (optional, ADR-007) | None | e.g. OpenAI gpt-4o-mini-transcribe about US$0.003/min, gpt-4o-transcribe about US$0.006/min | [S6] |
| Generated answers (optional, ADR-007) | None (quotes only) | e.g. Anthropic Claude Haiku 5.5 about US$0.10/US$0.50 per million input/output tokens; Sonnet 5.5 about US$2/US$10 | [S7] (secondary; verify on Anthropic's page) |

### Pilot cost model (assumptions stated so they can be changed)
Assumptions: 20 author households; per author 60 minutes of recordings and 250 questions over the pilot (their own practice plus three recipients); a generated answer reads ~2,000 tokens and writes ~200; the pilot runs about two months including set-up.

| Line | US$ | ZAR (R17/US$) |
|---|---|---|
| Supabase Pro, 2 months | 50 | 850 |
| Vercel Pro, 1 seat, 2 months (if required) | 40 | 680 |
| Email on a free tier | 0 | 0 |
| **Fixed subtotal** | **90** | **1,530** |
| Option A: stay provider-free | 0 | 0 |
| Option B: Haiku-class answers (5,000 questions) + mini transcription (1,200 min) | ≈ 5 | ≈ 87 |
| Option C: Sonnet-class answers + full transcription | ≈ 37 | ≈ 632 |
| **Pilot total (excluding professional fees)** | **≈ 90 – 127** | **≈ R1,530 – R2,160** |

Storage at about 0.5 MB per minute of compressed speech is ~30 MB per author (~0.6 GB for 20), inside the Pro plan's allowances [S1]. **Professional fees (legal, clinical) are the dominant cost and are not estimated here** (no sourced basis); request quotes.

## 4. Phased plan to the pilot
| Phase | Exit criteria | Founder decisions needed |
|---|---|---|
| **A. Hosted preview** (synthetic data) | Runbook Part E all passing on the real Supabase project; results recorded | Connector switch; Supabase settings; Vercel project; storage keys (no cost on free plans) |
| **B. Pilot readiness** | Doc 05 §13 go/no-go list all true: entity and Information Officer; legal review done; operator agreements; Pro plans with backups and a restore drill; email delivery; clinical review; pilot consent approved | Spending approval (§3), legal and clinical engagement, ADR-007 (or "stay provider-free"), email vendor, commercial-use question for hosting |
| **C. Private adult pilot** | 10–20 consenting adult households, about 6 weeks (DR-025 PROPOSED); weekly safety review; reports triaged within 48 h | Recruitment approach; support contact |
| **D. Decision** | Go/no-go below | Next phase and budget |

## 5. Go / no-go after the pilot (from 01D, thresholds PROPOSED, OQ-15)
Proceed only if **H3 faithfulness** (≥ 95 % of answers with no unsupported attributed claim in blinded author review, 0 severe), **H5 isolation** (0 leaks: hard gate) and **H8 safety** (0 unresolved serious incidents) pass, **and** at least two of **H1 capture** (≥ 60 % of authors with ≥ 5 approved items by week 3), **H2 return** (≥ 50 % with a second capture day within 14 days) and **H7 value** (≥ 40 % would pay, indicative). H1, H2 and H8 are measured by the built pilot measures (ADR-011) once approved for real participants.

## 6. Risks and contingency
| Risk | Effect | Mitigation |
|---|---|---|
| Real Supabase APIs differ from the stand-ins | Preview delayed | Differences confined to two modules; budget 1 extra session |
| Legal review changes consent or retention rules | Rework of texts and some flows | Texts are versioned; consent model built for re-consent |
| Free-plan limits (pausing, no backups) | Data loss or downtime | Synthetic data only until Pro (DR-053) |
| Paraphrased questions often get "not recorded" | Lower perceived usefulness (H7) | Accept for pilot, or ADR-007 option B/C; measure first |
| Costs grow with a paid AI provider | Budget overrun | Per-account rate limits (ADR-012); a per-legacy monthly cap before any paid provider |
| Founder time | Pilot slips | Runbook and playbook keep founder steps short and explicit |

**Contingency:** add 25 % to running costs and one extra Claude session per phase.

## Sources (accessed 19 November 2026)
- [S1] Supabase pricing page (Pro US$25/month; US$10 compute credits; plan features): https://supabase.com/pricing and https://supabase.com/blog/pricing
- [S2] Toolradar, Supabase pricing verified Nov 2026 (Pro includes 7-day backups): https://toolradar.com/tools/supabase/pricing
- [S3] Vercel Pro plan documentation: https://vercel.com/docs/plans/pro-plan ; summary of US$20 per seat with US$20 usage credit: https://www.stork.ai/blog/vercel-pricing-2026
- [S4] Vercel Hobby is personal, non-commercial: https://www.wearefounders.uk/vercel-pricing-2026-what-you-actually-pay-to-host-your-startup/
- [S5] Resend pricing (free 3,000/month, 100/day; Pro US$20 for 50,000): https://resend.com/pricing ; https://automationatlas.io/answers/resend-pricing-explained-2026/
- [S6] OpenAI transcription prices per minute: https://costgoat.com/pricing/openai-transcription ; https://diyai.io/ai-tools/speech-to-text/openai-whisper-api-pricing-2026/
- [S7] Claude API prices (secondary): https://metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration ; https://benchlm.ai/anthropic/api-pricing — verify on https://docs.claude.com before deciding
- [S8] USD/ZAR converters (values differed by source): https://wise.com/in/currency-converter/usd-to-zar-rate ; https://poundsterlinglive.com/data/currencies/USD-pairs/USDZAR-exchange-rate
