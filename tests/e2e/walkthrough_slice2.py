"""
End-to-end walkthrough of vertical slice 2 (memory capture and provenance) in a real browser
(headless Chrome via Playwright, with Chrome's built-in fake microphone). Runs against a running app
(default http://localhost:3000). Also runs axe-core accessibility checks (WCAG 2.x A/AA) on each screen.

Usage: python3 tests/e2e/walkthrough_slice2.py [base_url]
Writes tests/results/e2e_walkthrough_slice2.json and screenshots to tests/results/screenshots/.
"""
import hashlib
import io
import json
import math
import struct
import sys
import tempfile
import time
import wave
import zipfile
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "tests/results/screenshots"
AXE = ROOT / "node_modules/axe-core/axe.min.js"
SUFFIX = str(int(time.time()))
TMP = Path(tempfile.mkdtemp(prefix="echo-e2e-"))
results = {"base_url": BASE, "steps": [], "accessibility": {}}


def step(name, ok=True, note=""):
    results["steps"].append({"step": name, "passed": bool(ok), "note": note})
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


def make_wav(path, seconds=1.0, freq=440, rate=16000):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(9000 * math.sin(2 * math.pi * freq * i / rate))) for i in range(int(seconds * rate))))
    return path.read_bytes()


def sha(b):
    return hashlib.sha256(b).hexdigest()


def notice_ok(page):
    return page.locator(".notice.ok").first.inner_text()


