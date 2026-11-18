"""
End-to-end walkthrough of vertical slice 1 in a real browser (headless Chrome via Playwright).
Runs against a running app (default http://localhost:3000) on a fresh database.
Also runs axe-core accessibility checks (WCAG 2.x A/AA rules) on each screen.

Usage: python3 tests/e2e/walkthrough.py [base_url]
Writes tests/results/e2e_walkthrough.json and screenshots to tests/results/screenshots/.
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "tests/results/screenshots"
AXE = ROOT / "node_modules/axe-core/axe.min.js"
SUFFIX = str(int(time.time()))
results = {"base_url": BASE, "steps": [], "accessibility": {}}


def step(name, ok=True, note=""):
    results["steps"].append({"step": name, "passed": ok, "note": note})
    print(("PASS " if ok else "FAIL ") + name + (f" ({note})" if note else ""))


def axe(page, label):
    page.wait_for_load_state("networkidle")
    page.wait_for_function("document.title.length > 0")
    page.add_script_tag(path=str(AXE))
    r = page.evaluate(
        """async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}))
           .violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help}))"""
    )
    results["accessibility"][label] = r
    return r


def shot(page, name):
    page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

    # ---------------- Author
    author = browser.new_context(viewport={"width": 1100, "height": 900})
    a = author.new_page()
    a.goto(BASE + "/")
    axe(a, "landing")
    shot(a, "01_landing")
    a.get_by_role("link", name="Start your legacy").click()
    a.get_by_label("Email address").fill(f"dad.{SUFFIX}@example.test")
    a.get_by_label("Your name").fill("Test Author")
    a.get_by_role("button", name="Continue").click()
    a.wait_for_url("**/onboarding/consents")
    axe(a, "consents")
    shot(a, "02_consents")
    step("New author is sent to the consent step first")

    a.get_by_role("button", name="Save and continue").click()
    step("Required consents cannot be skipped (browser blocks submit)", a.url.endswith("/onboarding/consents"))

    boxes = a.get_by_role("checkbox")
    boxes.nth(0).check()  # terms
    boxes.nth(1).check()  # privacy
    boxes.nth(3).check()  # share with recipients (order: terms, privacy, ai, share, audio)
    a.get_by_role("button", name="Save and continue").click()
    a.wait_for_url("**/onboarding/legacy")
    axe(a, "create_legacy")
    a.get_by_label("Title").fill("Letters for my children")
    a.get_by_label("How should your family see your name?").fill("Dad")
    a.get_by_role("button", name="Create legacy").click()
    a.wait_for_url("**/legacy?**")
    expect(a.get_by_text("Your legacy has been created")).to_be_visible()
    step("Legacy created after consents")

    def open_add_form():
        a.goto(BASE + "/legacy")
        a.wait_for_load_state("networkidle")
        a.evaluate("document.querySelectorAll('#recipients details').forEach(d => d.open = true)")

    def add_recipient(name, minor=False, email=None):
        open_add_form()
        a.get_by_label("Name", exact=True).first.fill(name)
        a.get_by_label("Relationship to you").select_option("child")
        a.get_by_label("Under 18 (kept as a record only, no email)" if minor else "Adult (18 or older)").check()
        if email:
            a.get_by_label("Email (adults only, needed to invite them)").fill(email)
        a.get_by_role("button", name="Add recipient").click()
        a.wait_for_url("**/legacy?ok=**")

    asha = f"asha.{SUFFIX}@example.test"
    add_recipient("Asha", email=asha)
    add_recipient("Ravi", minor=True)
    add_recipient("Priya")
    a.goto(BASE + "/legacy")
    rows = a.locator("#recipients tbody tr")
    step("Three recipients added (AC-01)", rows.count() == 3, f"rows={rows.count()}")
    step("Each recipient shows 'Nothing yet' shared (AC-02)", a.locator("#recipients td", has_text="Nothing yet").count() == 3)

    open_add_form()
    a.get_by_label("Name", exact=True).first.fill("Kid With Email")
    a.get_by_label("Under 18 (kept as a record only, no email)").check()
    a.get_by_label("Email (adults only, needed to invite them)").fill(f"kid.{SUFFIX}@example.test")
    a.get_by_role("button", name="Add recipient").click()
    a.wait_for_url("**error=**")
    step("Child with an email address is refused", a.locator(".notice.error").count() == 1, a.locator(".notice.error").inner_text())

    a.goto(BASE + "/legacy")
    a.wait_for_load_state("networkidle")
    a.locator("#t-name").fill("Uncle Dev")
    a.locator("#t-rel").fill("brother")
    a.get_by_role("button", name="Save trusted contact").click()
    a.wait_for_url("**/legacy?ok=**")
    step("Trusted contact saved (record only)", a.get_by_text("Uncle Dev (brother)").is_visible())

    a.get_by_role("button", name="Invite").first.click()
    expect(a.locator(".notice.error")).to_contain_text("second sign-in factor")
    step("Invitation refused without second factor")
    a.get_by_role("link", name="Confirm your second factor").click()
    a.get_by_role("button", name="Simulate second-factor confirmation").click()
    a.wait_for_url("**/legacy")
    a.get_by_role("button", name="Invite").first.click()
    link = a.locator(".notice.ok .mono").first.inner_text().strip()
    step("Invitation link created after second factor", "/invite/" in link)
    axe(a, "legacy_dashboard")
    shot(a, "03_legacy_dashboard_with_invite")

    a.get_by_role("button", name="I have finished setting up").click()
    a.wait_for_url("**/legacy?ok=Setup**")
    step("Legacy becomes Active", a.get_by_text("Active", exact=True).is_visible())

    # ---------------- Wrong person opens the link
    intruder = browser.new_context()
    i = intruder.new_page()
    i.goto(link)
    axe(i, "invite_signed_out")
    i.get_by_role("link", name="Sign in to continue").click()
    i.get_by_label("Email address").fill(f"intruder.{SUFFIX}@example.test")
    i.get_by_role("button", name="Continue").click()
    i.wait_for_url("**/invite/**")
    i.get_by_role("checkbox").check()
    i.get_by_role("button", name="Accept invitation").click()
    i.wait_for_url("**error=**")
    step("A different signed-in person cannot use the link", "different email" in i.locator(".notice.error").inner_text())
    intruder.close()

    # ---------------- Intended recipient
    rec = browser.new_context()
    r = rec.new_page()
    r.goto(link)
    r.get_by_role("link", name="Sign in to continue").click()
    r.get_by_label("Email address").fill(asha)
    r.get_by_label("Your name").fill("Asha")
    r.get_by_role("button", name="Continue").click()
    r.wait_for_url("**/invite/**")
    axe(r, "invite_signed_in")
    shot(r, "04_recipient_terms")
    r.get_by_role("checkbox").check()
    r.get_by_role("button", name="Accept invitation").click()
    r.wait_for_url("**/home?ok=**")
    expect(r.get_by_text("Nothing has been shared with you yet")).to_be_visible()
    axe(r, "recipient_home")
    shot(r, "05_recipient_home")
    step("Recipient joins and sees nothing shared (AC-02)")
    r.goto(BASE + "/legacy")
    step("Recipient cannot open the author's legacy page", not r.url.endswith("/legacy") or "Letters" not in r.content())
    r.goto(link)
    r.get_by_role("checkbox").check()
    r.get_by_role("button", name="Accept invitation").click()
    r.wait_for_url("**error=**")
    step("Invitation link cannot be reused")
    rec.close()

    # ---------------- Author reviews activity
    a.goto(BASE + "/legacy")
    step("Author sees Asha as Joined", a.locator("#recipients tr", has_text="Asha").get_by_text("Joined").is_visible())
    a.get_by_role("link", name="Activity log").click()
    axe(a, "activity_log")
    shot(a, "06_activity_log")
    step("Refused attempt by someone else is in the author's log", a.locator("tr", has_text="Someone else").get_by_text("Refused").count() >= 1)
    log_text = a.locator("table").inner_text()
    step("Activity log shows no recipient emails", asha not in log_text)
    browser.close()

total_violations = sum(len(v) for v in results["accessibility"].values())
results["summary"] = {
    "steps": len(results["steps"]),
    "failed": sum(1 for s in results["steps"] if not s["passed"]),
    "axe_violation_types": total_violations,
}
(ROOT / "tests/results/e2e_walkthrough.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results["summary"]))
print(json.dumps(results["accessibility"], indent=1))
sys.exit(1 if results["summary"]["failed"] else 0)
