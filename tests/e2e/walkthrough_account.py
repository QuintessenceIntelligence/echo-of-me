"""
Browser walkthrough: personal-data rights (ADR-013) — your account page, download your data, leave a
legacy, close your account. Usage: python3 tests/e2e/walkthrough_account.py [base_url]
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
ROOT = Path(__file__).resolve().parents[2]
AXE = ROOT / "node_modules/axe-core/axe.min.js"
SUFFIX = str(int(time.time()))
results = {"base_url": BASE, "steps": [], "accessibility": {}}


def step(name, ok=True, note=""):
    results["steps"].append({"step": name, "passed": bool(ok), "note": note})
    print(("PASS " if ok else "FAIL ") + name + (f" ({note})" if note else ""))


def axe(page, label):
    page.wait_for_load_state("networkidle")
    for _ in range(50):  # polled from the test side: the app's CSP forbids evaluating strings in the page
        if page.title():
            break
        page.wait_for_timeout(100)
    page.add_script_tag(path=str(AXE))
    results["accessibility"][label] = page.evaluate(
        """async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}))
           .violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help}))"""
    )


def sign_in(page, email, name):
    page.goto(BASE + "/sign-in")
    page.get_by_label("Email address").fill(email)
    page.get_by_label("Your name").fill(name)
    page.get_by_role("button", name="Continue").click()


asha = f"asha.acct.{SUFFIX}@example.test"
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    a = browser.new_context(viewport={"width": 1100, "height": 900}).new_page()
    sign_in(a, f"dad.acct.{SUFFIX}@example.test", "Test Author")
    a.wait_for_url("**/onboarding/consents")
    for i in range(a.get_by_role("checkbox").count()):
        a.get_by_role("checkbox").nth(i).check()
    a.get_by_role("button", name="Save and continue").click()
    a.wait_for_url("**/onboarding/legacy")
    a.get_by_label("Title").fill("Notes for Asha")
    a.get_by_label("How should your family see your name?").fill("Dad")
    a.get_by_role("button", name="Create legacy").click()
    a.wait_for_url("**/legacy?**")
    a.evaluate("document.querySelectorAll('#recipients details').forEach(d => d.open = true)")
    a.get_by_label("Name", exact=True).first.fill("Asha")
    a.get_by_label("Email (adults only, needed to invite them)").fill(asha)
    with a.expect_navigation():
        a.get_by_role("button", name="Add recipient").click()
    a.goto(BASE + "/mfa?next=/legacy")
    with a.expect_navigation():
        a.get_by_role("button", name="Simulate second-factor confirmation").click()
    a.get_by_role("button", name="Invite").first.click()
    expect(a.locator(".notice.ok .mono").first).to_be_visible(timeout=15000)
    link = a.locator(".notice.ok .mono").first.inner_text().strip()
    with a.expect_navigation():
        a.get_by_role("button", name="I have finished setting up").click()
    a.goto(BASE + "/legacy/memories")
    a.get_by_label("Title").fill("Saving money")
    a.get_by_label("In your own words").fill("Save a tenth of every pay cheque before you spend anything.")
    with a.expect_navigation():
        a.get_by_role("button", name="Save and approve").click()
    item = a.url.split("?")[0]

    r = browser.new_context(viewport={"width": 1000, "height": 900}).new_page()
    r.goto(link)
    r.get_by_role("link", name="Sign in to continue").click()
    r.get_by_label("Email address").fill(asha)
    r.get_by_label("Your name").fill("Asha")
    r.get_by_role("button", name="Continue").click()
    r.wait_for_url("**/invite/**")
    r.get_by_role("checkbox").check()
    r.get_by_role("button", name="Accept invitation").click()
    r.wait_for_url("**/home?ok=**")
    a.goto(item + "#share")
    a.locator("#share").get_by_label("Asha").check()
    with a.expect_navigation():
        a.get_by_role("button", name="Save sharing").click()
    step("Set-up: Asha joined and one item is shared with her", "1 added" in a.locator(".notice.ok").inner_text())

    # Your account page.
    r.goto(BASE + "/home")
    r.get_by_role("link", name="Your account").click()
    r.wait_for_url("**/account")
    axe(r, "account_page")
    text = r.locator("main").inner_text()
    step("Account page shows details, the legacy joined, and the three rights", asha in text and "Notes for Asha" in text
         and "Download my data" in text and "Leave this legacy" in text and "Close my account" in text)

    # Download your data (asks for the second factor first).
    with r.expect_navigation():
        r.get_by_role("button", name="Download my data").click()
    step("Downloading your data asks for the second factor first", "/mfa" in r.url)
    with r.expect_navigation():
        r.get_by_role("button", name="Simulate second-factor confirmation").click()
    r.wait_for_url("**/account")
    with r.expect_download() as dl:
        r.get_by_role("button", name="Download my data").click()
    data = json.loads(Path(dl.value.path()).read_text())
    step("The download holds the account's own data and none of the author's words",
         data.get("format") == "echo-of-me-account-data/0.1" and len(data.get("memberships", [])) == 1
         and "Save a tenth" not in json.dumps(data))

    # Leave the legacy.
    r.get_by_label("I want to leave Notes for Asha").check()
    with r.expect_navigation():
        r.get_by_role("button", name="Leave this legacy").click()
    step("Asha leaves; access ends", "You left that legacy" in r.locator(".notice.ok").inner_text()
         and "You have not joined anyone's legacy" in r.locator("main").inner_text())
    a.goto(BASE + "/legacy")
    step("The author sees that she left and can invite her again", "Left (you can invite them again)" in a.locator("main").inner_text())
    a.goto(BASE + "/legacy/activity")
    step("The author's activity log records it", "A recipient left your legacy" in a.locator("main").inner_text())

    # Close the account.
    r.goto(BASE + "/account#close")
    r.get_by_label("Type your email address to confirm").fill("wrong@example.test")
    r.get_by_label("I understand that closing my account cannot be undone").check()
    with r.expect_navigation():
        r.get_by_role("button", name="Close my account").click()
    step("A wrong email address is refused", "exactly as shown" in r.locator(".notice.error").inner_text())
    r.get_by_label("Type your email address to confirm").fill(asha)
    r.get_by_label("I understand that closing my account cannot be undone").check()
    with r.expect_navigation():
        r.get_by_role("button", name="Close my account").click()
    r.wait_for_url("**/sign-in?ok=**")
    axe(r, "sign_in_after_close")
    step("Closing signs her out with a clear confirmation", "Your account was closed" in r.locator(".notice.ok").inner_text())
    r.goto(BASE + "/account")
    step("The old session no longer works", "/sign-in" in r.url)

    # An author must delete their legacy first.
    a.goto(BASE + "/account#close")
    axe(a, "account_page_author")
    step("An author is told to export and delete the legacy before closing", "delete it" in a.locator("#close").inner_text()
         and a.get_by_role("button", name="Close my account").count() == 0)
    browser.close()

total = sum(len(v) for v in results["accessibility"].values())
results["summary"] = {"steps": len(results["steps"]), "failed": sum(1 for s in results["steps"] if not s["passed"]), "axe_violation_types": total}
(ROOT / "tests/results/e2e_walkthrough_account.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results["summary"]))
print(json.dumps(results["accessibility"], indent=1))
sys.exit(1 if results["summary"]["failed"] or total else 0)
