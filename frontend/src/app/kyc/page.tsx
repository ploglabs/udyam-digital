"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BottomBar, Button, Card, ErrorNote, Header, Page, Spinner, Stepper } from "@/components/ui";
import { API, api, inr, type ConsentNotice, type DocUpload, type KycResult, type Quote } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cartItems, loadJourney, saveJourney } from "@/lib/store";

const DOCS = [
  { key: "gst_certificate", en: "GST certificate", hi: "GST सर्टिफ़िकेट", icon: "🧾" },
  { key: "udyam_certificate", en: "Udyam certificate", hi: "उद्यम सर्टिफ़िकेट", icon: "🏷️" },
  { key: "signatory_id", en: "Authorised signatory ID", hi: "अधिकृत हस्ताक्षरकर्ता ID", icon: "🪪" },
  { key: "address_proof", en: "Address proof (bill ≤ 90 days)", hi: "पते का प्रमाण (90 दिन तक का बिल)", icon: "🏠" },
] as const;

const FIELD_LABELS: Record<string, string> = {
  gstin: "GSTIN",
  legal_name: "Legal name",
  trade_name: "Trade name",
  constitution: "Constitution",
  udyam_number: "Udyam no.",
  enterprise_name: "Enterprise",
  name: "Name",
  designation: "Designation",
  for_business: "For business",
  valid_till: "Valid till",
  billed_to: "Billed to",
  bill_date: "Bill date",
  address: "Address",
};

const SAMPLES = ["K12", "K02", "K11", "K07", "K06", "K05", "K01", "K04"];

