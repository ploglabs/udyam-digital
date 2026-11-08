"""Build the submission files.

Udyam_Digital_Submission.pptx  cover + 7 evaluated slides (PPT upload slot)
Udyam_Digital_Submission.pdf   same 8 slides + annexure (PDF upload slot;
                               the annexure is reference only, not evaluated):
    1-8    cover + 7 slides
    9      annexure contents and links
    10-12  detailed business case (drop reasons, bundles, Smart KYC)
    13     solution architecture, full page
    14     data privacy and security note, full page

Needs: node deps (pptxgenjs, react-icons, react, react-dom, sharp) on NODE_PATH,
APPLY_THEME=<pptx skill>/scripts/apply_theme.js, SOFFICE (command that converts
pptx to pdf, default "soffice"), google-chrome, pypdf.
Run: python3 build_pack.py
"""
import os
import shlex
import subprocess
import tempfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter

HERE = Path(__file__).resolve().parent
SOFFICE = shlex.split(os.environ.get("SOFFICE", "soffice"))
APPENDIX_A = [3, 5, 7]  # slides of the 10-slide business case (1-based)


def run(cmd, **env):
    subprocess.run(cmd, check=True, cwd=HERE, env={**os.environ, **env})


def to_pdf(pptx, outdir):
    run(SOFFICE + ["--headless", "--convert-to", "pdf", "--outdir", str(outdir), str(pptx)])
    return Path(outdir) / (Path(pptx).stem + ".pdf")


def chrome_pdf(html, pdf):
    run(["google-chrome", "--headless", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={pdf}", (HERE / html).as_uri()])


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    deck = HERE / "Udyam_Digital_Submission.pptx"
    run(["node", "build_deck_7.js"])
    run(["node", "build_pack_index.js", str(tmp / "index.pptx")])
    run(["node", "build_deck.js"], DECK_OUT=str(tmp / "business_case.pptx"), NO_SLIDE_NUMBERS="1")
    chrome_pdf("architecture.html", HERE / "Architecture.pdf")
    chrome_pdf("privacy_note.html", HERE / "Privacy_Note.pdf")

    parts = [
        ("Submission deck", PdfReader(to_pdf(deck, tmp)).pages),
        ("Annexure: contents and links", PdfReader(to_pdf(tmp / "index.pptx", tmp)).pages),
        ("Annexure: detailed business case", [PdfReader(to_pdf(tmp / "business_case.pptx", tmp)).pages[i - 1] for i in APPENDIX_A]),
        ("Annexure: solution architecture", PdfReader(HERE / "Architecture.pdf").pages),
        ("Annexure: data privacy and security", PdfReader(HERE / "Privacy_Note.pdf").pages),
    ]
    w = PdfWriter()
    for title, pages in parts:
        first = len(w.pages)
        for p in pages:
            w.add_page(p)
        w.add_outline_item(title, first)
    w.add_metadata({"/Title": "Udyam Digital: submission pack", "/Author": "Team Udyam Digital"})
    out = HERE / "Udyam_Digital_Submission.pdf"
    with open(out, "wb") as f:
        w.write(f)
    print("wrote", out, len(w.pages), "pages")
