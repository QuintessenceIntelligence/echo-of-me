"""
Browser walkthrough: a file larger than one request can carry is sent in pieces and stored exactly
(ADR-016). Usage: python3 tests/e2e/walkthrough_uploads.py [base_url]
"""
import hashlib
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
    for _ in range(50):
        if page.title():
            break
        page.wait_for_timeout(100)
    page.add_script_tag(path=str(AXE))
    results["accessibility"][label] = page.evaluate(
        """async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}))
           .violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help}))"""
    )


tmp = Path(tempfile.mkdtemp())
big = tmp / "long-story.wav"
with wave.open(str(big), "wb") as w:  # about 7.2 MB of synthetic tone: three pieces
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
    w.writeframes(b"".join(struct.pack("<h", int(6000 * math.sin(2 * math.pi * 220 * i / 8000))) for i in range(8000 * 450)))
big_bytes = big.read_bytes()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    a = browser.new_context(viewport={"width": 1100, "height": 900}).new_page()
    a.goto(BASE + "/sign-in")
    a.get_by_label("Email address").fill(f"up.{SUFFIX}@example.test")
    a.get_by_label("Your name").fill("Test Author")
    a.get_by_role("button", name="Continue").click()
    a.wait_for_url("**/onboarding/consents")
    for i in range(a.get_by_role("checkbox").count()):
        a.get_by_role("checkbox").nth(i).check()
    a.get_by_role("button", name="Save and continue").click()
    a.wait_for_url("**/onboarding/legacy")
    a.get_by_label("Title").fill("Long stories")
    a.get_by_label("How should your family see your name?").fill("Dad")
    a.get_by_role("button", name="Create legacy").click()
    a.wait_for_url("**/legacy?**")
    a.goto(BASE + "/legacy/memories")
    a.get_by_label("Title").fill("The long drive")
    a.get_by_label("In your own words").fill("A long story about a long drive.")
    with a.expect_navigation():
        a.get_by_role("button", name="Save and approve").click()
    item = a.url.split("?")[0]

    a.locator("#upload-file").set_input_files(str(big))
    a.get_by_role("button", name="Upload", exact=True).click()
    expect(a.get_by_text("File saved exactly as uploaded.")).to_be_visible(timeout=60000)
    step("A 7 MB recording is uploaded in pieces and confirmed", True, f"{len(big_bytes)} bytes")
    a.goto(item)
    axe(a, "memory_with_large_recording")
    src = a.locator("#media audio").first.get_attribute("src")
    got = a.request.get(BASE + src).body()
    step("The stored file is byte-for-byte the original", hashlib.sha256(got).hexdigest() == hashlib.sha256(big_bytes).hexdigest())
    browser.close()

total = sum(len(v) for v in results["accessibility"].values())
results["summary"] = {"steps": len(results["steps"]), "failed": sum(1 for s in results["steps"] if not s["passed"]), "axe_violation_types": total}
(ROOT / "tests/results/e2e_walkthrough_uploads.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results["summary"]))
print(json.dumps(results["accessibility"], indent=1))
sys.exit(1 if results["summary"]["failed"] or total else 0)
