# Echo of Me | Hosted Preview Runbook

| Field | Value |
|---|---|
| Version | v1.0 |
| Date | 19 November 2026 |
| Purpose | The exact steps to put the tested build on a **private preview** with real sign-in and storage, on synthetic data only (DR-053), at no cost (free plans, DR-054). |
| Who | **F** = founder (needs your sign-ins or a secret only you should see) · **C** = Claude (can do it once the Supabase connector points at the Echo of Me organisation) |
| Time | About 30–40 minutes of founder time, in one sitting, with Claude in the chat |

**Secrets rule.** Passwords and keys go straight from the Supabase dashboard (or your password manager) into Vercel's environment variables. Never paste them into the chat; Claude does not need to see them.

---

## Part A: database (Supabase project "Echo of Me", eu-west-1)
1. **F** Switch Claude's Supabase connector to the Echo of Me organisation (handoff §0.3), then send any message so the tools load.
2. **C** Apply migrations `0006`–`0014` and seed `0002_prompts_v0.1.sql`, in order; check the security advisor; run the two-family isolation test and the account-closure test inside a rolled-back transaction; confirm the SECURITY DEFINER helpers behave as they do locally.
3. **F** Set the runtime login password: in the SQL editor run `alter role echo_app_login with password '<a long random password from your password manager>';` and keep that password only in your password manager and in Vercel (step 11).

## Part B: sign-in settings (Supabase dashboard → Authentication) — ADR-015
4. **F** Email provider: **"Confirm email" ON** (required: invitations depend on proven email addresses).
5. **F** Password policy: minimum length **12**.
6. **F** JWT signing keys: create an **ES256** (elliptic-curve) signing key and make it the current key. The app refuses legacy shared-secret tokens.
7. **F** Email template "Reset password": make the link `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}`.
8. **F** URL configuration: after the first preview deploy (step 13), set **Site URL** to the preview address and add it to the redirect allow-list.
   (Two-factor TOTP is on by default in Supabase Auth; nothing to change.)

## Part C: media storage (Supabase dashboard → Storage) — ADR-014
9. **F** Create a **private** bucket named `echo-media` (not public).
10. **F** Storage settings → S3 connection: enable it, note the endpoint and region, and create an **access key** pair. Copy the key straight into Vercel (step 11).

## Part D: Vercel (team "Quintessence", Hobby, non-commercial — DR-056)
11. **F** Create a Vercel project from the GitHub repo `QuintessenceIntelligence/echo-of-me`. Add these environment variables for **Preview only**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler** connection string, user `echo_app_login`, the password from step 3 |
| `SESSION_SECRET` | 48+ random characters (password manager) |
| `AUTH_MODE` | `supabase` |
| `SUPABASE_URL` | `https://cvyoicwcsbxmhjuslixv.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | the project's publishable (anon) key — **not** the service-role key |
| `APP_BASE_URL` | the preview address (after step 13; redeploy once) |
| `STORAGE_BACKEND` | `s3` |
| `STORAGE_S3_ENDPOINT` | `https://cvyoicwcsbxmhjuslixv.storage.supabase.co/storage/v1/s3` |
| `STORAGE_S3_REGION` | the region shown in step 10 |
| `STORAGE_S3_BUCKET` | `echo-media` |
| `STORAGE_S3_ACCESS_KEY_ID` / `STORAGE_S3_SECRET_ACCESS_KEY` | from step 10 |

12. **F** Deployment Protection: **Vercel Authentication on**; use **preview deployments only** until "All Deployments" protection is verified (DR-056).
13. **F** Deploy a preview from `main`; then finish step 8 and set `APP_BASE_URL`; redeploy.

## Part E: checks before calling it "working" — C, with F signing in
14. Development sign-in is refused on the preview (automatic when hosted).
15. Sign up → confirmation email → sign in → set up an authenticator app → invite a second test account → accept → share one item → recipient asks a question → report → author sees the report.
16. Upload a short recording, then a file over 3 MB (sent in pieces, ADR-016) → play them as the recipient → export the legacy → download your own data.
17. Forgot password → reset → old password refused.
18. Close the test recipient's account → its session stops working.
19. Record the results (DR-053 report) in `canonical/build/` and the handoff. Any difference between the real Supabase API and the stand-in is fixed in `src/server/supabase-auth.ts` or `src/server/storage.ts` only, with a test.

## Things Claude will watch for on the first run
- **Database connection over the pooler:** every request runs in an explicit transaction with `SET LOCAL`, which suits transaction pooling; if the driver's TLS check rejects the pooler's certificate, Claude adds Supabase's CA certificate rather than turning verification off.
- **Contract differences** between the real Supabase Auth / Storage APIs and the local stand-ins (ADR-014, ADR-015).

## Known limits on the preview
- Free Supabase plan: pauses after about a week without activity; **no backups** → synthetic data only.
- No email to recipients yet: invitation links are copied by hand.
- Doc 05 §13 lists everything still needed before any real personal data (currently **no-go**).
