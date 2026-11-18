"""
Browser walkthrough: deleting a whole legacy (AC-12). Usage: python3 tests/e2e/walkthrough_deletion.py [base_url]
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
AXE = ROOT / "node_modules/axe-core/axe.min.js"
SUFFIX = str(int(time.time()))
results = {"base_url": BASE, "steps": [], "accessibility": {}}


def step(name, ok=True, note=""):
    results["steps"].append({"step": name, "passed": bool(ok), "note": note})
    print(("PASS " if ok else "FAIL ") + name + (f" ({note})" if note else ""))


def axe(page, label):
    page.wait_for_load_state("networkidle")
    page.wait_for_function("document.title.length > 0")
    page.add_script_tag(path=str(AXE))
    results["accessibility"][label] = page.evaluate(
        """async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}))
           .violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help}))"""
    )


tmp = Path(tempfile.mkdtemp())
wav_path = tmp / "note.wav"
with wave.open(str(wav_path), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
    w.writeframes(b"".join(struct.pack("<h", int(8000 * math.sin(2 * math.pi * 330 * i / 8000))) for i in range(4000)))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    a = browser.new_context(viewport={"width": 1100, "height": 900}).new_page()
    a.goto(BASE + "/sign-in")
    a.get_by_label("Email address").fill(f"del.{SUFFIX}@example.test")
    a.get_by_label("Your name").fill("Test Author")
    a.get_by_role("button", name="Continue").click()
    a.wait_for_url("**/onboarding/consents")
    for i in range(a.get_by_role("checkbox").count()):
        a.get_by_role("checkbox").nth(i).check()
    a.get_by_role("button", name="Save and continue").click()
    a.wait_for_url("**/onboarding/legacy")
    a.get_by_label("Title").fill("Short-lived legacy")
    a.get_by_label("How should your family see your name?").fill("Dad")
    a.get_by_role("button", name="Create legacy").click()
    a.wait_for_url("**/legacy?**")
    a.goto(BASE + "/legacy/memories")
    a.get_by_label("Title").fill("A memory to delete")
    a.get_by_label("In your own words").fill("These words will be deleted.")
    with a.expect_navigation():
        a.get_by_role("button", name="Save and approve").click()
    item = a.url.split("?")[0]
    a.locator("#upload-file").set_input_files(str(wav_path))
    a.get_by_role("button", name="Upload", exact=True).click()
    expect(a.get_by_text("File saved exactly as uploaded.")).to_be_visible(timeout=15000)
    a.goto(item)
    src = a.locator("#media audio").first.get_attribute("src")
    step("Legacy with a memory and a recording exists", a.request.get(BASE + src).status == 200)

    a.goto(BASE + "/legacy")
    a.get_by_role("link", name="Delete this legacy").click()
    a.wait_for_url("**/legacy/delete")
    axe(a, "delete_page")
    step("Delete page explains what will be deleted and what is kept", "cannot be undone" in a.locator("main").inner_text() and "activity log" in a.locator("main").inner_text())

    a.get_by_label("Type the title of your legacy to confirm").fill("Short-lived legacy")
    a.get_by_label("I understand this permanently deletes my legacy and cannot be undone").check()
    a.get_by_role("button", name="Delete permanently").click()
    a.wait_for_url("**/mfa?**")
    step("Deletion asks for the second factor first")
    a.get_by_role("button", name="Simulate second-factor confirmation").click()
    a.wait_for_url("**/legacy/delete")
    a.get_by_label("Type the title of your legacy to confirm").fill("Wrong title")
    a.get_by_label("I understand this permanently deletes my legacy and cannot be undone").check()
    with a.expect_navigation():
        a.get_by_role("button", name="Delete permanently").click()
    step("A wrong title is refused and nothing is deleted", "exactly" in a.locator(".notice.error").inner_text() and a.request.get(BASE + src).status == 200)
    a.get_by_label("Type the title of your legacy to confirm").fill("Short-lived legacy")
    a.get_by_label("I understand this permanently deletes my legacy and cannot be undone").check()
    with a.expect_navigation():
        a.get_by_role("button", name="Delete permanently").click()
    a.wait_for_url("**/onboarding/legacy?ok=**")
    step("Deletion confirmed and the author can start again", "permanently deleted" in a.locator(".notice.ok").inner_text())
    step("The recording is gone", a.request.get(BASE + src).status == 404)
    browser.close()

total = sum(len(v) for v in results["accessibility"].values())
results["summary"] = {"steps": len(results["steps"]), "failed": sum(1 for s in results["steps"] if not s["passed"]), "axe_violation_types": total}
(ROOT / "tests/results/e2e_walkthrough_deletion.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results["summary"]))
print(json.dumps(results["accessibility"], indent=1))
sys.exit(1 if results["summary"]["failed"] or total else 0)
