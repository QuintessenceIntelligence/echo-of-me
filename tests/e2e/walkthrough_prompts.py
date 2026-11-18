"""
Browser walkthrough of module 05 (guided prompts and gaps). Usage: python3 tests/e2e/walkthrough_prompts.py [base_url]
"""
import json
import sys
import time
from pathlib import Path
from urllib.parse import quote

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
    results["accessibility"][label] = page.evaluate(
        """async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}))
           .violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help}))"""
    )


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    a = browser.new_context(viewport={"width": 1100, "height": 900}).new_page()
    a.goto(BASE + "/sign-in")
    a.get_by_label("Email address").fill(f"gm.{SUFFIX}@example.test")
    a.get_by_label("Your name").fill("Test Author")
    a.get_by_role("button", name="Continue").click()
    a.wait_for_url("**/onboarding/consents")
    for i in range(a.get_by_role("checkbox").count()):
        a.get_by_role("checkbox").nth(i).check()
    a.get_by_role("button", name="Save and continue").click()
    a.wait_for_url("**/onboarding/legacy")
    a.get_by_label("Title").fill("For my grandchildren")
    a.get_by_label("How should your family see your name?").fill("Gogo")
    a.get_by_role("button", name="Create legacy").click()
    a.wait_for_url("**/legacy?**")

    a.get_by_role("link", name="Guided prompts").click()
    a.wait_for_url("**/legacy/prompts")
    axe(a, "prompts")
    a.screenshot(path=str(SHOTS / "13_guided_prompts.png"), full_page=True)
    step("Prompt library shows seven themes and 0 of 35 answered", "You have answered 0 of 35" in a.locator("main").inner_text() and a.locator("section.card h2").count() >= 7)

    a.get_by_role("link", name="Answer: Which family tradition do you love most, and how did it start?").click()
    a.wait_for_url("**/legacy/memories?prompt=family_traditions-01**")
    step("Answering a prompt pre-fills the title and shows the prompt", a.get_by_label("Title").input_value().startswith("Which family tradition") and "Answering a prompt" in a.locator("#add").inner_text())
    axe(a, "memories_from_prompt")
    a.get_by_label("Title").fill("Diwali at Gogo's house")
    a.get_by_label("In your own words").fill("Every Diwali the whole family came to my house. We made sweets for three days before.")
    with a.expect_navigation():
        a.get_by_role("button", name="Save and approve").click()
    t = a.locator("main").inner_text()
    step("The new memory records which prompt it answers and suggests what to answer next",
         "Answers the prompt" in t and "Next in this theme" in t and "What recipe should never be forgotten" in t)

    a.goto(BASE + "/legacy/prompts#family_traditions")
    sec = a.locator("#family_traditions").inner_text()
    step("The prompt is marked answered with a link to the memory", "Answered" in sec and "Diwali at Gogo's house" in sec and "(1 of 5 answered)" in sec)

    with a.expect_navigation():
        a.locator("#adversity li").first.get_by_role("button", name="Hide").click()
    step("A prompt can be hidden and appears under Hidden prompts", a.get_by_role("heading", name="Hidden prompts").is_visible())
    with a.expect_navigation():
        a.get_by_role("button", name="Show again").first.click()
    step("A hidden prompt can be shown again", a.get_by_role("heading", name="Hidden prompts").count() == 0)

    a.goto(BASE + "/legacy/rehearse")
    a.get_by_label("Ask a question the way someone you love might ask it one day").fill("Which football team do you support?")
    a.get_by_role("button", name="Ask", exact=True).click()
    expect(a.locator(".answer h2")).to_contain_text("Not recorded", timeout=15000)
    a.goto(BASE + "/legacy/prompts")
    gaps = a.locator("#gaps").inner_text()
    step("An unanswered practice question appears as a gap", "Which football team do you support?" in gaps)
    a.locator("#gaps").get_by_role("link", name="Answer it").click()
    a.wait_for_url("**/legacy/memories?title=**")
    step("'Answer it' pre-fills the question as the title", a.get_by_label("Title").input_value() == "Which football team do you support?")
    browser.close()

total = sum(len(v) for v in results["accessibility"].values())
results["summary"] = {"steps": len(results["steps"]), "failed": sum(1 for s in results["steps"] if not s["passed"]), "axe_violation_types": total}
(ROOT / "tests/results/e2e_walkthrough_prompts.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results["summary"]))
print(json.dumps(results["accessibility"], indent=1))
sys.exit(1 if results["summary"]["failed"] or total else 0)
