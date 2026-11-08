// Business case deck on the Airtel SYNC submission template backgrounds.
// Build: NODE_PATH=<dir with pptxgenjs, react-icons, react, react-dom, sharp> node build_deck.js
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");

const SKILL_THEME = process.env.APPLY_THEME; // path to apply_theme.js
const A = (f) => path.join(__dirname, "assets", f);
const OUT = process.env.DECK_OUT || path.join(__dirname, "Udyam_Digital_Business_Case.pptx");

const THEME = {
  name: "Udyam Digital",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1A1A1A", lt1: "FFFFFF", dk2: "5F6672", lt2: "F3F4F6",
    accent1: "D50F25", accent2: "11804A", accent3: "A05A00",
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
  pres.title = "Udyam Digital: business case";
  pres.author = "Team Udyam Digital";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  pres.defineSlideMaster({ title: "COVER", background: { path: A("template_cover.jpg") }, objects: [] });
  pres.defineSlideMaster({
    title: "CONTENT",
    background: { path: A("template_content.jpg") },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.7, w: 9.0, h: 0.62, fontSize: 20, bold: true, color: C.text1, align: "left", valign: "middle", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "source", type: "body", x: 0.5, y: 5.2, w: 7.2, h: 0.26, fontSize: 9, color: C.text2, valign: "middle", margin: 0 }, text: "" } },
    ],
    ...(process.env.NO_SLIDE_NUMBERS ? {} : { slideNumber: { x: 7.75, y: 5.2, w: 0.4, h: 0.26, fontSize: 9, color: C.text2, align: "right" } }),
  });

  const content = (section, title, source) => {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
    s.addText(title, { placeholder: "title" });
    if (source) s.addText(source, { placeholder: "source" });
    return s;
  };
  const card = (s, x, y, w, h, fill = C.background2, name = "card") =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08, objectName: name });
  const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, valign: "top", color: C.text1, ...o });

  // ---------- 1. Cover ----------
  pres.addSection({ title: "Cover" });
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Cover" });
    T(s, "Udyam Digital", { x: 0.65, y: 2.78, w: 4.4, h: 0.55, fontSize: 30, bold: true, color: C.background1, objectName: "Cover title" });
    T(s, "Find, buy and activate the right business bundle in one sitting: on a phone, in the owner's language", {
      x: 0.65, y: 3.38, w: 4.2, h: 0.75, fontSize: 14, color: C.background1, objectName: "Cover subtitle" });
    T(s, "Enterprise Track A  ·  Business case for NorthStar", { x: 0.65, y: 4.3, w: 4.4, h: 0.3, fontSize: 11, color: C.background2, objectName: "Cover track" });
    s.addNotes("Udyam Digital turns a 17-day, paper-heavy field sale into a single sitting on a phone: a GenAI advisor in the owner's language, one transparent monthly price, KYC in minutes, and a tracker instead of follow-up calls.");
  }

  // ---------- 2. Problem: funnel ----------
  pres.addSection({ title: "Problem" });
  {
    const s = content("Problem", "Only 7% of SMB leads activate, and most are lost long before KYC",
      "Source: smb_leads.csv, 5,000 leads, Apr–Jun 2026 (synthetic). % = conversion from previous stage.");
    s.addChart(pres.charts.BAR, [{
      name: "Leads",
      labels: ["Leads", "Contacted (68%)", "Needs assessed (58%)", "Quote accepted (44%)", "KYC complete (68%)", "Activated (63%)"],
      values: [5000, 3406, 1974, 861, 588, 368],
    }], {
      x: 0.45, y: 1.42, w: 5.75, h: 3.65, barDir: "bar", catAxisOrientation: "maxMin",
      chartColors: [HEX.accent1], barGapWidthPct: 45,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "#,##0", dataLabelColor: HEX.dk1, dataLabelFontSize: 11,
      dataLabelFontFace: "+mn-lt", catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: HEX.dk1, catAxisLabelFontSize: 11,
      valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, catAxisLineShow: false,
      showLegend: false, showTitle: true, title: "SMB funnel, one quarter", titleFontSize: 12, titleColor: HEX.dk2, titleFontFace: "+mn-lt",
      objectName: "Funnel chart",
    });
    const stats = [
      ["17.6 days", "from lead to activation, with 3 status-chase calls per customer"],
      ["₹15,053", "acquisition cost per activated SMB, vs a ₹6,900 median monthly bundle"],
      ["77%", "of owners prefer a language other than English; today's journey is English-first"],
    ];
    stats.forEach(([big, small], i) => {
      const y = 1.45 + i * 1.22;
      card(s, 6.45, y, 3.05, 1.08, C.background2, `Stat ${i + 1}`);
      T(s, big, { x: 6.65, y: y + 0.12, w: 2.7, h: 0.42, fontSize: 24, bold: true, color: C.accent1 });
      T(s, small, { x: 6.65, y: y + 0.55, w: 2.7, h: 0.48, fontSize: 11, color: C.text2 });
    });
    s.addNotes("4,632 of 5,000 leads drop. 3,026 are lost before a need is even assessed and another 1,113 after the needs visit. Activated customers wait 17.6 days and chase status 3 times. At ₹15k acquisition cost per activation against a ₹6,900 median bundle, the field-led model is too expensive for small businesses.");
  }

  // ---------- 3. Drop reasons -> fixes ----------
  {
    const s = content("Problem", "Every major drop reason maps to a step we can automate",
      "Source: smb_leads.csv drop_reason by last stage reached (top reasons shown).");
    const hdrY = 1.42;
    T(s, "Lost at stage", { x: 0.5, y: hdrY, w: 1.8, h: 0.22, fontSize: 10, bold: true, color: C.text2 });
    T(s, "Top reasons owners gave", { x: 2.45, y: hdrY, w: 3.8, h: 0.22, fontSize: 10, bold: true, color: C.text2 });
    T(s, "What Udyam Digital does", { x: 6.45, y: hdrY, w: 3.0, h: 0.22, fontSize: 10, bold: true, color: C.accent1 });
    const rows = [
      ["Lead", "1,594 lost", "Unreachable after 3 attempts (805) · Not interested on first call (470) · Wrong number (319)", "Owner starts the chat (QR, WhatsApp, web), so the number is verified and intent is real"],
      ["Contacted", "1,432 lost", "No time for a visit (531) · Locked in with provider (325) · Visit not scheduled (296)", "24×7 self-serve advisor in 10 languages: no visit needed"],
      ["Needs assessed", "1,113 lost", "Price too high (414) · Cheaper competitor (207) · Quote too complex (206) · Too slow (179)", "Instant quote, one monthly price, add-ons the owner can switch on and off"],
      ["Quote accepted", "273 lost", "Missing GST/Udyam doc (94) · Paperwork too long (79) · Details didn't match (47)", "Smart KYC: registry prefill, document AI, clear fix-it messages"],
      ["KYC complete", "220 lost", "Install delayed >21 days (98) · Cancelled before install (53) · Site not feasible (41)", "Feasibility checked before payment; live tracker with an ETA"],
    ];
    rows.forEach(([stage, lost, why, fix], i) => {
      const y = 1.72 + i * 0.67;
      card(s, 0.5, y, 9.0, 0.6, i % 2 ? C.background1 : C.background2, `Row ${stage}`);
      T(s, stage, { x: 0.62, y: y + 0.08, w: 1.7, h: 0.24, fontSize: 12, bold: true });
      T(s, lost, { x: 0.62, y: y + 0.32, w: 1.7, h: 0.22, fontSize: 10, color: C.text2 });
      T(s, why, { x: 2.45, y: y + 0.07, w: 3.8, h: 0.48, fontSize: 10.5, color: C.text1, valign: "middle" });
      T(s, fix, { x: 6.45, y: y + 0.07, w: 2.95, h: 0.48, fontSize: 10.5, bold: true, color: C.accent1, valign: "middle" });
    });
    s.addNotes("The biggest losses are not about product: owners can't be reached, have no time for a visit, find the quote too slow or complex, or drown in paperwork. Each of these is a step we replace with software.");
  }

  // ---------- 4. Segments ----------
  pres.addSection({ title: "Target customer" });
  {
    const s = content("Target customer", "Lead with professional offices; win micro retail with a digital starter",
      "Acquisition cost = all sales and partner spend in the segment ÷ activations. Payback = acquisition cost ÷ average monthly bundle.");
    s.addChart(pres.charts.BAR, [{ name: "Activation rate", labels: ["Micro retail", "Professional", "Multi-site", "Manufacturers"], values: [4.1, 11.1, 11.0, 12.8] }], {
      x: 0.45, y: 1.4, w: 3.6, h: 3.0, barDir: "col", chartColors: [HEX.accent1], barGapWidthPct: 55,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '0.0"%"', dataLabelColor: HEX.dk1, dataLabelFontSize: 11, dataLabelFontFace: "+mn-lt",
      catAxisLabelColor: HEX.dk1, catAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", valAxisHidden: true,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
      showTitle: true, title: "Lead → activation rate", titleFontSize: 12, titleColor: HEX.dk2, titleFontFace: "+mn-lt", objectName: "Activation by segment",
    });
    const H = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 10.5 } });
    const R = (cells, hi) => cells.map((t, j) => ({ text: t, options: { fontSize: 11, bold: j === 0 || (hi && j === 4), color: hi && j === 4 ? C.accent1 : C.text1, fill: { color: hi ? C.accent4 : C.background1 } } }));
    s.addTable([
      [H("Segment"), H("Share of leads"), H("Acq. cost / activation"), H("Avg bundle / mo"), H("Payback"), H("6-mo churn")],
      R(["Micro retail", "54%", "₹20,007", "₹2,505", "8.0 mo", "23%"]),
      R(["Professional offices", "25%", "₹10,695", "₹6,796", "1.6 mo", "14%"], true),
      R(["Multi-site", "15%", "₹15,614", "₹31,233", "0.5 mo", "11%"]),
      R(["Manufacturers", "6%", "₹15,324", "₹19,980", "0.8 mo", "8%"]),
    ], { x: 4.3, y: 1.48, w: 5.2, colW: [1.35, 0.7, 0.95, 0.85, 0.65, 0.7], rowH: 0.36, border: { type: "solid", pt: 0.5, color: "E4E6EB" }, valign: "middle", margin: 0.04, objectName: "Segment economics" });
    card(s, 4.3, 3.52, 5.2, 0.9, C.accent4, "Priority callout");
    T(s, [
      { text: "Priority: ", options: { bold: true, color: C.accent1 } },
      { text: "1) Professional offices, fully digital.  2) Micro retail with a ₹2.2k starter, digital only: acquisition cost must fall below ₹3k.  3) Multi-site and manufacturers through assisted sales: highest value per account." },
    ], { x: 4.45, y: 3.6, w: 4.95, h: 0.75, fontSize: 11, valign: "middle" });
    T(s, "Micro retail is half the leads but loses money today: ₹20k to acquire, ₹2.5k a month, 23% gone in 6 months.", { x: 0.5, y: 4.55, w: 9.0, h: 0.45, fontSize: 12, italic: true, color: C.text2 });
    s.addNotes("Professional offices convert at 11% and pay back acquisition in 1.6 months: the best fit for a self-serve journey. Micro retail is the volume prize but only works if acquisition cost drops below about ₹3k, which only a digital journey can do. Multi-site and manufacturers have the highest value and need a site survey, so they go to assisted sales with better leads.");
  }

  // ---------- 5. Bundles ----------
  {
    const s = content("Target customer", "Four bundles, each with one monthly price set by the rules engine",
      "Prices from product_catalogue.csv list prices, excluding 18% GST. Bundles generated by the prototype's rules engine for a typical profile.");
    const B = [
      ["Dukaan Starter", "Kirana, salon, pharmacy · 3 staff", "₹2,196", ["Biz Fibre 100", "2 business SIMs", "Cloud POS & billing", "Add CCTV: ₹199 per camera"], "12 months · setup ₹2,500", "Self-serve digital"],
      ["Clinic & Office Pro", "Clinic, CA firm · 8 staff", "₹4,592", ["Biz Fibre 300", "2 priority SIMs", "Email on own domain × 8", "Cloud backup 1 TB", "Endpoint security × 4"], "12 months · no setup fee", "Self-serve digital"],
      ["Multi-site One", "Restaurant/retail · 3 outlets", "₹28,045", ["Fibre 300 + 4G/5G failover per site", "Managed SD-WAN", "POS × 3, CCTV × 6", "Managed firewall"], "24 months · setup ₹49,800", "Digital + partner survey"],
      ["Factory Connect", "Small unit · 30 workers", "₹22,617", ["Leased line 20 Mbps, 99.5% SLA", "Machine IoT sensors × 6", "10 SIMs, email × 30", "Managed firewall"], "24 months · setup ₹32,000", "Assisted (feasibility)"],
    ];
    B.forEach(([name, who, price, items, terms, chan], i) => {
      const x = 0.5 + i * 2.3, y = 1.42, w = 2.1, h = 3.66;
      card(s, x, y, w, h, i < 2 ? C.background2 : C.background1, `Bundle ${name}`);
      if (i >= 2) s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { type: "none" }, line: { color: "D9DCE1", width: 0.75 }, rectRadius: 0.08, objectName: `Bundle outline ${i}` });
      T(s, name, { x: x + 0.15, y: y + 0.14, w: w - 0.3, h: 0.28, fontSize: 14, bold: true });
      T(s, who, { x: x + 0.15, y: y + 0.42, w: w - 0.3, h: 0.22, fontSize: 9.5, color: C.text2 });
      T(s, [{ text: price, options: { fontSize: 22, bold: true, color: C.accent1 } }, { text: " /mo", options: { fontSize: 10, color: C.text2 } }], { x: x + 0.15, y: y + 0.72, w: w - 0.3, h: 0.45 });
      T(s, items.map((t, k) => ({ text: t, options: { bullet: { indent: 10 }, breakLine: k < items.length - 1 } })), { x: x + 0.15, y: y + 1.25, w: w - 0.25, h: 1.55, fontSize: 10.5, paraSpaceAfter: 3 });
      T(s, terms, { x: x + 0.15, y: y + 2.86, w: w - 0.3, h: 0.22, fontSize: 9.5, color: C.text2 });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.15, y: y + 3.16, w: w - 0.3, h: 0.32, fill: { color: i < 2 ? C.accent1 : C.text1 }, line: { color: i < 2 ? C.accent1 : C.text1 }, rectRadius: 0.16, objectName: `Channel ${i}` });
      T(s, chan, { x: x + 0.15, y: y + 3.16, w: w - 0.3, h: 0.32, fontSize: 10, bold: true, color: C.background1, align: "center", valign: "middle" });
    });
    s.addNotes("The advisor never invents a price: a deterministic rules engine applies city tier, staff, site and GSTIN eligibility plus product dependencies, then the AI explains the result. The starter bundle matches what micro customers actually bought (fibre + SIMs + POS), at ₹2,196 a month. We propose spreading setup fees over the first 12 bills for micro customers.");
  }

  // ---------- 6. Journey ----------
  pres.addSection({ title: "Solution" });
  {
    const s = content("Solution", "From chat to activation on a phone: no visit, no paperwork",
      "Screens from the working prototype (Next.js + FastAPI + Gemini), shown in Hindi.");
    const P = [
      ["phone_advisor.png", "1  Advisor", "Chat or speak in Hindi or English; GenAI explains the bundle"],
      ["phone_quote.png", "2  Quote", "One monthly price; switch add-ons on and off, total updates live"],
      ["phone_kyc.png", "3  Smart KYC", "Consent, GSTIN/Udyam lookup, document AI, 15+ checks"],
      ["phone_track.png", "4  Tracker", "Live timeline and ETA; WhatsApp updates instead of calls"],
    ];
    P.forEach(([img, head, desc], i) => {
      const colX = 0.5 + i * 2.3, pw = 1.38, ph = pw * (1688 / 780), px = colX + (2.1 - pw) / 2, py = 1.4;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px - 0.06, y: py - 0.06, w: pw + 0.12, h: ph + 0.12, fill: { color: C.text1 }, line: { color: C.text1 }, rectRadius: 0.12, objectName: `Phone frame ${i + 1}` });
      s.addImage({ path: A(img), x: px, y: py, w: pw, h: ph, altText: `${head} screen of the prototype`, objectName: `Phone ${i + 1}` });
      T(s, head, { x: colX, y: py + ph + 0.12, w: 2.1, h: 0.24, fontSize: 12, bold: true, color: C.accent1, align: "center" });
      T(s, desc, { x: colX, y: py + ph + 0.36, w: 2.1, h: 0.42, fontSize: 9.5, color: C.text2, align: "center" });
    });
    s.addNotes("Demo flow: a Lucknow kirana owner types in Hindi. The advisor recommends fibre, 2 SIMs, POS and 2 cameras for ₹2,594 a month and explains why WhatsApp API needs a GSTIN. The owner tweaks the quote, consents, uploads 4 documents, gets an instant verdict and places the order. The tracker replaces the 3 status-chase calls.");
  }

  // ---------- 7. Smart KYC ----------
  {
    const s = content("Solution", "Smart KYC verifies a business in minutes and closes a compliance leak",
      "Results from running the prototype on the 12 specimen applicants (K01–K12) and on mock_gstin_registry.csv.");
    const icons = await Promise.all([fa.FaUserShield, fa.FaMagnifyingGlass, fa.FaFileLines, fa.FaListCheck, fa.FaCircleCheck].map((c) => icon(c, HEX.lt1)));
    const steps = [
      ["Consent first (DPDP Act)", "Purpose-wise consent, what we collect and never collect, retention, withdraw anytime"],
      ["Registry lookup", "GSTIN and Udyam checked live: status, legal name, address"],
      ["Document AI", "Gemini vision reads 4 documents; fixes OCR slips only if the check digit agrees"],
      ["15+ automatic checks", "Check digit, active status, names and addresses across documents, 90-day bill, ID expiry"],
      ["Instant verdict", "Approve, re-upload or reject, with a reason the owner understands"],
    ];
    steps.forEach(([h, d], i) => {
      const y = 1.42 + i * 0.73;
      s.addShape(pres.shapes.OVAL, { x: 0.5, y: y + 0.04, w: 0.46, h: 0.46, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `Step icon ${i + 1}` });
      s.addImage({ data: icons[i], x: 0.61, y: y + 0.15, w: 0.24, h: 0.24, altText: h, objectName: `Step glyph ${i + 1}` });
      T(s, h, { x: 1.12, y, w: 3.6, h: 0.26, fontSize: 12.5, bold: true });
      T(s, d, { x: 1.12, y: y + 0.26, w: 3.65, h: 0.42, fontSize: 10, color: C.text2 });
    });
    card(s, 5.0, 1.42, 4.5, 2.15, C.background2, "Results card");
    T(s, "12 applicants: 5 approved · 1 re-upload · 6 rejected", { x: 5.18, y: 1.55, w: 4.15, h: 0.28, fontSize: 12, bold: true });
    const caught = ["Cancelled GSTIN + blank Udyam number (K01)", "Udyam certificate missing (K05)", "One GSTIN digit changed: check digit fails (K06)", "Edited legal name on GST certificate (K07)", "Address proof 257 days old (K11)", "Blurred certificate: ask to re-upload (K04)"];
    T(s, caught.map((t, k) => ({ text: t, options: { bullet: { indent: 10 }, breakLine: k < caught.length - 1 } })), { x: 5.18, y: 1.95, w: 4.2, h: 1.5, fontSize: 10.5, paraSpaceAfter: 2 });
    card(s, 5.0, 3.72, 4.5, 1.32, C.accent4, "GST leak callout");
    T(s, "22", { x: 5.2, y: 3.72, w: 0.75, h: 1.32, fontSize: 36, bold: true, color: C.accent1, valign: "middle" });
    T(s, "customers activated last quarter had a cancelled or suspended GSTIN. A live registry check blocks this at sign-up.", { x: 6.0, y: 3.72, w: 3.35, h: 1.32, fontSize: 11.5, color: C.text1, valign: "middle" });
    s.addNotes("In the specimen set, OCR misread several GSTINs (O vs 0, S vs 5). We repair those only when the GSTIN check digit then passes, so a genuinely tampered digit (K06) is still rejected. Document images are discarded after verification; only extracted fields and the verdict are kept.");
  }

  // ---------- 8. Field force & partners ----------
  pres.addSection({ title: "Channels" });
  {
    const s = content("Channels", "Digital runs the routine sale; people win the complex accounts",
      "Acquisition cost per activation by lead source = total spend on leads from that source ÷ activations (smb_leads.csv).");
    s.addChart(pres.charts.BAR, [{ name: "Cost per activation", labels: ["Field sales", "Channel partner", "Website form", "Inbound call", "Referral", "WhatsApp"], values: [24335, 20851, 6352, 5113, 4099, 4026] }], {
      x: 0.45, y: 1.4, w: 4.3, h: 3.6, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [HEX.accent5], barGapWidthPct: 45,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '"₹"#,##0', dataLabelColor: HEX.dk1, dataLabelFontSize: 10.5, dataLabelFontFace: "+mn-lt",
      catAxisLabelColor: HEX.dk1, catAxisLabelFontSize: 10.5, catAxisLabelFontFace: "+mn-lt", valAxisHidden: true, catAxisLineShow: false,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
      showTitle: true, title: "Acquisition cost per activation", titleFontSize: 12, titleColor: HEX.dk2, titleFontFace: "+mn-lt", objectName: "CAC by channel",
    });
    const ic = await Promise.all([fa.FaMobileScreen, fa.FaHandshake, fa.FaUserTie].map((c) => icon(c, HEX.lt1)));
    const roles = [
      ["Self-serve digital", "Micro retail and professional offices (~80% of leads)", "Advisor, quote, KYC and tracker end to end. A person joins only if the owner asks."],
      ["Local channel partners", "Same leads, earned not lost", "Get every lead the advisor can't close, with context; earn commission on QR-code sign-ups; do installs."],
      ["Field sales", "Multi-site, manufacturers, leased lines", "Work a call list ranked by a propensity score; use the same app on a tablet for the quote and KYC."],
    ];
    roles.forEach(([h, sub, d], i) => {
      const y = 1.42 + i * 1.22;
      card(s, 5.0, y, 4.5, 1.1, C.background2, `Role ${h}`);
      s.addShape(pres.shapes.OVAL, { x: 5.15, y: y + 0.15, w: 0.46, h: 0.46, fill: { color: i === 0 ? C.accent1 : C.text1 }, line: { color: i === 0 ? C.accent1 : C.text1 }, objectName: `Role icon ${i}` });
      s.addImage({ data: ic[i], x: 5.26, y: y + 0.26, w: 0.24, h: 0.24, altText: h, objectName: `Role glyph ${i}` });
      T(s, h, { x: 5.75, y: y + 0.1, w: 3.6, h: 0.25, fontSize: 12.5, bold: true });
      T(s, sub, { x: 5.75, y: y + 0.34, w: 3.6, h: 0.2, fontSize: 9.5, color: C.accent1 });
      T(s, d, { x: 5.75, y: y + 0.56, w: 3.65, h: 0.5, fontSize: 10, color: C.text2 });
    });
    s.addNotes("Field sales and partners cost 4–6 times more per activation than digital and referral channels. Instead of competing with them, the journey hands them better work: partners are credited for digital sign-ups in their area and get the leads that need a human; field sales focus on multi-site and manufacturing accounts where a site survey is needed and the bundle is worth ₹20–30k a month.");
  }

  // ---------- 9. Metrics & value ----------
  pres.addSection({ title: "Value" });
  {
    const s = content("Value", "Five metrics define success; hitting them doubles activations",
      "Value per quarter assumes the same 5,000 leads; added revenue valued at the ₹6,900 median bundle (conservative vs the ₹12,351 average).");
    const H = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 10.5 } });
    const R = (a, b, c, d) => [
      { text: a, options: { bold: true, fontSize: 11 } }, { text: b, options: { fontSize: 11, color: C.text2 } },
      { text: c, options: { bold: true, fontSize: 11, color: C.accent1 } }, { text: d, options: { fontSize: 10, color: C.text2 } },
    ];
    s.addTable([
      [H("Metric"), H("Today"), H("12-mo target"), H("Main lever")],
      R("Lead → activation", "7.4%", "15%", "Self-serve advisor, instant quote"),
      R("Days lead → activation", "17.6", "5", "KYC in minutes, feasibility upfront"),
      R("Acquisition cost / activation", "₹15,053", "₹6,000", "Digital and partner-referral mix"),
      R("6-month churn (micro)", "23%", "12%", "Right-sized bundle, one bill"),
      R("Status-chase calls / customer", "3.0", "0.5", "Live tracker, WhatsApp alerts"),
    ], { x: 0.5, y: 1.45, w: 5.9, colW: [1.85, 0.8, 1.05, 2.2], rowH: 0.5, border: { type: "solid", pt: 0.5, color: "E4E6EB" }, valign: "middle", margin: 0.05, fill: { color: C.background1 }, objectName: "KPI table" });
    const V = [["+382", "activations per quarter (368 → 750)"], ["−₹10 lakh", "acquisition spend per quarter (₹55.4L → ₹45L)"], ["+₹26 lakh", "monthly recurring revenue added each quarter"]];
    V.forEach(([big, small], i) => {
      const y = 1.45 + i * 1.2;
      card(s, 6.7, y, 2.8, 1.06, i === 2 ? C.accent4 : C.background2, `Value ${i + 1}`);
      T(s, big, { x: 6.88, y: y + 0.12, w: 2.5, h: 0.42, fontSize: 24, bold: true, color: C.accent1 });
      T(s, small, { x: 6.88, y: y + 0.56, w: 2.5, h: 0.42, fontSize: 10.5, color: C.text2 });
    });
    s.addNotes("Targets are set from the data: 15% is what professional offices and manufacturers already reach; 5 days is the typical fibre install time in the catalogue; ₹6,000 sits between today's digital channels (₹4–6k) and partner-assisted deals. 750 activations at ₹6,000 costs ₹45 lakh, ₹10 lakh less than today, while 382 extra activations add about ₹26 lakh of monthly recurring revenue each quarter.");
  }

  // ---------- 10. Rollout & risks ----------
  pres.addSection({ title: "Rollout" });
  {
    const s = content("Rollout", "Pilot in four cities in 90 days, then scale language by language",
      "Pilot cities chosen from the highest-volume tier 1 and tier 2 cities for Hindi and Marathi speakers in smb_leads.csv.");
    const phases = [
      ["0–3 months · Pilot", "Mumbai, Pune, Nagpur, Lucknow", "Hindi, Marathi, English · partner QR codes · weekly funnel review"],
      ["3–6 months · Expand", "All tier 1 cities", "+6 languages · WhatsApp front end · back-office lead console"],
      ["6–12 months · Scale", "Tier 1 and tier 2 nationwide", "DigiLocker + e-sign live · pricing tests · propensity-led field sales"],
    ];
    phases.forEach(([h, where, what], i) => {
      const x = 0.5 + i * 3.05;
      card(s, x, 1.42, 2.85, 1.28, i === 0 ? C.accent4 : C.background2, `Phase ${i + 1}`);
      T(s, h, { x: x + 0.15, y: 1.52, w: 2.6, h: 0.26, fontSize: 12.5, bold: true, color: i === 0 ? C.accent1 : C.text1 });
      T(s, where, { x: x + 0.15, y: 1.8, w: 2.6, h: 0.24, fontSize: 11, bold: true });
      T(s, what, { x: x + 0.15, y: 2.08, w: 2.6, h: 0.55, fontSize: 10, color: C.text2 });
    });
    T(s, "Key risks and how the design contains them", { x: 0.5, y: 2.86, w: 9, h: 0.26, fontSize: 12, bold: true, color: C.text2 });
    const risks = [
      ["AI suggests a wrong or ineligible product", "The rules engine picks products and prices; the AI only explains. Judge-style scenarios run as tests"],
      ["Fake or misread documents", "Registry cross-check, GSTIN check digit, cross-document name match; human review when in doubt"],
      ["Field force or partners feel bypassed", "Partners credited for digital sign-ups in their area; complex leads routed to them with context"],
      ["Privacy and DPDP compliance", "Consent per purpose, images deleted after verification, IDs masked, audit log of consents"],
    ];
    risks.forEach(([r, m], i) => {
      const x = 0.5 + (i % 2) * 4.6, y = 3.18 + Math.floor(i / 2) * 0.95;
      card(s, x, y, 4.4, 0.85, C.background1, `Risk ${i + 1}`);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 4.4, h: 0.85, fill: { type: "none" }, line: { color: "D9DCE1", width: 0.75 }, rectRadius: 0.08, objectName: `Risk outline ${i + 1}` });
      T(s, r, { x: x + 0.15, y: y + 0.08, w: 4.1, h: 0.24, fontSize: 11, bold: true });
      T(s, m, { x: x + 0.15, y: y + 0.33, w: 4.1, h: 0.46, fontSize: 10, color: C.text2 });
    });
    s.addNotes("Ask: approve a 90-day pilot in four cities with partner participation, measured weekly on the five metrics. The prototype already runs the full journey; the pilot needs production integrations for GSTN/Udyam APIs, DigiLocker, e-sign and payment.");
  }

  await pres.writeFile({ fileName: OUT });
  if (SKILL_THEME) {
    const { applyTheme } = require(SKILL_THEME);
    await applyTheme(OUT, THEME);
  }
  console.log("wrote", OUT);
})();
