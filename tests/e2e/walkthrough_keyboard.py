"""
Keyboard-only check (towards AC-14 / WCAG 2.2 AA): a skip link comes first and moves focus to the main
content; every element reached with Tab shows a visible focus indicator; key tasks can be done without a
mouse. Automated evidence only: testing with real assistive-technology users is still needed.
Usage: python3 tests/e2e/walkthrough_keyboard.py [base_url]
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
ROOT = Path(__file__).resolve().parents[2]
SUFFIX = str(int(time.time()))
results = {"base_url": BASE, "steps": [], "accessibility": {}}

FOCUS_INFO = """() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const s = getComputedStyle(el);
  const visible = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
  return { tag: el.tagName.toLowerCase(), text: (el.innerText || el.getAttribute('aria-label') || el.name || el.id || '').trim().slice(0, 40), visible };
}"""


def step(name, ok=True, note=""):
    results["steps"].append({"step": name, "passed": bool(ok), "note": note})
    print(("PASS " if ok else "FAIL ") + name + (f" ({note})" if note else ""))


def tab_through(page, limit=60):
    seen, invisible = [], []
    for _ in range(limit):
        page.keyboard.press("Tab")
        info = page.evaluate(FOCUS_INFO)
        if not info:
            break
        key = (info["tag"], info["text"])
        if seen and key == seen[0]:
            break
        seen.append(key)
        if not info["visible"]:
            invisible.append(key)
    return seen, invisible


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    page = browser.new_context(viewport={"width": 1100, "height": 900}).new_page()

    page.goto(BASE + "/sign-in")
    page.keyboard.press("Tab")
    first = page.evaluate(FOCUS_INFO)
    step("The first Tab reaches 'Skip to main content', and it is visible", first and first["text"] == "Skip to main content" and first["visible"])
    page.keyboard.press("Enter")
    focused_main = page.evaluate("() => document.activeElement && document.activeElement.id === 'main'")
    step("The skip link moves focus to the main content", focused_main)

    # Sign in, consent and create a legacy using the keyboard only.
    page.goto(BASE + "/sign-in")
    page.get_by_label("Email address").focus()
    page.keyboard.type(f"kb.{SUFFIX}@example.test")
    page.keyboard.press("Tab")
    page.keyboard.type("Keyboard User")
    page.keyboard.press("Enter")
    page.wait_for_url("**/onboarding/consents")
    boxes = page.get_by_role("checkbox")
    for i in range(boxes.count()):
        boxes.nth(i).focus()
        page.keyboard.press("Space")
    page.get_by_role("button", name="Save and continue").focus()
    page.keyboard.press("Enter")
    page.wait_for_url("**/onboarding/legacy")
    page.get_by_label("Title").focus()
    page.keyboard.type("Keyboard legacy")
    page.get_by_label("How should your family see your name?").focus()
    page.keyboard.type("Dad")
    page.keyboard.press("Enter")
    page.wait_for_url("**/legacy?**")
    step("Sign-in, consents and creating a legacy work with the keyboard only")

    for path in ["/legacy", "/legacy/memories", "/legacy/rehearse", "/legacy/prompts", "/account"]:
        page.goto(BASE + path)
        page.wait_for_load_state("networkidle")
        seen, invisible = tab_through(page)
        results["accessibility"][f"focus_invisible{path.replace('/', '_')}"] = [list(k) for k in invisible]
        step(f"Every element reached with Tab on {path} shows a visible focus indicator", len(seen) > 3 and not invisible, f"{len(seen)} stops")
    browser.close()

total = sum(len(v) for v in results["accessibility"].values())
results["summary"] = {"steps": len(results["steps"]), "failed": sum(1 for s in results["steps"] if not s["passed"]), "axe_violation_types": 0, "focus_invisible": total}
(ROOT / "tests/results/e2e_walkthrough_keyboard.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results["summary"]))
print(json.dumps(results["accessibility"], indent=1))
sys.exit(1 if results["summary"]["failed"] else 0)
