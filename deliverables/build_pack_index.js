// Contents and links page (page 8) of the detailed submission PDF.
// Build: NODE_PATH=<deps> APPLY_THEME=<pptx skill>/scripts/apply_theme.js node build_pack_index.js <out.pptx>
// The full pack is assembled by build_pack.py.
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");

const A = (f) => path.join(__dirname, "assets", f);
const OUT = process.argv[2] || path.join(__dirname, "pack_index.pptx");
const VIDEO = "https://youtu.be/fFOwhewZ7_E";
const REPO = "https://github.com/ploglabs/udyam-digital";
const BLOB = REPO + "/blob/main/";

const THEME = {
  name: "Udyam Digital", headFontFace: "Calibri", bodyFontFace: "Calibri",
  colors: {
    dk1: "1A1A1A", lt1: "FFFFFF", dk2: "5F6672", lt2: "F4F5F7",
    accent1: "D50F25", accent2: "11804A", accent3: "B86E00",
    accent4: "FDECEE", accent5: "2B2F36", accent6: "E7F5EE",
    hlink: "D50F25", folHlink: "8A0A18",
  },
};
const HEX = THEME.colors;

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Udyam Digital: submission pack contents";
  pres.author = "Team Udyam Digital";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  pres.defineSlideMaster({
    title: "CONTENT",
    background: { path: A("template_content.jpg") },
    objects: [
      { placeholder: { options: { name: "kicker", type: "body", x: 0.5, y: 0.66, w: 7.5, h: 0.22, fontSize: 10, bold: true, color: C.accent1, charSpacing: 1.5, valign: "middle", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.88, w: 9.0, h: 0.42, fontSize: 21, bold: true, color: C.text1, align: "left", valign: "middle", margin: 0 }, text: "" } },
    ],
  });
  const shadow = () => ({ type: "outer", color: "000000", blur: 8, offset: 1.5, angle: 90, opacity: 0.1 });
  const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, valign: "top", color: C.text1, ...o });
  const link = (text, url, o = {}) => ({ text, options: { hyperlink: { url, tooltip: url }, ...o } });

  pres.addSection({ title: "Contents" });
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Contents" });
  s.addText("SUBMISSION PACK", { placeholder: "kicker" });
  s.addText("Everything the case brief asks for, in one document", { placeholder: "title" });

  T(s, "CASE BRIEF DELIVERABLE  →  WHERE TO FIND IT", { x: 0.5, y: 1.45, w: 5.6, h: 0.2, fontSize: 9, bold: true, color: C.text2, charSpacing: 1 });
  const check = await icon(fa.FaCheck, HEX.lt1);
  const rows = [
    ["1", "Working prototype", "Demo video (2:15) and public code repository", [link("Watch the demo", VIDEO, { color: C.accent1, bold: true }), { text: "   ·   " }, link("Open the repo", REPO, { color: C.accent1, bold: true })]],
    ["2", "Solution architecture diagram", "Components and data flows, full page", [{ text: "Appendix B · page 12", options: { bold: true, color: C.accent1 } }]],
    ["3", "Business case (10 slides or fewer)", "Customer, value, pricing, rollout, risks", [{ text: "Pages 2–7 · Appendix A, pages 9–11", options: { bold: true, color: C.accent1 } }]],
    ["4", "1-page data privacy and security note", "Choices made against the DPDP Act, 2023", [{ text: "Appendix C · page 13", options: { bold: true, color: C.accent1 } }]],
  ];
  rows.forEach(([n, head, sub, where], i) => {
    const y = 1.73 + i * 0.83;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y, w: 5.6, h: 0.73, fill: { color: C.background1 }, line: { color: "E6E8EC", width: 0.75 }, rectRadius: 0.09, shadow: shadow(), objectName: `Deliverable ${n}` });
    s.addShape(pres.shapes.OVAL, { x: 0.64, y: y + 0.17, w: 0.4, h: 0.4, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `Deliverable badge ${n}` });
    s.addImage({ data: check, x: 0.74, y: y + 0.27, w: 0.2, h: 0.2, altText: "Done", objectName: `Deliverable check ${n}` });
    T(s, [{ text: n + "  ", options: { color: C.accent1 } }, { text: head }], { x: 1.18, y: y + 0.09, w: 4.8, h: 0.24, fontSize: 12.5, bold: true });
    T(s, sub, { x: 1.18, y: y + 0.33, w: 2.5, h: 0.32, fontSize: 9.5, color: C.text2 });
    T(s, where, { x: 3.6, y: y + 0.33, w: 2.4, h: 0.32, fontSize: 10, align: "right" });
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.35, y: 1.45, w: 3.15, h: 3.6, fill: { color: C.text1 }, line: { color: C.text1 }, rectRadius: 0.09, objectName: "Links card" });
  T(s, "LINKS", { x: 6.55, y: 1.6, w: 2.8, h: 0.2, fontSize: 9, bold: true, color: "FF5A6A", charSpacing: 1.5 });
  const L = [
    ["Demo video", "youtu.be/fFOwhewZ7_E", VIDEO],
    ["Code repository", "github.com/ploglabs/udyam-digital", REPO],
    ["How to run it", "README.md: API, web app, tests", BLOB + "README.md"],
    ["Architecture (PDF)", "deliverables/Architecture.pdf", BLOB + "deliverables/Architecture.pdf"],
    ["Privacy note (PDF)", "deliverables/Privacy_Note.pdf", BLOB + "deliverables/Privacy_Note.pdf"],
  ];
  L.forEach(([h, label, url], i) => {
    const y = 1.92 + i * 0.5;
    T(s, h, { x: 6.55, y, w: 2.8, h: 0.2, fontSize: 11, bold: true, color: C.background1 });
    T(s, [link(label, url, { color: "FF8A96" })], { x: 6.55, y: y + 0.21, w: 2.8, h: 0.2, fontSize: 9.5 });
  });
  T(s, "Stack: Next.js · FastAPI · Gemini 2.5 Flash · SQLite. All data synthetic.", { x: 6.55, y: 4.47, w: 2.8, h: 0.42, fontSize: 9, color: "C9CDD3" });
  T(s, "8", { x: 7.75, y: 5.2, w: 0.4, h: 0.24, fontSize: 9, color: C.text2, align: "right" });

  await pres.writeFile({ fileName: OUT });
  if (process.env.APPLY_THEME) await require(process.env.APPLY_THEME).applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
