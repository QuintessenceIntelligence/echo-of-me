"""
Browser walkthrough: real sign-in flow with AUTH_MODE=supabase (ADR-015), against tests/fake-gotrue.ts.
Starts its own fake identity provider (port 54321) and its own app server (port 3001) on the e2e database.
It proves the app's side of the flow (pages, cookies, token checks, TOTP, refresh, revocation), NOT that the
real Supabase service behaves like the fake. Usage: python3 tests/e2e/walkthrough_supabase.py
"""
import base64
import hashlib
import hmac
import json
import os
import struct
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
AXE = ROOT / "node_modules/axe-core/axe.min.js"
IDP = "http://127.0.0.1:54321"
BASE = "http://localhost:3001"
SUFFIX = str(int(time.time()))
results = {"base_url": BASE, "steps": [], "accessibility": {}}


def step(name, ok=True, note=""):
    results["steps"].append({"step": name, "passed": bool(ok), "note": note})
    print(("PASS " if ok else "FAIL ") + name + (f" ({note})" if note else ""))


def axe(page, label):
    page.wait_for_load_state("networkidle")
    for _ in range(50):
        if page.title():
            break
        page.wait_for_timeout(100)
    page.add_script_tag(path=str(AXE))
    results["accessibility"][label] = page.evaluate(
        """async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}))
           .violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help}))"""
    )