export default function KycPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<"consent" | "docs" | "result">("consent");
  const [notice, setNotice] = useState<ConsentNotice | null>(null);
  const [marketing, setMarketing] = useState(false);
  const [kycId, setKycId] = useState<string | null>(null);
  const [consentId, setConsentId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, DocUpload>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [result, setResult] = useState<KycResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [cart, setCart] = useState<[string, number][]>([]);

  useEffect(() => {
    api.consentNotice().then(setNotice).catch((e) => setErr(e.message));
    const j = loadJourney();
    const items = cartItems(j.cart);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of saved journey from sessionStorage (unavailable during prerender)
    setCart(items);
    if (items.length) api.quote(items).then(setQuote).catch(() => {});
  }, []);

  async function giveConsent() {
    setBusy(true);
    setErr(null);
    try {
      const purposes = ["kyc_verification", "service_activation", ...(marketing ? ["marketing"] : [])];
      const r = await api.consent(purposes);
      setKycId(r.kyc_id);
      setConsentId(r.consent_id);
      saveJourney({ kycId: r.kyc_id, consentId: r.consent_id });
      setStep("docs");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: Blob, name: string, slot: string) {
    if (!kycId) return;
    setUploading(slot);
    setErr(null);
    try {
      const r = await api.uploadDoc(kycId, file, name);
      setDocs((d) => ({ ...d, [r.doc_type]: r }));
      if (r.doc_type !== slot && slot !== "auto") {
        setErr(
          lang === "hi"
            ? `यह दस्तावेज़ ${r.doc_type.replace(/_/g, " ")} लगता है, हमने उसे सही जगह रख दिया है।`
            : `That looks like a ${r.doc_type.replace(/_/g, " ")}; we filed it in the right slot.`,
        );
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  async function loadSample(code: string) {
    setDocs({});
    setResult(null);
    for (const d of DOCS) {
      const res = await fetch(`${API}/samples/${code}_${d.key}.png`);
      if (!res.ok) continue; // e.g. K05 has no Udyam certificate
      await upload(await res.blob(), `${code}_${d.key}.png`, d.key);
    }
  }

  async function verify() {
    if (!kycId) return;
    setBusy(true);
    setErr(null);
    try {
      setResult(await api.verify(kycId));
      setStep("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder() {
    if (!kycId) return;
    setBusy(true);
    setErr(null);
    try {
      const o = await api.createOrder(cart, kycId, phone, lang);
      saveJourney({ orderId: o.order_id });
      router.push(`/track?id=${o.order_id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!consentId) return;
    await api.withdrawConsent(consentId).catch(() => {});
    saveJourney({ kycId: undefined, consentId: undefined });
    setKycId(null);
    setConsentId(null);
    setDocs({});
    setResult(null);
    setStep("consent");
  }

  const uploadedCount = DOCS.filter((d) => docs[d.key]).length;

  return (
    <>
      <Header back="/quote" />
      <Stepper current={2} />
      <Page>
        <h1 className="text-xl font-bold">{t("kycTitle")}</h1>

        {step === "consent" && (
          <Card className="animate-rise mt-4">
            <h2 className="font-semibold">🔒 {t("consentTitle")}</h2>
            <p className="mt-1 text-sm text-muted">
              {lang === "hi"
                ? "आपकी अनुमति से हम सिर्फ़ ये काम करेंगे (DPDP Act, 2023):"
                : "With your permission we will use your data only for these purposes (DPDP Act, 2023):"}
            </p>
            {notice ? (
              <>
                <ul className="mt-3 space-y-2 text-sm">
                  {Object.entries(notice.purposes).map(([k, v]) => (
                    <li key={k} className="flex gap-2.5">
                      {k === "marketing" ? (
                        <input
                          type="checkbox"
                          checked={marketing}
                          onChange={(e) => setMarketing(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                          aria-label="Marketing consent"
                        />
                      ) : (
                        <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded bg-ink text-[10px] text-surface">✓</span>
                      )}
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-sunken p-3">
                    <p className="font-semibold">{lang === "hi" ? "हम लेंगे" : "We collect"}</p>
                    <ul className="mt-1 space-y-0.5 text-muted">
                      {notice.data_collected.map((d) => (
                        <li key={d}>• {d}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-good-soft p-3">
                    <p className="font-semibold text-good">{lang === "hi" ? "हम नहीं लेंगे" : "We never ask for"}</p>
                    <ul className="mt-1 space-y-0.5 text-muted">
                      {notice.not_collected.map((d) => (
                        <li key={d}>• {d}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  <strong>{lang === "hi" ? "रखरखाव:" : "Retention:"}</strong> {notice.retention}{" "}
                  {lang === "hi" ? "आप कभी भी सहमति वापस ले सकते हैं।" : "You can withdraw consent at any time."} ·{" "}
                  {notice.grievance_contact}
                </p>
              </>
            ) : (
              <div className="mt-4 flex justify-center text-muted">
                <Spinner />
              </div>
            )}
          </Card>
        )}

        {step === "docs" && (
          <div className="animate-rise mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-xs">
              <span className="text-muted">{t("useSample")}:</span>
              <select
                className="ml-auto rounded-lg border border-line bg-surface px-2 py-1"
                defaultValue=""
                onChange={(e) => e.target.value && loadSample(e.target.value)}
                disabled={!!uploading}
              >
                <option value="" disabled>
                  —
                </option>
                {SAMPLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {DOCS.map((d) => (
              <DocCard
                key={d.key}
                label={lang === "hi" ? d.hi : d.en}
                icon={d.icon}
                doc={docs[d.key]}
                loading={uploading === d.key}
                onFile={(f) => upload(f, f.name, d.key)}
                t={t}
              />
            ))}
            <button onClick={withdraw} className="w-full pt-1 text-center text-xs text-muted underline">
              {lang === "hi" ? "सहमति वापस लें और मेरा डेटा मिटाएँ" : "Withdraw consent and erase my data"}
            </button>
          </div>
        )}

        {step === "result" && result && (
          <div className="animate-rise mt-4 space-y-3">
            <Verdict result={result} lang={lang} />
            <Card>
              <ul className="space-y-2.5">
                {[...result.findings]
                  .sort((a, b) => ["fail", "warn", "pass"].indexOf(a.severity) - ["fail", "warn", "pass"].indexOf(b.severity))
                  .map((f, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                          f.severity === "pass" ? "bg-good-soft text-good" : f.severity === "warn" ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad"
                        }`}
                      >
                        {f.severity === "pass" ? "✓" : f.severity === "warn" ? "!" : "✕"}
                      </span>
                      <span className="leading-snug">{f.message}</span>
                    </li>
                  ))}
              </ul>
            </Card>

            {result.verdict !== "rejected" ? (
              <Card>
                <h3 className="font-semibold">{lang === "hi" ? "ऑर्डर की पुष्टि करें" : "Confirm your order"}</h3>
                {quote && (
                  <p className="mt-1 text-sm text-muted">
                    {quote.lines.length} {lang === "hi" ? "सेवाएँ" : "services"} · {inr(quote.monthly_total_incl_gst)}
                    {t("perMonth")} · {t("setup")} {inr(quote.one_time_setup)}
                  </p>
                )}
                <label className="mt-3 block">
                  <span className="text-xs text-muted">{t("phone")}</span>
                  <div className="mt-1 flex h-12 items-center rounded-xl border border-line focus-within:border-brand">
                    <span className="pl-3 text-muted">+91</span>
                    <input
                      inputMode="numeric"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] tracking-wide outline-none"
                      placeholder="98XXXXXXXX"
                    />
                  </div>
                </label>
                <p className="mt-2 text-xs text-muted">
                  {lang === "hi"
                    ? "ऑर्डर करते ही e-sign लिंक और पहला बिल SMS पर आएगा (डेमो में सिम्युलेटेड)।"
                    : "You'll get an e-sign link and first bill by SMS after ordering (simulated in this demo)."}
                </p>
              </Card>
            ) : (
              <Card className="text-sm">
                <p className="font-semibold">{lang === "hi" ? "अब क्या करें?" : "What next?"}</p>
                <p className="mt-1 text-muted">
                  {lang === "hi"
                    ? "ऊपर बताई गई समस्या ठीक करके दस्तावेज़ फिर से अपलोड करें, या हमारा पार्टनर आपको कॉल करके मदद करेगा।"
                    : "Fix the issue above and re-upload, or request a callback and a local NorthStar partner will help you finish."}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setStep("docs")}>
                    {t("retake")}
                  </Button>
                  <Button variant="ghost" className="flex-1">
                    📞 {t("callback")}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
        <ErrorNote msg={err} />
      </Page>

      <BottomBar>
        {step === "consent" && (
          <Button className="w-full" disabled={!notice || busy} onClick={giveConsent}>
            {busy && <Spinner />} {t("agree")}
          </Button>
        )}
        {step === "docs" && (
          <>
            <p className="flex-1 text-sm text-muted">
              <span className="font-bold text-ink">{uploadedCount}</span>/4 {lang === "hi" ? "अपलोड" : "uploaded"}
            </p>
            <Button disabled={uploadedCount === 0 || busy || !!uploading} onClick={verify}>
              {busy && <Spinner />} {t("verify")}
            </Button>
          </>
        )}
        {step === "result" && result && result.verdict !== "rejected" && (
          <Button className="w-full" disabled={phone.length !== 10 || busy || !cart.length} onClick={placeOrder}>
            {busy && <Spinner />} {t("placeOrder")}
          </Button>
        )}
        {step === "result" && result?.verdict === "rejected" && (
          <Button variant="secondary" className="w-full" onClick={() => setStep("docs")}>
            {t("retake")}
          </Button>
        )}
      </BottomBar>
    </>
  );
}

function DocCard({
  label,
  icon,
  doc,
  loading,
  onFile,
  t,
}: {
  label: string;
  icon: string;
  doc?: DocUpload;
  loading: boolean;
  onFile: (f: File) => void;
  t: (k: "upload" | "retake") => string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const fields = doc ? Object.entries(doc.fields).filter(([k, v]) => v && FIELD_LABELS[k]) : [];
  return (
    <Card className={`!p-3.5 ${doc ? "border-good/40" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sunken text-xl" aria-hidden>
          {doc ? "✅" : icon}
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug">{label}</span>
        <input
          ref={ref}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <Button variant={doc ? "secondary" : "primary"} className="!h-9 !px-3 !text-sm" onClick={() => ref.current?.click()} disabled={loading}>
          {loading ? <Spinner /> : doc ? t("retake") : t("upload")}
        </Button>
      </div>
      {fields.length > 0 && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-sunken p-2.5 text-xs">
          {fields.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{FIELD_LABELS[k]}</dt>
              <dd className="truncate font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {doc && doc.quality_issues.some((q) => /blur|unread|blank/i.test(q)) && (
        <p className="mt-2 text-xs text-warn">⚠ {doc.quality_issues.filter((q) => /blur|unread|blank/i.test(q)).join("; ")}</p>
      )}
    </Card>
  );
}

function Verdict({ result, lang }: { result: KycResult; lang: string }) {
  const cfg = {
    approved: { bg: "bg-good-soft text-good", icon: "✓", en: "KYC approved", hi: "KYC स्वीकृत" },
    manual_review: { bg: "bg-warn-soft text-warn", icon: "!", en: "Almost there: one item needs a look", hi: "लगभग हो गया — एक चीज़ देखनी है" },
    rejected: { bg: "bg-bad-soft text-bad", icon: "✕", en: "We couldn't verify your documents", hi: "दस्तावेज़ सत्यापित नहीं हो पाए" },
  }[result.verdict];
  return (
    <div className={`animate-pop rounded-2xl p-4 ${cfg.bg}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-surface text-lg font-bold">{cfg.icon}</span>
        <div>
          <p className="font-bold">{lang === "hi" ? cfg.hi : cfg.en}</p>
          {result.business_name && <p className="text-sm opacity-80">{result.business_name}</p>}
        </div>
      </div>
      {result.verdict === "manual_review" && (
        <p className="mt-2 text-sm">
          {lang === "hi"
            ? "आप अभी ऑर्डर कर सकते हैं; हमारी टीम 4 घंटे में इसे देख लेगी।"
            : "You can place the order now; our team will review it within 4 working hours."}
        </p>
      )}
    </div>
  );
}
