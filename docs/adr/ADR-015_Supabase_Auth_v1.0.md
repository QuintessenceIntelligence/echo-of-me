# ADR-015: Real sign-in with Supabase Auth (email + password, TOTP second step)

| Field | Value |
|---|---|
| Status | ACCEPTED as the implementation of ADR-004 (Supabase Auth approved for dev/test by DR-053). **Built and tested against a stand-in; not yet verified against the real Supabase project** (needs the founder's connector switch and three dashboard settings below). |
| Date | 19 November 2026 |
| Code | `src/server/jwt.ts`, `src/server/supabase-auth.ts`, `src/server/idp-cookie.ts`, `src/server/session.ts`, `src/server/auth-mode.ts`, `proxy.ts`, `app/auth-actions.ts`, `app/sign-in`, `app/sign-up`, `app/mfa` |
| Tests | `tests/jwt.test.ts` (6), `tests/auth-supabase.test.ts` (8) against `tests/fake-gotrue.ts`; browser `tests/e2e/walkthrough_supabase.py` **18/18** (incl. password reset), 0 axe violations; all 8 development-mode walkthroughs still pass (101/101). Full suite 145/145. |

## Decision
1. **`AUTH_MODE=supabase`** activates Supabase Auth when `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are set; it is allowed on hosted deployments. `AUTH_MODE=dev` stays refused when hosted. Anything else means no sign-in (never a silent fallback).
2. **Server-side only.** The browser talks only to Echo of Me. Sign-up, sign-in, refresh, sign-out and the authenticator-app steps are server actions calling Supabase's REST API; no Supabase JavaScript runs in the browser and the browser never sees the provider's tokens. They are kept in an HTTP-only, SameSite=Lax cookie (Secure in production), next to the app's own signed session cookie.
3. **Every request is checked cryptographically.** The access token's signature is verified against the project's published keys (JWKS), accepting **only asymmetric ES256/RS256** keys (no shared secret is ever held by the app); issuer, audience, role, expiry, subject and assurance level are all checked. The **assurance level (aal1/aal2) comes from the token**, never from the app's cookie, and the token's user must match the user the app session was created for.
4. **Second step = TOTP authenticator app**, set up the first time a sensitive action needs it (invite, share, export, download data, delete, close account). The QR code and key are shown once; half-finished setups are removed before a new one starts. Success upgrades the session to aal2.
5. **Refresh** happens in `proxy.ts` when the access token is within 120 s of expiry; if the provider has ended the session (signed out everywhere, refresh token reused or revoked), the app's cookies are cleared and the person is asked to sign in. If the provider is unreachable, nothing changes and an expired token is simply refused.
6. **Email must be confirmed** by the provider before an Echo of Me account is created or used (invitations are matched by email address). The app checks `email_confirmed_at` itself as a backstop.
7. **Password reset and change.** "Forgot your password?" asks the provider to email a link; the reply is the same whether or not the address has an account. The link is used only when the person presses Continue (email scanners open links and would otherwise use up the one-time token). Choosing a new password needs the authenticator code if one is set up; other devices are signed out afterwards. Signed-in people can change their password from Your account.
8. **Accounts** are linked by the provider's user id (`supabase|<uuid>`), created on first sign-in. Closing an Echo of Me account also signs the person out everywhere at the provider.

## Founder settings needed on the Supabase project (dashboard, ~10 minutes)
- **Authentication → Sign In / Providers → Email: "Confirm email" ON.** Required: without it, someone could sign up with another person's address and accept invitations meant for them.
- **JWT signing keys: create an asymmetric (ES256) signing key and make it current.** The app refuses legacy shared-secret (HS256) tokens by design.
- **Site URL / redirect URLs** set to the preview address, and the minimum password length at least 12 to match the app.
- **Email template "Reset password"**: link to `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}` (the app exchanges the token on the server; the default link with tokens in the URL fragment does not work server-side). Also set `APP_BASE_URL` to the preview address.
- Then set `AUTH_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` as hosting environment variables. The publishable key is public by design; **no service-role key is used**.

## What is and is not proven
- **Proven locally:** the app's side of every step (pages, cookies, token checks, refusal cases, TOTP, refresh, revocation) against `tests/fake-gotrue.ts`, which implements the REST contract listed at the top of `src/server/supabase-auth.ts`.
- **Not proven:** that the real Supabase Auth API matches that contract in every detail (field names, error codes such as `email_not_confirmed`, factor endpoints). The stand-in is not evidence of that. First hosted run: walk through `walkthrough_supabase.py`'s steps by hand and fix any contract differences in `supabase-auth.ts` only.

## Not built yet (known gaps)
- Email change, removing or replacing an authenticator, recovery when a phone is lost (today: an administrator would have to remove the factor in the dashboard). 🟡 Needed before any real participants. (Forgot-password and change-password are built.)
- Deleting the provider's user record on account closure needs an administrator credential the app deliberately does not hold; closure signs out everywhere and anonymises the Echo of Me account (ADR-013). 🟡 Decide on an admin-side process.
- If a person's provider account is deleted and recreated with the same email, the old Echo of Me account will refuse the new identity ("email in use"); handled manually for now.
- Sign-in attempt limits rely on Supabase's own rate limits.

## Alternatives considered
- `@supabase/ssr` in the browser and server: more moving parts, tokens readable by page scripts in some set-ups, and harder to keep within the strict CSP. Rejected for this product.
- Keeping our own session only (verify the provider once at sign-in): would ignore "sign out everywhere" and password changes for up to 8 hours. Rejected.
- Shared-secret (HS256) verification: the app would hold a secret that can also mint tokens. Rejected.