def totp(secret, offset=0):
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    counter = int(time.time() // 30) + offset
    h = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    o = h[-1] & 15
    return str((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 1_000_000).zfill(6)


def idp(path, method="POST"):
    with urllib.request.urlopen(urllib.request.Request(IDP + path, method=method, data=b"" if method == "POST" else None)) as r:
        return json.loads(r.read() or b"{}")


def wait_http(url, seconds=30):
    for _ in range(seconds * 10):
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception as e:  # noqa: BLE001
            if getattr(e, "code", None):
                return True
            time.sleep(0.1)
    return False


env = dict(os.environ, AUTH_MODE="supabase", SUPABASE_URL=IDP, SUPABASE_PUBLISHABLE_KEY="sb_publishable_test_only",
           DATABASE_URL="postgresql://postgres@localhost/echo_e2e?host=/tmp&port=5433",
           SESSION_SECRET="e2e-secret-0123456789abcdef0123456789abcdef", STORAGE_DIR="/tmp/e2e-blobs")
fake = subprocess.Popen(["npx", "tsx", "tests/fake-gotrue.ts", "54321", "130"], cwd=ROOT, stdout=subprocess.DEVNULL)
app = subprocess.Popen(["npx", "next", "start", "-p", "3001"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    assert wait_http(IDP + "/__test/stats") and wait_http(BASE + "/sign-in"), "servers did not start"
    email = f"mum.sb.{SUFFIX}@example.test"
    password = "a long test password 123"
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        a = browser.new_context(viewport={"width": 1100, "height": 900}).new_page()

        a.goto(BASE + "/sign-in")
        axe(a, "sign_in_supabase")
        step("Sign-in asks for email and password; no development sign-in is offered",
             a.get_by_label("Password").count() == 1 and "Development sign-in" not in a.locator("main").inner_text())
        a.get_by_role("link", name="Create an account").click()
        a.wait_for_url("**/sign-up**")
        axe(a, "sign_up")
        a.get_by_label("Your name").fill("Test Mum")
        a.get_by_label("Email address").fill(email)
        a.get_by_label("Password (at least 12 characters)").fill(password)
        a.get_by_label("Type the password again").fill(password)
        with a.expect_navigation():
            a.get_by_role("button", name="Create account").click()
        a.wait_for_url("**/sign-in?**")
        step("Sign-up asks the person to confirm their email address", "confirm your address" in a.locator(".notice.ok").inner_text())

        a.get_by_label("Email address").fill(email)
        a.get_by_label("Password").fill(password)
        with a.expect_navigation():
            a.get_by_role("button", name="Sign in").click()
        step("Signing in before confirming is refused with a clear message", "confirm your email address" in a.locator(".notice.error").inner_text())
        idp(f"/__test/confirm?email={email}")
        a.get_by_label("Email address").fill(email)
        a.get_by_label("Password").fill("wrong password entirely")
        with a.expect_navigation():
            a.get_by_role("button", name="Sign in").click()
        step("A wrong password is refused", "incorrect" in a.locator(".notice.error").inner_text())
        a.get_by_label("Email address").fill(email)
        a.get_by_label("Password").fill(password)
        a.get_by_role("button", name="Sign in").click()
        a.wait_for_url("**/onboarding/consents")
        cookies = {c["name"]: c for c in a.context.cookies()}
        step("Signed in: the provider's tokens are in an HTTP-only cookie", cookies.get("eom_idp", {}).get("httpOnly") is True and cookies.get("eom_session", {}).get("httpOnly") is True)

        for i in range(a.get_by_role("checkbox").count()):
            a.get_by_role("checkbox").nth(i).check()
        a.get_by_role("button", name="Save and continue").click()
        a.wait_for_url("**/onboarding/legacy")
        a.get_by_label("Title").fill("Notes from Mum")
        a.get_by_label("How should your family see your name?").fill("Mum")
        a.get_by_role("button", name="Create legacy").click()
        a.wait_for_url("**/legacy?**")
        a.evaluate("document.querySelectorAll('#recipients details').forEach(d => d.open = true)")
        a.get_by_label("Name", exact=True).first.fill("Sam")
        a.get_by_label("Email (adults only, needed to invite them)").fill(f"sam.sb.{SUFFIX}@example.test")
        with a.expect_navigation():
            a.get_by_role("button", name="Add recipient").click()
        a.get_by_role("button", name="Invite").first.click()
        expect(a.get_by_role("link", name="Confirm your second factor")).to_be_visible(timeout=15000)
        step("Inviting without the second step is refused and points to it")

        a.get_by_role("link", name="Confirm your second factor").click()
        a.wait_for_url("**/mfa**")
        a.get_by_role("button", name="Set up an authenticator app").click()
        expect(a.get_by_test_id("totp-secret")).to_be_visible(timeout=15000)
        axe(a, "mfa_enrol")
        secret = a.get_by_test_id("totp-secret").inner_text().strip()
        step("Authenticator setup shows a QR code and a key", a.locator("img.qr").count() == 1 and len(secret) >= 16)
        bad = str((int(totp(secret)) + 500000) % 1000000).zfill(6)
        a.get_by_label("2. Enter the 6-digit code it shows").fill(bad)
        with a.expect_navigation():
            a.get_by_role("button", name="Confirm").click()
        step("A wrong code is refused", "did not work" in a.locator(".notice.error").inner_text())
        # The setup form is gone after the redirect: start again (removes the half-finished factor).
        a.get_by_role("button", name="Set up an authenticator app").click()
        expect(a.get_by_test_id("totp-secret")).to_be_visible(timeout=15000)
        secret = a.get_by_test_id("totp-secret").inner_text().strip()
        a.get_by_label("2. Enter the 6-digit code it shows").fill(totp(secret))
        a.get_by_role("button", name="Confirm").click()
        a.wait_for_url("**/legacy")
        a.get_by_role("button", name="Invite").first.click()
        expect(a.locator(".notice.ok .mono").first).to_be_visible(timeout=15000)
        step("With the right code the session is upgraded and the invitation is created")

        a.get_by_role("button", name="Sign out").click()
        a.wait_for_url(BASE + "/")
        a.goto(BASE + "/legacy")
        step("Signed out: protected pages send you to sign-in", "/sign-in" in a.url)
        a.get_by_label("Email address").fill(email)
        a.get_by_label("Password").fill(password)
        a.get_by_role("button", name="Sign in").click()
        a.wait_for_url("**/legacy")
        a.goto(BASE + "/mfa?next=/legacy")
        axe(a, "mfa_code")
        step("Next time, only the 6-digit code is asked for", a.get_by_label("Enter the 6-digit code from your authenticator app").count() == 1
             and a.get_by_role("button", name="Set up an authenticator app").count() == 0)
        a.get_by_label("Enter the 6-digit code from your authenticator app").fill(totp(secret))
        a.get_by_role("button", name="Confirm").click()
        a.wait_for_url("**/legacy")

        before = idp("/__test/stats", "GET")["refreshes"]
        time.sleep(12)  # tokens live 130 s here; the app refreshes them in the last 120 s
        a.goto(BASE + "/legacy")
        after = idp("/__test/stats", "GET")["refreshes"]
        step("Tokens are refreshed before they expire and the person stays signed in", after > before and "/legacy" in a.url and "Notes from Mum" in a.locator("main").inner_text())

        idp(f"/__test/revoke?email={email}")
        time.sleep(12)
        a.goto(BASE + "/legacy")
        step("When the provider ends the session (e.g. signed out everywhere), the app signs the person out", "/sign-in" in a.url)
        browser.close()
finally:
    app.terminate()
    fake.terminate()

total = sum(len(v) for v in results["accessibility"].values())
results["summary"] = {"steps": len(results["steps"]), "failed": sum(1 for s in results["steps"] if not s["passed"]), "axe_violation_types": total}
(ROOT / "tests/results/e2e_walkthrough_supabase.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results["summary"]))
print(json.dumps(results["accessibility"], indent=1))
sys.exit(1 if results["summary"]["failed"] or total else 0)