def sign_in(page, email, name):
    page.goto(BASE + "/sign-in")
    page.get_by_label("Email address").fill(email)
    page.get_by_label("Your name").fill(name)
    page.get_by_role("button", name="Continue").click()


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/usr/bin/google-chrome",
        args=["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    )
    ctx = browser.new_context(viewport={"width": 1100, "height": 900}, permissions=["microphone"], accept_downloads=True)
    a = ctx.new_page()

    # ---------------- Author set-up (all optional consents given)
    sign_in(a, f"mum.{SUFFIX}@example.test", "Test Author")
    a.wait_for_url("**/onboarding/consents")
    for i in range(a.get_by_role("checkbox").count()):
        a.get_by_role("checkbox").nth(i).check()
    a.get_by_role("button", name="Save and continue").click()
    a.wait_for_url("**/onboarding/legacy")
    a.get_by_label("Title").fill("Letters for my children")
    a.get_by_label("How should your family see your name?").fill("Mum")
    a.get_by_role("button", name="Create legacy").click()
    a.wait_for_url("**/legacy?**")
    a.evaluate("document.querySelectorAll('#recipients details').forEach(d => d.open = true)")
    a.get_by_label("Name", exact=True).first.fill("Asha")
    a.get_by_label("Email (adults only, needed to invite them)").fill(f"asha.{SUFFIX}@example.test")
    a.get_by_role("button", name="Add recipient").click()
    a.wait_for_url("**/legacy?ok=**")
    step("Author set up with all consents and one adult recipient")

    # ---------------- Create a draft memory
    a.get_by_role("link", name="Add your first memory").click()
    a.wait_for_url("**/legacy/memories")
    axe(a, "memories_empty")
    a.get_by_label("Title").fill("The day I failed my driving test")
    a.get_by_label("When did this happen? (optional)").fill("1998")
    a.get_by_label("In your own words").fill("I failed twice. My father told me to slow down and never give up. The third time I passed.")
    a.get_by_role("button", name="Save as draft").click()
    a.wait_for_url("**/legacy/memories/*?ok=**")
    memory_url = a.url.split("?")[0]
    memory_id = memory_url.rsplit("/", 1)[1]
    step("Draft saved and clearly marked as not used in answers", a.get_by_text("Draft, not used in answers").first.is_visible())
    step("Written words labelled 'In your own words' (P2)", a.locator("#words .prov.p2").is_visible())

    # ---------------- Record in the browser (fake microphone)
    a.get_by_role("button", name="Start recording").click()
    expect(a.get_by_role("button", name="Stop")).to_be_visible()
    a.wait_for_timeout(2200)
    a.get_by_role("button", name="Stop").click()
    a.get_by_role("button", name="Save recording").click()
    expect(a.get_by_text("Recording saved exactly as recorded.")).to_be_visible(timeout=15000)
    a.goto(memory_url)
    audio = a.locator("#media .media-item audio")
    step("In-browser recording saved and playable on the page", audio.count() == 1)
    rec_src = audio.first.get_attribute("src")
    rec_sha_shown = a.locator("#media .media-item .mono").first.inner_text().replace("sha256", "").strip()
    resp = a.request.get(BASE + rec_src)
    rec_bytes = resp.body()
    step(
        "Recording served byte-identical to its stored fingerprint (AC-03)",
        resp.status == 200 and sha(rec_bytes) == rec_sha_shown == resp.headers.get("x-echo-sha256") and rec_bytes[:4] == b"\x1a\x45\xdf\xa3",
        f"{len(rec_bytes)} bytes, {resp.headers.get('content-type')}",
    )

    # ---------------- Upload a WAV file, and a disguised file
    wav_path = TMP / "voice-note.wav"
    wav_bytes = make_wav(wav_path)
    a.locator("#upload-file").set_input_files(str(wav_path))
    a.get_by_role("button", name="Upload", exact=True).click()
    expect(a.get_by_text("File saved exactly as uploaded.")).to_be_visible(timeout=15000)
    a.goto(memory_url)
    srcs = [a.locator("#media .media-item audio").nth(i).get_attribute("src") for i in range(a.locator("#media .media-item audio").count())]
    uploaded = [a.request.get(BASE + s).body() for s in srcs]
    step("Uploaded WAV returned byte-identical (AC-03)", any(b == wav_bytes for b in uploaded), f"{len(srcs)} recordings")

    fake = TMP / "song.mp3"
    fake.write_bytes(b"this is not really an mp3 file, it is plain text")
    a.locator("#upload-file").set_input_files(str(fake))
    a.get_by_role("button", name="Upload", exact=True).click()
    expect(a.locator("form .notice.error")).to_contain_text("not supported", timeout=15000)
    step("A file whose bytes are not audio or a photo is refused, whatever its name")

    # ---------------- Transcript: unapproved (P6) then approved (P3)
    a.goto(memory_url)
    first = a.locator("#media .media-item").first
    first.locator("textarea").fill("I failed twice. Slow down, never give up.")
    with a.expect_navigation():
        first.get_by_role("button", name="Save transcript", exact=True).click()
    first = a.locator("#media .media-item").first
    step("Saved transcript is marked unapproved, never used in answers (AC-04)", first.locator(".prov.p6").count() >= 1)
    with a.expect_navigation():
        first.get_by_role("button", name="Approve transcript version 1 as it is").click()
    step("Approved transcript is labelled 'Transcript you approved' (P3)", a.locator("#media .media-item").first.locator(".prov.p3").count() == 1)

    # ---------------- Tags: automatic suggestions wait for the author
    with a.expect_navigation():
        a.get_by_role("button", name="Suggest themes automatically").click()
    sugg = a.locator("#tags .tag.suggested")
    step("Automatic theme suggestions shown as unapproved", sugg.count() >= 2, f"{sugg.count()} suggestions: {sugg.all_inner_texts()}")
    axe(a, "memory_detail_with_suggestions")
    shot(a, "07_memory_detail")
    first_label = sugg.first.inner_text().split(": ", 1)[1]
    with a.expect_navigation():
        a.get_by_role("button", name=f"Accept suggestion {first_label}").click()
    second_label = a.locator("#tags .tag.suggested").first.inner_text().split(": ", 1)[1]
    with a.expect_navigation():
        a.get_by_role("button", name=f"Reject suggestion {second_label}").click()
    a.get_by_label("Tag type").select_option("person")
    a.get_by_label("Tag", exact=True).fill("Grandpa Joe")
    with a.expect_navigation():
        a.get_by_role("button", name="Add tag").click()
    tags_text = a.locator("#tags").inner_text()
    step("Accept, reject and own tags recorded", f"Theme: {first_label}" in tags_text and "Person: Grandpa Joe" in tags_text and f"Rejected suggestions (not suggested again): {second_label}" in tags_text)

    # ---------------- Intended audience and sensitivity
    a.locator("#settings").get_by_label("Asha").check()
    with a.expect_navigation():
        a.get_by_role("button", name="Save who this is for").click()
    step("Intended recipient saved, with a clear 'nothing shared' message", "Nothing has been shared" in notice_ok(a))
    a.locator("#settings").get_by_label("This is sensitive (handle with extra care)").check()
    with a.expect_navigation():
        a.get_by_role("button", name="Save sensitivity").click()
    step("Sensitivity flag saved", a.locator(".item-meta .pill.warn", has_text="Sensitive").count() >= 1)

    # ---------------- Approval, then an edit returns it to draft
    with a.expect_navigation():
        a.get_by_role("button", name="Approve version 1").click()
    step("Item approved", a.get_by_text("You approved version 1").is_visible())
    a.evaluate("document.querySelectorAll('#words details').forEach(d => d.open = true)")
    a.locator("#e-body").fill("I failed twice. My father told me to slow down and never give up. The third time I passed, and I cried.")
    with a.expect_navigation():
        a.get_by_role("button", name="Save new version as draft").click()
    step("Editing creates version 2 and returns the item to draft (AC-05 rule)", a.get_by_role("button", name="Approve version 2").is_visible() and a.get_by_text("Earlier versions (1)").is_visible())
    with a.expect_navigation():
        a.get_by_role("button", name="Approve version 2").click()

    # ---------------- A value statement saved and approved in one step
    a.goto(BASE + "/legacy/memories")
    a.get_by_label("A value or belief you hold").check()
    a.get_by_label("Title").fill("Honesty")
    a.get_by_label("In your own words").fill("Tell the truth, even when it costs you.")
    with a.expect_navigation():
        a.get_by_role("button", name="Save and approve").click()
    a.goto(BASE + "/legacy/memories")
    axe(a, "memories_list")
    shot(a, "08_memories_list")
    step("List shows two approved items", a.locator(".item-list li").count() == 2 and a.locator(".item-list .pill.good").count() == 2)

    # ---------------- Export: needs the second factor; ZIP verifies
    a.goto(BASE + "/legacy/export")
    axe(a, "export")
    a.get_by_role("button", name="Download export").click()
    a.wait_for_url("**/mfa?**")
    step("Export asks for the second factor first")
    a.get_by_role("button", name="Simulate second-factor confirmation").click()
    a.wait_for_url("**/legacy/export")
    with a.expect_download() as dl:
        a.get_by_role("button", name="Download export").click()
    zpath = TMP / dl.value.suggested_filename
    dl.value.save_as(str(zpath))
    z = zipfile.ZipFile(zpath)
    bad = z.testzip()
    sums = z.read("echo-of-me-export/SHA256SUMS").decode().strip().splitlines()
    sums_ok = all(sha(z.read("echo-of-me-export/" + line.split("  ", 1)[1])) == line.split("  ", 1)[0] for line in sums)
    manifest = json.loads(z.read("echo-of-me-export/legacy.json"))
    originals = [z.read(n) for n in z.namelist() if n.startswith("echo-of-me-export/originals/")]
    mem = next(m for m in manifest["memories"] if m["id"] == memory_id)
    step(
        "Export ZIP is valid; every original matches its fingerprint; recording and WAV byte-identical (AC-03, AC-12 start)",
        bad is None and sums_ok and wav_bytes in originals and rec_bytes in originals and len(sums) == 2,
        f"{dl.value.suggested_filename}, {len(z.namelist())} entries",
    )
    step(
        "Export holds both versions, transcript provenance, tag decisions and the intended recipient",
        [v["version"] for v in mem["versions"]] == [1, 2]
        and any(md["transcript"] and md["transcript"]["provenance"] == "P3_approved_transcript" for md in mem["media"])
        and any(t["state"] == "rejected" for t in mem["tags"])
        and len(mem["intended_for_recipient_ids"]) == 1,
    )

    # ---------------- Activity log
    a.goto(BASE + "/legacy/activity")
    log = a.locator("table").inner_text()
    step("Activity log records capture, approval, transcript, tags and export without content",
         all(s in log for s in ["Recording or photo added", "Approved", "Transcript approved", "Suggestion rejected", "Export downloaded"])
         and "slow down" not in log)

    # ---------------- Another family cannot reach any of it
    other = browser.new_context()
    b = other.new_page()
    sign_in(b, f"other.{SUFFIX}@example.test", "Other Author")
    b.wait_for_url("**/onboarding/consents")
    r = b.request.get(BASE + rec_src)
    b.goto(memory_url)
    step("Another signed-in person gets 'not found' for the recording and the memory page",
         r.status == 404 and "/legacy/memories/" + memory_id not in b.url)
    signed_out = browser.new_context().request.get(BASE + rec_src)
    step("Signed-out request for a recording is refused", signed_out.status == 404)
    other.close()

    # ---------------- Permanent deletion
    a.goto(memory_url)
    a.locator("#delete").get_by_label("I understand this cannot be undone").check()
    a.get_by_role("button", name="Delete permanently").click()
    a.wait_for_url("**/legacy/memories?ok=**")
    gone = a.request.get(BASE + rec_src)
    step("Deleted item disappears with its recordings", a.locator(".item-list li").count() == 1 and gone.status == 404)
    browser.close()

total_violations = sum(len(v) for v in results["accessibility"].values())
results["summary"] = {
    "steps": len(results["steps"]),
    "failed": sum(1 for s in results["steps"] if not s["passed"]),
    "axe_violation_types": total_violations,
}
(ROOT / "tests/results/e2e_walkthrough_slice2.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results["summary"]))
print(json.dumps(results["accessibility"], indent=1))
sys.exit(1 if results["summary"]["failed"] or total_violations else 0)
