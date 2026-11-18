"""
Browser walkthrough of slice 4: pin, suppress and "answer it yourself" on the practice page (AC-11).
Usage: python3 tests/e2e/walkthrough_slice4.py [base_url]  → tests/results/e2e_walkthrough_slice4.json
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


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    a = browser.new_context(viewport={"width": 1100, "height": 900}).new_page()
    a.goto(BASE + "/sign-in")
    a.get_by_label("Email address").fill(f"pa.{SUFFIX}@example.test")
    a.get_by_label("Your name").fill("Test Author")
    a.get_by_role("button", name="Continue").click()
    a.wait_for_url("**/onboarding/consents")
    for i in range(a.get_by_role("checkbox").count()):
        a.get_by_role("checkbox").nth(i).check()
    a.get_by_role("button", name="Save and continue").click()
    a.wait_for_url("**/onboarding/legacy")
    a.get_by_label("Title").fill("For my son")
    a.get_by_label("How should your family see your name?").fill("Pa")
    a.get_by_role("button", name="Create legacy").click()
    a.wait_for_url("**/legacy?**")

    def add(title, body):
        a.goto(BASE + "/legacy/memories")
        a.get_by_label("Title").fill(title)
        a.get_by_label("In your own words").fill(body)
        with a.expect_navigation():
            a.get_by_role("button", name="Save and approve").click()

    add("Failing at work", "When I failed at work I asked for help. Failing is how you learn.")
    add("Fixing the old car", "We fixed the Datsun every Saturday. Patience fixes most things.")
    add("Working on the farm", "Work hard, and rest on Sunday.")
    step("Three approved items created")

    a.goto(BASE + "/legacy/rehearse")

    def ask(q):
        a.get_by_label("Ask a question the way someone you love might ask it one day").fill(q)
        a.get_by_role("button", name="Ask", exact=True).click()
        expect(a.locator(".answer h2")).to_contain_text("Answer", timeout=15000)
        a.wait_for_timeout(400)
        return a.locator(".answer").inner_text()

    def wait_notice(text):
        expect(a.locator(".notice.ok")).to_contain_text(text, timeout=15000)
        a.wait_for_timeout(300)
        return a.locator(".answer").inner_text()

    # 1. Answer it yourself turns a gap into the author's own words.
    t = ask("Should I study medicine or law?")
    step("Unknown question answered 'Not recorded'", "Not recorded · E3" in t)
    a.get_by_text("Answer it yourself", exact=True).click()
    a.get_by_label("Your answer").fill("Choose the one that lets you help people every day. I will be proud either way.")
    a.get_by_role("button", name="Save, approve and pin").click()
    t = wait_notice("Saved in your own words, approved, and pinned")
    step("'Answer it yourself' saves an approved item and the same question now gets those exact words as E1",
         "In their own words · E1" in t and "Choose the one that lets you help people every day" in t and "You pinned this answer on" in t)
    axe(a, "rehearse_pinned_answer")
    a.screenshot(path=str(SHOTS / "11_rehearse_pinned.png"), full_page=True)

    # 2. Suppress an item for one question.
    t = ask("What did you learn from failing at work?")
    step("Direct answer from 'Failing at work'", "Failing is how you learn" in t)
    a.get_by_role("button", name="Don't use “Failing at work” for this question").click()
    t = wait_notice("will not be used for this question")
    step("After 'Don't use this', the item disappears from that answer and the hidden count is shown",
         "Failing is how you learn" not in t and "hidden for this question" in t)

    # 3. Pin an adjacent item.
    t = ask("What is the best way to stay calm?")
    step("Unrelated question offers things that were recorded", "Things Pa did record" in t)
    a.get_by_role("button", name="Pin “Fixing the old car” as the answer to this question").click()
    t = wait_notice("Pinned")
    step("Pinning an adjacent item makes it the direct answer", "Patience fixes most things" in t and "In their own words · E1" in t)

    # 4. Rules list and removal.
    a.goto(BASE + "/legacy/rehearse")
    rules = a.locator("#rules").inner_text()
    step("Rules list shows the two pins and the hidden item",
         "Answer with" in rules and "Never use" in rules and rules.count("Answer with") == 2)
    axe(a, "rehearse_rules")
    with a.expect_navigation():
        a.get_by_role("button", name="Remove rule for “What did you learn from failing at work?”").click()
    t = ask("What did you learn from failing at work?")
    step("Removing the rule brings the item back", "Failing is how you learn" in t)

    a.goto(BASE + "/legacy/activity")
    log = a.locator("table").inner_text()
    step("Activity log records the rule changes without question text",
         all(s in log for s in ["Answer pinned", "Item hidden for a question", "Answer rule removed"]) and "medicine" not in log)
    browser.close()

total = sum(len(v) for v in results["accessibility"].values())
results["summary"] = {"steps": len(results["steps"]), "failed": sum(1 for s in results["steps"] if not s["passed"]), "axe_violation_types": total}
(ROOT / "tests/results/e2e_walkthrough_slice4.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results["summary"]))
print(json.dumps(results["accessibility"], indent=1))
sys.exit(1 if results["summary"]["failed"] or total else 0)
