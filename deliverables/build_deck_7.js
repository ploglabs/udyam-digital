// 7-slide submission deck on the Airtel SYNC template backgrounds.
// Build: NODE_PATH=<dir with pptxgenjs, react-icons, react, react-dom, sharp> APPLY_THEME=<pptx skill>/scripts/apply_theme.js node build_deck_7.js
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");

const SKILL_THEME = process.env.APPLY_THEME;
const A = (f) => path.join(__dirname, "assets", f);
const OUT = path.join(__dirname, "hooray_VITChennai.pptx");
const VIDEO = "https://youtu.be/fFOwhewZ7_E";
const REPO = "https://github.com/ploglabs/udyam-digital";

const THEME = {
  name: "Udyam Digital",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
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
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625, same as the template
  pres.title = "Udyam Digital: submission deck";
  pres.author = "Team hooray, VIT Chennai";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  pres.defineSlideMaster({ title: "COVER", background: { path: A("template_cover.jpg") }, objects: [] });
  pres.defineSlideMaster({
    title: "CONTENT",
    background: { path: A("template_content.jpg") },
    objects: [
      { placeholder: { options: { name: "kicker", type: "body", x: 0.5, y: 0.66, w: 7.5, h: 0.22, fontSize: 10, bold: true, color: C.accent1, charSpacing: 1.5, valign: "middle", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.88, w: 9.0, h: 0.42, fontSize: 21, bold: true, color: C.text1, align: "left", valign: "middle", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "source", type: "body", x: 0.5, y: 5.2, w: 7.2, h: 0.24, fontSize: 8, color: C.text2, valign: "middle", margin: 0 }, text: "" } },
    ],
    slideNumber: { x: 7.75, y: 5.2, w: 0.4, h: 0.24, fontSize: 9, color: C.text2, align: "right" },
  });

  const shadow = () => ({ type: "outer", color: "000000", blur: 8, offset: 1.5, angle: 90, opacity: 0.1 });
  const content = (section, kicker, title, source) => {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
    s.addText(kicker.toUpperCase(), { placeholder: "kicker" });
    s.addText(title, { placeholder: "title" });
    if (source) s.addText(source, { placeholder: "source" });
    return s;
  };
  const card = (s, x, y, w, h, fill = C.background1, name = "card", lifted = true) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, fill: { color: fill }, line: { color: fill === C.background1 ? "E6E8EC" : fill, width: 0.75 },
      rectRadius: 0.09, objectName: name, ...(lifted ? { shadow: shadow() } : {}),
    });
  const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, valign: "top", color: C.text1, ...o });
  const badge = (s, data, x, y, d, fill, name) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: name });
    const g = d * 0.5;
    s.addImage({ data, x: x + (d - g) / 2, y: y + (d - g) / 2, w: g, h: g, altText: name, objectName: name + " glyph" });
  };
  const chartText = { catAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", titleFontFace: "+mn-lt", catAxisLabelColor: HEX.dk1, dataLabelColor: HEX.dk1, catAxisLabelFontSize: 10, dataLabelFontSize: 10, titleFontSize: 11, titleColor: HEX.dk2 };
  const W = (c) => icon(c, HEX.lt1);

  // ---------- 1. Cover ----------
  pres.addSection({ title: "Cover" });
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Cover" });
    T(s, "Team hooray  ·  VIT Chennai", { x: 0.65, y: 5.16, w: 4.4, h: 0.26, fontSize: 11, bold: true, color: C.background1, objectName: "Cover team" });
    T(s, "ENTERPRISE TRACK A", { x: 0.65, y: 2.5, w: 4.4, h: 0.25, fontSize: 11, bold: true, color: "FF5A6A", charSpacing: 2 });
    T(s, "Udyam Digital", { x: 0.65, y: 2.78, w: 4.4, h: 0.58, fontSize: 32, bold: true, color: C.background1, objectName: "Cover title" });
    T(s, "Find, buy and activate the right business bundle in one sitting: on a phone, in the owner's language", {
      x: 0.65, y: 3.4, w: 4.1, h: 0.7, fontSize: 14, color: C.background1, objectName: "Cover subtitle" });
    const pills = ["GenAI advisor", "Instant quote", "Smart KYC", "Live tracker"];
    pills.forEach((p, i) => {
      const x = 0.65 + i * 1.05;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.28, w: 0.97, h: 0.28, fill: { color: "FFFFFF", transparency: 85 }, line: { color: "FFFFFF", transparency: 55, width: 0.75 }, rectRadius: 0.14, objectName: `Cover pill ${i + 1}` });
      T(s, p, { x, y: 4.28, w: 0.97, h: 0.28, fontSize: 9, bold: true, color: C.background1, align: "center", valign: "middle" });
    });
    const links = [["Watch the demo (2:15)", VIDEO, 2.0, C.accent1], ["GitHub: ploglabs/udyam-digital", REPO, 2.1, "FFFFFF"]];
    let lx = 0.65;
    links.forEach(([label, url, w, fill], i) => {
      const red = i === 0;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: lx, y: 4.72, w, h: 0.34, fill: { color: red ? fill : "FFFFFF", transparency: red ? 0 : 88 }, line: { color: red ? fill : "FFFFFF", transparency: red ? 0 : 40, width: 0.75 }, rectRadius: 0.17, objectName: `Cover link ${i + 1}` });
      T(s, [{ text: label, options: { hyperlink: { url, tooltip: url }, color: "FFFFFF", bold: true } }], { x: lx, y: 4.72, w, h: 0.34, fontSize: 10, align: "center", valign: "middle" });
      lx += w + 0.12;
    });
    s.addNotes("Udyam Digital turns a 17-day, paper-heavy field sale into a single sitting on a phone: a GenAI advisor in the owner's language, one transparent monthly price, KYC in minutes, and a tracker instead of follow-up calls. Business case for NorthStar's SMB arm.");
  }

  // ---------- 2. Problem ----------
  pres.addSection({ title: "Problem" });
  {
    const s = content("Problem", "The problem", "Only 7% of SMB leads activate, and each big drop is fixable",
      "Source: smb_leads.csv, 5,000 leads, Apr–Jun 2026 (synthetic). % = conversion from the previous stage.");
    card(s, 0.5, 1.45, 4.25, 3.6, C.background1, "Funnel card");
    s.addChart(pres.charts.BAR, [{
      name: "Leads",
      labels: ["Leads", "Contacted (68%)", "Needs assessed (58%)", "Quote accepted (44%)", "KYC complete (68%)", "Activated (63%)"],
      values: [5000, 3406, 1974, 861, 588, 368],
    }], {
      x: 0.6, y: 1.55, w: 4.05, h: 3.4, barDir: "bar", catAxisOrientation: "maxMin",
      chartColors: [HEX.accent1], barGapWidthPct: 40,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "#,##0", ...chartText,
      valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, catAxisLineShow: false,
      showLegend: false, showTitle: true, title: "SMB funnel, one quarter", objectName: "Funnel chart",
    });

    const stats = [["17.6 days", "lead to activation"], ["₹15,053", "to acquire one SMB"], ["77%", "prefer a non-English language"]];
    stats.forEach(([big, small], i) => {
      const x = 5.0 + i * 1.53;
      card(s, x, 1.45, 1.44, 0.92, C.accent4, `Stat ${i + 1}`, false);
      T(s, big, { x: x + 0.12, y: 1.53, w: 1.25, h: 0.4, fontSize: 19, bold: true, color: C.accent1 });
      T(s, small, { x: x + 0.12, y: 1.93, w: 1.25, h: 0.36, fontSize: 9.5, color: C.text1 });
    });

    const ic = await Promise.all([fa.FaComments, fa.FaBolt, fa.FaIdCard, fa.FaTruckFast].map(W));
    const rows = [
      ["3,026 lost", "before needs: unreachable, no time for a visit", "Owner starts a 24×7 chat in 10 languages"],
      ["1,113 lost", "after needs: price too high, quote too complex", "Instant quote, one monthly price"],
      ["273 lost", "at quote: missing documents, long paperwork", "Smart KYC with registry prefill"],
      ["220 lost", "after KYC: install delays and cancellations", "Feasibility upfront, live tracker"],
    ];
    rows.forEach(([lost, why, fix], i) => {
      const y = 2.5 + i * 0.65;
      card(s, 5.0, y, 4.5, 0.57, C.background1, `Drop ${i + 1}`);
      badge(s, ic[i], 5.1, y + 0.1, 0.37, C.accent1, `Drop icon ${i + 1}`);
      T(s, [{ text: lost + " ", options: { bold: true, color: C.accent1 } }, { text: why, options: { color: C.text2 } }], { x: 5.58, y: y + 0.06, w: 3.85, h: 0.22, fontSize: 9.5 });
      T(s, "→  " + fix, { x: 5.58, y: y + 0.29, w: 3.85, h: 0.22, fontSize: 11, bold: true });
    });
    s.addNotes("4,632 of 5,000 leads drop. 3,026 are lost before a need is even assessed and another 1,113 after the needs visit. Activated customers wait 17.6 days and chase status 3 times. At ₹15k acquisition cost per activation against a ₹6,900 median bundle, the field-led model is too expensive for small businesses. The biggest losses are not about product; each is a step we replace with software.");
  }

  // ---------- 3. Target customer & pricing ----------
  pres.addSection({ title: "Customer and pricing" });
  {
    const s = content("Customer and pricing", "Target customer and pricing", "Lead with professional offices; win micro retail with a ₹2.2k digital starter",
      "Acq. cost = sales and partner spend in segment ÷ activations; payback = acq. cost ÷ avg monthly bundle. Bundle prices: catalogue list prices excl. 18% GST.");
    card(s, 0.5, 1.45, 4.25, 3.6, C.background1, "Segment card");
    s.addChart(pres.charts.BAR, [{ name: "Activation rate", labels: ["Micro retail", "Professional", "Multi-site", "Manufacturers"], values: [4.1, 11.1, 11.0, 12.8] }], {
      x: 0.6, y: 1.52, w: 4.05, h: 1.85, barDir: "col", chartColors: [HEX.accent1], barGapWidthPct: 60,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '0.0"%"', ...chartText, valAxisHidden: true,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
      showTitle: true, title: "Lead → activation rate by segment", objectName: "Activation by segment",
    });
    const H = (t) => ({ text: t, options: { bold: true, color: C.text2, fontSize: 9, fill: { color: C.background2 } } });
    const R = (cells, hi) => cells.map((t, j) => ({ text: t, options: { fontSize: 10, bold: j === 0 || (hi && j >= 3), color: hi && j >= 2 ? C.accent1 : C.text1, fill: { color: hi ? C.accent4 : C.background1 } } }));
    s.addTable([
      [H("Segment"), H("Leads"), H("Acq. cost"), H("Payback"), H("Churn 6 mo")],
      R(["Micro retail", "54%", "₹20,007", "8.0 mo", "23%"]),
      R(["Professional", "25%", "₹10,695", "1.6 mo", "14%"], true),
      R(["Multi-site", "15%", "₹15,614", "0.5 mo", "11%"]),
      R(["Manufacturers", "6%", "₹15,324", "0.8 mo", "8%"]),
    ], { x: 0.65, y: 3.47, w: 3.95, colW: [1.15, 0.55, 0.8, 0.7, 0.75], rowH: 0.29, border: { type: "solid", pt: 0.5, color: "E6E8EC" }, valign: "middle", margin: 0.04, objectName: "Segment economics" });

    const B = [
      ["Dukaan Starter", "Kirana, salon, pharmacy", "₹2,196", "Fibre 100 · 2 SIMs · cloud POS", "Self-serve", fa.FaStore],
      ["Clinic & Office Pro", "Clinic, CA firm · 8 staff", "₹4,592", "Fibre 300 · email · backup · security", "Self-serve", fa.FaBriefcaseMedical],
      ["Multi-site One", "Restaurants, 3 outlets", "₹28,045", "SD-WAN · failover · POS · CCTV", "Digital + survey", fa.FaShop],
      ["Factory Connect", "Small unit · 30 workers", "₹22,617", "Leased line · IoT sensors · firewall", "Assisted", fa.FaIndustry],
    ];
    const bi = await Promise.all(B.map((b, i) => icon(b[5], i < 2 ? HEX.accent1 : HEX.dk1)));
    B.forEach(([name, who, price, items, chan], i) => {
      const x = 4.95 + (i % 2) * 2.3, y = 1.45 + Math.floor(i / 2) * 1.85, w = 2.15, h = 1.75;
      card(s, x, y, w, h, C.background1, `Bundle ${name}`);
      s.addImage({ data: bi[i], x: x + 0.15, y: y + 0.15, w: 0.26, h: 0.26, altText: name, objectName: `Bundle icon ${i + 1}` });
      T(s, name, { x: x + 0.5, y: y + 0.13, w: w - 0.6, h: 0.3, fontSize: 12, bold: true, valign: "middle" });
      T(s, who, { x: x + 0.15, y: y + 0.5, w: w - 0.3, h: 0.2, fontSize: 9, color: C.text2 });
      T(s, [{ text: price, options: { fontSize: 20, bold: true, color: i < 2 ? C.accent1 : C.text1 } }, { text: " /mo", options: { fontSize: 9.5, color: C.text2 } }], { x: x + 0.15, y: y + 0.72, w: w - 0.3, h: 0.4, valign: "middle" });
      T(s, items, { x: x + 0.15, y: y + 1.12, w: w - 0.3, h: 0.22, fontSize: 9, color: C.text1 });
      const fill = i < 2 ? C.accent1 : C.text1;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.15, y: y + 1.4, w: 1.15, h: 0.24, fill: { color: fill }, line: { color: fill }, rectRadius: 0.12, objectName: `Channel ${i + 1}` });
      T(s, chan, { x: x + 0.15, y: y + 1.4, w: 1.15, h: 0.24, fontSize: 8.5, bold: true, color: C.background1, align: "center", valign: "middle" });
    });
    s.addNotes("Professional offices convert at 11% and pay back acquisition in 1.6 months: the best fit for a self-serve journey. Micro retail is half the leads but loses money today (₹20k to acquire, ₹2.5k a month, 23% churn) and only works if acquisition cost drops below about ₹3k, which only a digital journey can do. Multi-site and manufacturers go to assisted sales. Prices are never invented by the AI: a deterministic rules engine applies city tier, staff, sites, GSTIN eligibility and dependencies; the AI explains the result.");
  }

  // ---------- 4. Solution: journey + KYC ----------
  pres.addSection({ title: "Solution" });
  {
    const s = content("Solution", "The solution", "From chat to activation on a phone: no visit, no paperwork",
      "Screens from the working prototype (Next.js + FastAPI + Gemini), shown in Hindi. KYC results from the 12 specimen applicants K01–K12.");
    card(s, 0.5, 1.45, 5.55, 3.6, C.background2, "Journey panel", false);
    const P = [
      ["phone_advisor.png", "1  Advisor", "Chat in Hindi or English"],
      ["phone_quote.png", "2  Quote", "One price, live add-ons"],
      ["phone_kyc.png", "3  Smart KYC", "Consent, lookup, doc AI"],
      ["phone_track.png", "4  Tracker", "Live ETA, WhatsApp alerts"],
    ];
    P.forEach(([img, head, desc], i) => {
      const colX = 0.6 + i * 1.34, pw = 1.18, ph = pw * (1688 / 780), px = colX + (1.34 - pw) / 2, py = 1.6;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px - 0.05, y: py - 0.05, w: pw + 0.1, h: ph + 0.1, fill: { color: C.text1 }, line: { color: C.text1 }, rectRadius: 0.1, shadow: shadow(), objectName: `Phone frame ${i + 1}` });
      s.addImage({ path: A(img), x: px, y: py, w: pw, h: ph, altText: `${head} screen of the prototype`, objectName: `Phone ${i + 1}` });
      T(s, head, { x: colX, y: py + ph + 0.14, w: 1.34, h: 0.22, fontSize: 11, bold: true, color: C.accent1, align: "center" });
      T(s, desc, { x: colX, y: py + ph + 0.37, w: 1.34, h: 0.2, fontSize: 9, color: C.text2, align: "center" });
    });
    T(s, [{ text: "Watch the full journey: youtu.be/fFOwhewZ7_E", options: { hyperlink: { url: VIDEO, tooltip: "Demo video" }, color: C.accent1, bold: true } }], { x: 0.6, y: 4.72, w: 5.35, h: 0.24, fontSize: 10, align: "center", valign: "middle" });

    card(s, 6.25, 1.45, 3.25, 2.2, C.background1, "KYC results card");
    T(s, "Smart KYC: 12 applicants, instant verdicts", { x: 6.4, y: 1.55, w: 3.0, h: 0.24, fontSize: 11, bold: true });
    s.addChart(pres.charts.DOUGHNUT, [{ name: "Verdicts", labels: ["Approved", "Re-upload", "Rejected"], values: [5, 1, 6] }], {
      x: 6.32, y: 1.85, w: 1.15, h: 1.15, holeSize: 58, chartColors: [HEX.accent2, HEX.accent3, HEX.accent1],
      showLegend: false, showValue: false, showPercent: false, showLabel: false, showTitle: false, objectName: "KYC verdicts",
    });
    const V = [["5", "approved", C.accent2], ["1", "re-upload (blurred)", C.accent3], ["6", "rejected", C.accent1]];
    V.forEach(([n, l, col], i) => T(s, [{ text: n + "  ", options: { bold: true, fontSize: 14, color: col } }, { text: l, options: { fontSize: 10, color: C.text1 } }], { x: 7.6, y: 1.92 + i * 0.34, w: 1.85, h: 0.3, valign: "middle" }));
    T(s, "Caught: cancelled GSTIN, tampered check digit, edited legal name, 257-day-old bill, missing Udyam", { x: 6.4, y: 3.1, w: 3.0, h: 0.45, fontSize: 9, color: C.text2 });

    card(s, 6.25, 3.8, 3.25, 1.25, C.text1, "GST leak callout", false);
    T(s, "22", { x: 6.42, y: 3.8, w: 0.85, h: 1.25, fontSize: 36, bold: true, color: "FF5A6A", valign: "middle" });
    T(s, "customers activated last quarter had a cancelled or suspended GSTIN. A live registry check blocks this at sign-up.", { x: 7.25, y: 3.8, w: 2.15, h: 1.25, fontSize: 10, color: C.background1, valign: "middle" });
    s.addNotes("Demo flow: a Lucknow kirana owner types in Hindi. The advisor recommends fibre, 2 SIMs, POS and 2 cameras and explains why WhatsApp API needs a GSTIN. The owner tweaks the quote, gives purpose-wise consent (DPDP Act), uploads 4 documents and gets an instant verdict from 15+ checks: check digit, registry status, cross-document name and address match, bill age, ID expiry. OCR slips are repaired only when the GSTIN check digit then passes, so a tampered digit is still rejected. Images are deleted after verification.");
  }

  // ---------- 5. Architecture + privacy ----------
  pres.addSection({ title: "Architecture and privacy" });
  {
    const s = content("Architecture and privacy", "Solution architecture and data privacy", "AI explains, rules decide, and personal data stays minimal",
      "Solid boxes run in the prototype; dashed box = production integrations. Full diagram and 1-page privacy note: annexure and GitHub (deliverables/).");
    const box = (x, y, w, h, fill, name, dashed) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, fill: { color: fill }, line: { color: dashed ? "9AA0A8" : (fill === C.background1 ? "DDE0E5" : fill), width: 0.75, ...(dashed ? { dashType: "dash" } : {}) }, rectRadius: 0.07, objectName: name });
    const head = (t, sub, x, y, w, col = C.text1) => {
      T(s, t, { x, y, w, h: 0.2, fontSize: 10, bold: true, color: col });
      if (sub) T(s, sub, { x, y: y + 0.2, w, h: 0.17, fontSize: 7.5, color: C.text2 });
    };
    const arrow = (x, y, w, name) => s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: HEX.dk2, width: 1.25, beginArrowType: "triangle", endArrowType: "triangle" }, objectName: name });

    // Column 1: owner's phone
    box(0.5, 1.45, 1.4, 3.1, C.background1, "Phone column");
    head("Owner's phone", "Next.js · EN / हिंदी", 0.6, 1.53, 1.25);
    ["Advisor chat", "Live quote", "Consent + KYC", "Order tracker"].forEach((t, i) => {
      box(0.6, 2.0 + i * 0.4, 1.2, 0.32, C.accent4, `Phone screen ${i + 1}`);
      T(s, t, { x: 0.6, y: 2.0 + i * 0.4, w: 1.2, h: 0.32, fontSize: 8.5, bold: true, color: C.accent1, align: "center", valign: "middle" });
    });
    box(0.6, 3.68, 1.2, 0.78, C.text1, "Partner desk");
    T(s, [{ text: "Partner desk", options: { bold: true, fontSize: 8.5, breakLine: true } }, { text: "callback queue, win-back list by propensity", options: { fontSize: 7.5 } }],
      { x: 0.66, y: 3.72, w: 1.1, h: 0.7, color: C.background1, valign: "middle" });

    arrow(1.92, 3.0, 0.26, "Phone to API");
    T(s, "HTTPS", { x: 1.86, y: 2.78, w: 0.38, h: 0.16, fontSize: 6.5, color: C.text2, align: "center" });

    // Column 2: FastAPI backend
    box(2.2, 1.45, 2.4, 3.1, C.background2, "Backend column");
    head("FastAPI backend", "Python · 31 automated tests", 2.3, 1.53, 2.2);
    const mods = [
      ["Advisor", "LLM asks, explains; never prices"],
      ["Rules engine", "eligibility, price, GST, ETA"],
      ["Registry lookup", "GSTIN + Udyam status"],
      ["Consent ledger", "per purpose; withdraw erases"],
      ["Smart KYC", "vision extract + 15 checks"],
      ["Orders + tracker", "only after KYC passes"],
    ];
    mods.forEach(([h, d], i) => {
      const x = 2.3 + (i % 2) * 1.12, y = 2.0 + Math.floor(i / 2) * 0.62;
      box(x, y, 1.06, 0.54, C.background1, `Module ${h}`);
      T(s, h, { x: x + 0.07, y: y + 0.06, w: 0.95, h: 0.18, fontSize: 8.5, bold: true, color: i === 4 ? C.accent1 : C.text1 });
      T(s, d, { x: x + 0.07, y: y + 0.25, w: 0.95, h: 0.26, fontSize: 7, color: C.text2 });
    });
    box(2.3, 3.9, 2.2, 0.56, C.background1, "Leads module");
    T(s, [{ text: "Leads + propensity score", options: { bold: true, fontSize: 8.5, breakLine: true } }, { text: "every quote is a lead; AUC 0.71 ranks who to call", options: { fontSize: 7, color: C.text2 } }],
      { x: 2.37, y: 3.94, w: 2.08, h: 0.48, valign: "middle" });

    arrow(4.62, 3.0, 0.26, "API to services");

    // Column 3: services and data
    const svc = [
      ["Gemini 2.5 Flash", "chat with tool calls; document vision", 0.62],
      ["SQLite", "consents, KYC fields (no images), orders, leads", 0.62],
      ["Synthetic data", "catalogue, GSTIN + Udyam registries, 5,000 leads", 0.62],
    ];
    let sy = 1.45;
    svc.forEach(([h, d, hh], i) => {
      box(4.9, sy, 1.42, hh, C.background1, `Service ${i + 1}`);
      T(s, h, { x: 4.98, y: sy + 0.06, w: 1.3, h: 0.18, fontSize: 8.5, bold: true, color: i === 0 ? C.accent1 : C.text1 });
      T(s, d, { x: 4.98, y: sy + 0.25, w: 1.3, h: 0.34, fontSize: 7, color: C.text2 });
      sy += hh + 0.08;
    });
    box(4.9, sy, 1.42, 4.55 - sy, C.background1, "Production swaps", true);
    T(s, [{ text: "In production", options: { bold: true, fontSize: 8.5, breakLine: true } }, { text: "GSTN/Udyam APIs · DigiLocker · e-sign · WhatsApp · UPI autopay", options: { fontSize: 7, color: C.text2 } }],
      { x: 4.98, y: sy + 0.06, w: 1.3, h: 4.45 - sy, valign: "top" });

    T(s, [{ text: "Design rule  ", options: { bold: true, color: C.accent1 } }, { text: "Gemini talks and reads documents; deterministic code prices, checks and approves. No AI-invented price or verdict." }],
      { x: 0.5, y: 4.67, w: 5.82, h: 0.36, fontSize: 9, valign: "middle" });

    // Privacy panel
    card(s, 6.5, 1.45, 3.0, 3.6, C.text1, "Privacy panel", false);
    T(s, "PRIVACY AND SECURITY", { x: 6.68, y: 1.56, w: 2.7, h: 0.2, fontSize: 9, bold: true, color: "FF5A6A", charSpacing: 1 });
    T(s, "Designed against the DPDP Act, 2023", { x: 6.68, y: 1.77, w: 2.7, h: 0.2, fontSize: 9, color: "C9CDD3" });
    const pi = await Promise.all([fa.FaClipboardCheck, fa.FaFilter, fa.FaImage, fa.FaMask, fa.FaScaleBalanced, fa.FaKey].map((c) => icon(c, HEX.lt1)));
    const P = [
      ["Consent first", "per purpose, before upload; withdrawal erases data"],
      ["Collect the minimum", "never Aadhaar, PAN, bank details or photos"],
      ["Images never stored", "fields extracted, then the image is dropped"],
      ["Masked everywhere", "GSTIN, Udyam and phone masked in UI, API, logs"],
      ["AI never decides", "verdicts come from rule checks, with reasons"],
      ["Locked-down access", "partner desk behind a key; upload type and size limits"],
    ];
    P.forEach(([h, d], i) => {
      const y = 2.1 + i * 0.49;
      s.addShape(pres.shapes.OVAL, { x: 6.68, y: y + 0.03, w: 0.3, h: 0.3, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `Privacy icon ${i + 1}` });
      s.addImage({ data: pi[i], x: 6.755, y: y + 0.105, w: 0.15, h: 0.15, altText: h, objectName: `Privacy glyph ${i + 1}` });
      T(s, h, { x: 7.1, y, w: 2.3, h: 0.19, fontSize: 9.5, bold: true, color: C.background1 });
      T(s, d, { x: 7.1, y: y + 0.19, w: 2.3, h: 0.26, fontSize: 7.5, color: "C9CDD3" });
    });
    s.addNotes("Three tiers: a mobile web app in English and Hindi, a FastAPI backend, and Gemini plus SQLite. The rule that keeps it safe: the LLM gathers the profile and explains, but a deterministic rules engine sets every price and deterministic checks give every KYC verdict. Privacy is designed against the DPDP Act: purpose-wise consent before any upload, minimal data, document images dropped after extraction, identifiers masked, and withdrawal erases KYC data. The full architecture diagram and the 1-page privacy note are in the annexure.");
  }

  // ---------- 6. Channels ----------
  pres.addSection({ title: "Channels" });
  {
    const s = content("Channels", "Go-to-market", "Digital runs the routine sale; people win the complex accounts",
      "Acquisition cost per activation by lead source = spend on leads from that source ÷ activations (smb_leads.csv). Propensity: logistic regression, holdout.");
    card(s, 0.5, 1.45, 4.25, 3.6, C.background1, "CAC card");
    s.addChart(pres.charts.BAR, [{ name: "Cost per activation", labels: ["Field sales", "Channel partner", "Website form", "Inbound call", "Referral", "WhatsApp"], values: [24335, 20851, 6352, 5113, 4099, 4026] }], {
      x: 0.6, y: 1.55, w: 4.05, h: 3.4, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [HEX.accent1, HEX.accent1, HEX.accent5, HEX.accent5, HEX.accent5, HEX.accent5], barGapWidthPct: 40,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '"₹"#,##0', ...chartText, valAxisHidden: true, catAxisLineShow: false,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
      showTitle: true, title: "Acquisition cost per activation, by lead source", objectName: "CAC by channel",
    });
    const ic = await Promise.all([fa.FaMobileScreen, fa.FaHandshake, fa.FaUserTie].map(W));
    const roles = [
      ["Self-serve digital", "Micro retail and professional offices · ~80% of leads", "Advisor, quote, KYC and tracker end to end. A person joins only when the owner asks."],
      ["Local channel partners", "Credited, not bypassed", "Partner desk shows the live callback queue and win-back list; commission on QR sign-ups."],
      ["Field sales", "Multi-site, manufacturers, leased lines", "Call list ranked by a propensity score: AUC 0.71, 1.9× lift in the top decile."],
    ];
    roles.forEach(([h, sub, d], i) => {
      const y = 1.45 + i * 1.23;
      card(s, 4.95, y, 4.55, 1.12, C.background1, `Role ${h}`);
      badge(s, ic[i], 5.1, y + 0.17, 0.48, i === 0 ? C.accent1 : C.text1, `Role icon ${i + 1}`);
      T(s, h, { x: 5.75, y: y + 0.12, w: 3.65, h: 0.25, fontSize: 12.5, bold: true });
      T(s, sub, { x: 5.75, y: y + 0.37, w: 3.65, h: 0.2, fontSize: 9.5, bold: true, color: C.accent1 });
      T(s, d, { x: 5.75, y: y + 0.6, w: 3.65, h: 0.45, fontSize: 10, color: C.text2 });
    });
    s.addNotes("Field sales and partners cost 4–6 times more per activation than digital and referral channels. Instead of competing with them, the journey hands them better work: partners are credited for digital sign-ups in their area and get leads that need a human through the partner desk (callback queue, win-back list); field sales focus on multi-site and manufacturing accounts, worked in propensity order.");
  }

  // ---------- 6. Value ----------
  pres.addSection({ title: "Value" });
  {
    const s = content("Value", "Value and success metrics", "Five metrics define success; hitting them doubles activations",
      "Targets are 12-month. Value per quarter assumes the same 5,000 leads; added revenue valued at the ₹6,900 median bundle (conservative vs ₹12,351 average).");
    const ic = await Promise.all([fa.FaArrowTrendUp, fa.FaClock, fa.FaIndianRupeeSign, fa.FaUserCheck, fa.FaPhoneSlash].map(W));
    const K = [
      ["Lead → activation", "Self-serve advisor, instant quote", "7.4%", "15%"],
      ["Days to activate", "KYC in minutes, feasibility upfront", "17.6", "5"],
      ["Acquisition cost", "Digital and partner-referral mix", "₹15,053", "₹6,000"],
      ["6-month churn (micro)", "Right-sized bundle, one bill", "23%", "12%"],
      ["Status-chase calls", "Live tracker, WhatsApp alerts", "3.0", "0.5"],
    ];
    T(s, "TODAY", { x: 3.85, y: 1.45, w: 0.95, h: 0.18, fontSize: 8.5, bold: true, color: C.text2, align: "center", charSpacing: 1 });
    T(s, "TARGET", { x: 5.05, y: 1.45, w: 1.0, h: 0.18, fontSize: 8.5, bold: true, color: C.accent1, align: "center", charSpacing: 1 });
    K.forEach(([m, lever, today, target], i) => {
      const y = 1.7 + i * 0.68;
      card(s, 0.5, y, 5.65, 0.6, C.background1, `KPI ${i + 1}`);
      badge(s, ic[i], 0.62, y + 0.1, 0.4, C.accent1, `KPI icon ${i + 1}`);
      T(s, m, { x: 1.15, y: y + 0.07, w: 2.65, h: 0.24, fontSize: 12, bold: true });
      T(s, lever, { x: 1.15, y: y + 0.31, w: 2.65, h: 0.2, fontSize: 9, color: C.text2 });
      T(s, today, { x: 3.85, y, w: 0.95, h: 0.6, fontSize: 13, color: C.text2, align: "center", valign: "middle" });
      T(s, "→", { x: 4.8, y, w: 0.25, h: 0.6, fontSize: 13, color: C.text2, align: "center", valign: "middle" });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.1, y: y + 0.12, w: 0.92, h: 0.36, fill: { color: C.accent4 }, line: { color: C.accent4 }, rectRadius: 0.18, objectName: `Target pill ${i + 1}` });
      T(s, target, { x: 5.1, y: y + 0.12, w: 0.92, h: 0.36, fontSize: 13, bold: true, color: C.accent1, align: "center", valign: "middle" });
    });
    const V = [["+382", "activations per quarter", "368 → 750"], ["−₹10 lakh", "acquisition spend per quarter", "₹55.4L → ₹45L"], ["+₹26 lakh", "new monthly revenue each quarter", "382 × ₹6,900 median bundle"]];
    V.forEach(([big, small, how], i) => {
      const y = 1.45 + i * 1.23;
      const dark = i === 2;
      card(s, 6.4, y, 3.1, 1.12, dark ? C.accent1 : C.background1, `Value ${i + 1}`);
      T(s, big, { x: 6.6, y: y + 0.12, w: 2.75, h: 0.45, fontSize: 26, bold: true, color: dark ? C.background1 : C.accent1 });
      T(s, small, { x: 6.6, y: y + 0.6, w: 2.75, h: 0.22, fontSize: 10.5, bold: true, color: dark ? C.background1 : C.text1 });
      T(s, how, { x: 6.6, y: y + 0.83, w: 2.75, h: 0.2, fontSize: 9, color: dark ? C.background1 : C.text2 });
    });
    s.addNotes("Targets are set from the data: 15% is what professional offices and manufacturers already reach; 5 days is the typical fibre install time in the catalogue; ₹6,000 sits between today's digital channels (₹4–6k) and partner-assisted deals. 750 activations at ₹6,000 costs ₹45 lakh, ₹10 lakh less than today, while 382 extra activations add about ₹26 lakh of monthly recurring revenue each quarter.");
  }

  // ---------- 7. Rollout & risks ----------
  pres.addSection({ title: "Rollout" });
  {
    const s = content("Rollout", "Rollout and risks", "Pilot in four cities in 90 days, then scale language by language",
      "Pilot cities: highest-volume tier 1 and tier 2 cities for Hindi and Marathi speakers in smb_leads.csv.");
    const phases = [
      ["0–3 MONTHS", "Pilot", "Mumbai, Pune, Nagpur, Lucknow", "Hindi, Marathi, English · partner QR codes · weekly funnel review"],
      ["3–6 MONTHS", "Expand", "All tier 1 cities", "+6 languages · WhatsApp front end · partner desk at scale"],
      ["6–12 MONTHS", "Scale", "Tier 1 and 2 nationwide", "DigiLocker + e-sign · pricing tests · propensity-led field sales"],
    ];
    phases.forEach(([when, h, where, what], i) => {
      const x = 0.5 + i * 3.08, w = 2.85, first = i === 0;
      card(s, x, 1.45, w, 1.22, first ? C.accent1 : C.background1, `Phase ${i + 1}`);
      T(s, when, { x: x + 0.15, y: 1.54, w: 1.3, h: 0.2, fontSize: 8.5, bold: true, charSpacing: 1, color: first ? C.background1 : C.accent1 });
      T(s, h, { x: x + 1.4, y: 1.52, w: 1.3, h: 0.24, fontSize: 12.5, bold: true, align: "right", color: first ? C.background1 : C.text1 });
      T(s, where, { x: x + 0.15, y: 1.8, w: w - 0.3, h: 0.22, fontSize: 11, bold: true, color: first ? C.background1 : C.text1 });
      T(s, what, { x: x + 0.15, y: 2.05, w: w - 0.3, h: 0.5, fontSize: 9.5, color: first ? C.background1 : C.text2 });
      if (i < 2) T(s, "›", { x: x + w, y: 1.45, w: 0.23, h: 1.22, fontSize: 22, bold: true, color: C.accent1, align: "center", valign: "middle" });
    });

    T(s, "KEY RISKS AND HOW THE DESIGN CONTAINS THEM", { x: 0.5, y: 2.82, w: 9, h: 0.2, fontSize: 9, bold: true, color: C.text2, charSpacing: 1 });
    const ic = await Promise.all([fa.FaRobot, fa.FaFileShield, fa.FaUsers, fa.FaUserLock].map((c) => icon(c, HEX.accent1)));
    const risks = [
      ["AI suggests a wrong product", "Rules engine picks products and prices; AI only explains"],
      ["Fake or misread documents", "Registry cross-check, check digit, name match, human review"],
      ["Partners feel bypassed", "Credited for digital sign-ups; complex leads routed to them"],
      ["Privacy and DPDP Act", "Consent per purpose, images deleted, IDs masked, audit log"],
    ];
    risks.forEach(([r, m], i) => {
      const x = 0.5 + (i % 2) * 4.6, y = 3.08 + Math.floor(i / 2) * 0.68;
      card(s, x, y, 4.4, 0.6, C.background1, `Risk ${i + 1}`);
      s.addShape(pres.shapes.OVAL, { x: x + 0.12, y: y + 0.11, w: 0.38, h: 0.38, fill: { color: C.accent4 }, line: { color: C.accent4 }, objectName: `Risk badge ${i + 1}` });
      s.addImage({ data: ic[i], x: x + 0.21, y: y + 0.2, w: 0.2, h: 0.2, altText: r, objectName: `Risk icon ${i + 1}` });
      T(s, r, { x: x + 0.62, y: y + 0.07, w: 3.7, h: 0.22, fontSize: 11, bold: true });
      T(s, m, { x: x + 0.62, y: y + 0.31, w: 3.7, h: 0.22, fontSize: 9.5, color: C.text2 });
    });
    card(s, 0.5, 4.5, 9.0, 0.55, C.text1, "Ask", false);
    T(s, [{ text: "The ask  ", options: { bold: true, color: "FF5A6A" } }, { text: "Approve a 90-day, four-city pilot with partners, tracked weekly on the five metrics.", options: { color: C.background1 } }],
      { x: 0.7, y: 4.5, w: 5.9, h: 0.55, fontSize: 11, valign: "middle" });
    T(s, [
      { text: "Demo video", options: { hyperlink: { url: VIDEO, tooltip: VIDEO }, color: "FF5A6A", bold: true } },
      { text: "   ·   ", options: { color: C.background1 } },
      { text: "Code on GitHub", options: { hyperlink: { url: REPO, tooltip: REPO }, color: "FF5A6A", bold: true } },
    ], { x: 6.7, y: 4.5, w: 2.65, h: 0.55, fontSize: 11, align: "right", valign: "middle" });
    s.addNotes("The pilot needs production integrations for GSTN/Udyam APIs, DigiLocker, e-sign and payment. Everything else (advisor, rules engine, KYC checks, tracker, partner desk) is in the working prototype.");
  }

  await pres.writeFile({ fileName: OUT });
  if (SKILL_THEME) {
    const { applyTheme } = require(SKILL_THEME);
    await applyTheme(OUT, THEME);
  }
  console.log("wrote", OUT);
})();
