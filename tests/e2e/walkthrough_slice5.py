"""
Browser walkthrough of slice 5: an author shares approved items with an adult recipient, who reads them,
asks questions and reports an answer; the author stops sharing. Two separate browser sessions.
Usage: python3 tests/e2e/walkthrough_slice5.py [base_url]  → tests/results/e2e_walkthrough_slice5.json
"""
import json
import math
import struct
import sys
import tempfile
import time
import wave
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "tests/results/screenshots"
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
    r = page.evaluate(
        """async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}))
           .violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help}))"""
    )
    results["accessibility"][label] = r


def sign_in(page, email, name):
    page.goto(BASE + "/sign-in")
    page.get_by_label("Email address").fill(email)
    page.get_by_label("Your name").fill(name)
    page.get_by_role("button", name="Continue").click()


tmp = Path(tempfile.mkdtemp())
wav_path = tmp / "note.wav"
with wave.open(str(wav_path), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
    w.writeframes(b"".join(struct.pack("<h", int(8000 * math.sin(2 * math.pi * 330 * i / 8000))) for i in range(8000)))

asha = f"asha.{SUFFIX}@example.test"
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    actx = browser.new_context(viewport={"width": 1100, "height": 900})
    a = actx.new_page()
    sign_in(a, f"dad.{SUFFIX}@example.test", "Test Author")
    a.wait_for_url("**/onboarding/consents")
    for i in range(a.get_by_role("checkbox").count()):
        a.get_by_role("checkbox").nth(i).check()
    a.get_by_role("button", name="Save and continue").click()
    a.wait_for_url("**/onboarding/legacy")
    a.get_by_label("Title").fill("Letters for Asha")
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

    def add(title, body, approve=True):
        a.goto(BASE + "/legacy/memories")
        a.get_by_label("Title").fill(title)
        a.get_by_label("In your own words").fill(body)
        with a.expect_navigation():
            a.get_by_role("button", name="Save and approve" if approve else "Save as draft").click()
        return a.url.split("?")[0]

    driving = add("My driving test", "I failed my driving test twice and passed the third time. Patience beats panic.")
    money = add("Saving money", "Save a tenth of every pay cheque before you spend anything.")
    draft = add("Draft about school", "Draft words about school that are not ready.", approve=False)
    a.goto(driving)
    a.locator("#upload-file").set_input_files(str(wav_path))
    a.get_by_role("button", name="Upload", exact=True).click()
    expect(a.get_by_text("File saved exactly as uploaded.")).to_be_visible(timeout=15000)
    a.goto(driving)
    with a.expect_navigation():
        a.get_by_role("button", name="Approve version 1").click()
    step("Author set up: Asha invited, legacy active, two approved items (one with a recording) and one draft")

    # Recipient joins: nothing shared yet.
    rctx = browser.new_context(viewport={"width": 1000, "height": 900})
    r = rctx.new_page()
    r.goto(link)
    r.get_by_role("link", name="Sign in to continue").click()
    r.get_by_label("Email address").fill(asha)
    r.get_by_label("Your name").fill("Asha")
    r.get_by_role("button", name="Continue").click()
    r.wait_for_url("**/invite/**")
    r.get_by_role("checkbox").check()
    r.get_by_role("button", name="Accept invitation").click()
    r.wait_for_url("**/home?ok=**")
    step("Recipient joins and sees nothing shared yet (AC-02)", r.get_by_text("Nothing has been shared with you yet").is_visible())

    # Author shares the driving memory only.
    a.goto(driving + "#share")
    axe(a, "memory_share_panel")
    a.locator("#share").get_by_label("Asha").check()
    with a.expect_navigation():
        a.get_by_role("button", name="Save sharing").click()
    step("Author shares one item with Asha", "1 added" in a.locator(".notice.ok").inner_text())
    a.goto(draft + "#share")
    step("A draft cannot be shared", a.locator("#share").get_by_text("Approve this item before sharing it").is_visible())

    # Recipient reads and asks.
    r.goto(BASE + "/home")
    r.get_by_role("link", name="Open what was shared").click()
    r.wait_for_url("**/shared/**")
    page_text = r.locator("main").inner_text()
    step("Recipient sees only the shared item, its words and its recording; no draft or unshared item",
         "My driving test" in page_text and "Patience beats panic" in page_text and r.locator("audio").count() == 1
         and "Saving money" not in page_text and "Draft about school" not in page_text)
    shared_url = r.url
    audio_src = r.locator("audio").first.get_attribute("src")
    step("Recipient can play the shared original", r.request.get(BASE + audio_src).status == 200)
    axe(r, "shared_page")
    r.screenshot(path=str(SHOTS / "12_recipient_shared.png"), full_page=True)

    def ask(q):
        r.get_by_label("Ask about what Dad shared with you").fill(q)
        r.get_by_role("button", name="Ask", exact=True).click()
        expect(r.locator(".answer h2")).to_contain_text("Answer", timeout=15000)
        r.wait_for_timeout(400)
        return r.locator(".answer").inner_text()

    t = ask("What happened with your driving test?")
    step("Recipient question answered in Dad's own words, with the AI disclosure", "In their own words · E1" in t and "Patience beats panic" in t and "It is not Dad" in t)
    axe(r, "shared_answer")
    t = ask("How should I save money?")
    step("An approved item that was not shared is never used", "Not recorded · E3" in t and "tenth" not in t)
    t = ask("Are you really my dad?")
    step("Identity question answered plainly", "I am not Dad" in t)

    t = ask("What happened with your driving test?")
    r.get_by_text("Tell Dad about this answer").click()
    r.get_by_label("This is not what they meant").check()
    r.get_by_label("Anything you want to add (optional)").fill("I think he passed on the second try.")
    r.get_by_label("Include my question so Dad can see what I asked").check()
    r.get_by_role("button", name="Send to Dad").click()
    expect(r.locator(".notice.ok")).to_contain_text("Your report was sent", timeout=15000)
    step("Recipient reports an answer")

    # Author sees the report and the activity.
    a.goto(BASE + "/legacy")
    step("Author is told about the report", a.get_by_text("reported by your recipients").is_visible())
    step("Dashboard shows 'Your progress' from the author's own records", "Your progress" in a.locator("main").inner_text() and "1 item shared" in a.locator("#progress").inner_text())
    axe(a, "legacy_dashboard_with_progress")
    a.get_by_role("link", name="Review reports").click()
    a.wait_for_url("**/legacy/reports")
    expect(a.get_by_role("heading", name="Reported answers")).to_be_visible()
    rep = a.locator("main").inner_text()
    step("Report shows reason, note, question (included by choice) and the source item",
         "Not what you meant" in rep and "second try" in rep and "What happened with your driving test?" in rep and "My driving test" in rep)
    axe(a, "reports")
    with a.expect_navigation():
        a.get_by_role("button", name="Mark as dealt with").click()
    a.goto(BASE + "/legacy/activity")
    log = a.locator("table").inner_text()
    step("Author's log shows sharing, views, plays and answers, without the recipient's questions",
         all(s in log for s in ["Item shared with a recipient", "A recipient opened what you shared", "A recipient played a recording you shared", "A recipient asked a question"])
         and "save money" not in log.lower())

    # Author edits the shared item → recipient loses it until re-approved; then stops sharing.
    a.goto(driving)
    a.evaluate("document.querySelectorAll('#words details').forEach(d => d.open = true)")
    a.locator("#e-body").fill("Rewriting this memory, not ready yet.")
    a.get_by_role("button", name="Save new version as draft").click()
    a.wait_for_url("**?ok=**")  # wait for the action's own redirect (timing race otherwise)
    r.goto(shared_url)
    step("An edited (draft) item disappears for the recipient at once", "My driving test" not in r.locator("main").inner_text())
    a.goto(driving)
    a.get_by_role("button", name="Approve version 2").click()
    a.wait_for_url("**?ok=**")
    r.goto(shared_url)
    step("Re-approved item is visible again with the new words", "Rewriting this memory" in r.locator("main").inner_text())
    a.goto(BASE + "/legacy")
    a.get_by_role("button", name="Stop sharing everything with Asha").click()
    a.wait_for_url("**/legacy?ok=**")  # wait for the action's own redirect, not any navigation
    r.goto(shared_url)
    step("After 'Stop sharing everything', the recipient sees nothing", "Nothing has been shared with you yet" in r.locator("main").inner_text())
    step("The recording can no longer be fetched", r.request.get(BASE + audio_src).status == 404)
    browser.close()

total = sum(len(v) for v in results["accessibility"].values())
results["summary"] = {"steps": len(results["steps"]), "failed": sum(1 for s in results["steps"] if not s["passed"]), "axe_violation_types": total}
(ROOT / "tests/results/e2e_walkthrough_slice5.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results["summary"]))
print(json.dumps(results["accessibility"], indent=1))
sys.exit(1 if results["summary"]["failed"] or total else 0)
