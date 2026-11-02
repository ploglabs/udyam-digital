"""Browser test of the full journey at phone size (390x844).

Needs: API on :8000, web on :3000, `pip install playwright`, Google Chrome.
Run: python3 tests/e2e_journey.py   (screenshots go to $SHOTS_DIR, default ./e2e-shots)
Sends one real advisor message (uses Gemini quota); the rest is deterministic.
"""
import os
import sys
from playwright.sync_api import sync_playwright

OUT = os.environ.get("SHOTS_DIR", "e2e-shots")
os.makedirs(OUT, exist_ok=True)
BASE = os.environ.get("WEB_URL", "http://localhost:3000")
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))

    def shot(name, full=True):
        page.wait_for_timeout(700)  # let the fade-in animation finish
        page.screenshot(path=f"{OUT}/{name}.png", full_page=full)
        print("shot", name, file=sys.stderr)

    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    shot("01_home")

    # Advisor: one live chat message (Gemini), then use quick form for determinism
    page.click("text=Find my bundle")
    page.wait_for_url("**/advisor")
    page.click("text=Dental clinic in Pune, 8 staff")
    page.wait_for_selector("text=Saathi…", state="detached", timeout=90000)
    print("EN chat reply:", page.locator("div.rounded-tl-sm").last.inner_text()[:200].replace("\n", " "))
    shot("02_advisor_chat")

    page.click("text=Prefer a quick form?")
    page.click("text=Shop / kirana / salon")
    page.fill("input[type=number] >> nth=2", "2")  # cameras
    page.check("text=WhatsApp channel for customers")
    shot("03_quick_form")
    page.click("text=Get bundle")
    page.wait_for_url("**/quote")
    page.wait_for_selector("text=Total per month")
    page.wait_for_timeout(600)
    shot("04_quote")

    # Toggle an add-on and check the total changes
    before = page.locator("p.text-lg.font-bold").inner_text()
    page.locator("button:has-text('Secure Wi-Fi')").first.click()
    page.wait_for_timeout(900)
    after = page.locator("p.text-lg.font-bold").inner_text()
    print("total before/after add-on:", before.strip(), "->", after.strip())
    shot("05_quote_addon")

    page.click("text=Continue to KYC")
    page.wait_for_url("**/kyc")
    page.wait_for_selector("text=We never ask for")
    shot("06_consent")
    page.click("text=I agree, continue")
    page.wait_for_selector("text=GST certificate")

    # Rejected applicant first (K11, old address proof)
    page.select_option("select", "K11")
    page.wait_for_selector("text=4/4", timeout=30000)
    page.click("text=Verify documents")
    page.wait_for_selector("text=We couldn't verify", timeout=30000)
    shot("07_kyc_rejected")

    # Re-upload with a good applicant (K12)
    page.click("button:has-text('Replace') >> nth=-1")
    page.select_option("select", "K12")
    page.wait_for_timeout(500)
    page.wait_for_selector("text=4/4", timeout=30000)
    page.wait_for_timeout(1500)
    shot("08_kyc_docs")
    page.click("text=Verify documents")
    page.wait_for_selector("text=KYC approved", timeout=30000)
    page.fill("input[inputmode=numeric]", "9876543210")
    shot("09_kyc_approved")
    page.click("text=Place order")
    page.wait_for_url("**/track?id=*", timeout=30000)
    page.wait_for_selector("text=Expected activation")
    shot("10_track")
    for _ in range(3):
        page.click("text=Demo: move to next stage")
        page.wait_for_timeout(500)
    page.wait_for_selector("text=All services live")
    shot("11_track_activated")

    # Hindi toggle
    page.goto(BASE)
    page.click("text=हिं")
    page.wait_for_timeout(300)
    shot("12_home_hi", full=False)

    print("console errors:", errors or "none")
    b.close()
