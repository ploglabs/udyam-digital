"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BottomBar, Button, Header, Markdownish, Spinner, Stepper } from "@/components/ui";
import { ApiError, api, inr, type Bundle } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { loadJourney, saveJourney } from "@/lib/store";

type Msg = { role: "user" | "bot"; text: string };

const QUICK = {
  en: ["I run a kirana store in Jaipur", "Dental clinic in Pune, 8 staff", "Restaurant chain with 4 outlets in Bengaluru", "Textile unit in Surat, 30 workers"],
  hi: ["मेरी किराना दुकान जयपुर में है", "पुणे में डेंटल क्लिनिक, 8 लोग", "बेंगलुरु में 4 आउटलेट वाला रेस्टोरेंट", "सूरत में टेक्सटाइल यूनिट, 30 कर्मचारी"],
};

// Minimal typing for the browser Web Speech API
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

export default function AdvisorPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [listening, setListening] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const j = loadJourney();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of saved journey from sessionStorage (unavailable during prerender)
    if (j.bundle) setBundle(j.bundle);
    if (j.sessionId) setSessionId(j.sessionId);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: msg }]);
    setBusy(true);
    try {
      const r = await api.chat(msg, sessionId, lang);
      setSessionId(r.session_id);
      setMsgs((m) => [...m, { role: "bot", text: r.reply }]);
      if (r.bundle) {
        setBundle(r.bundle);
        const cart = Object.fromEntries(r.bundle.items.map((i) => [i.product_id, i.qty]));
        saveJourney({ sessionId: r.session_id, bundle: r.bundle, cart });
      } else {
        saveJourney({ sessionId: r.session_id });
      }
    } catch (e) {
      const busyMsg =
        e instanceof ApiError && e.status === 429
          ? lang === "hi"
            ? "अभी बहुत लोग बात कर रहे हैं। कुछ सेकंड बाद फिर भेजें, या नीचे छोटा फ़ॉर्म भरें।"
            : "Saathi is busy right now. Please resend in a few seconds, or use the quick form below."
          : lang === "hi"
            ? "कनेक्शन में दिक्कत आई। फिर से कोशिश करें या छोटा फ़ॉर्म भरें।"
            : "Couldn't reach Saathi. Try again, or use the quick form below.";
      setMsgs((m) => [...m, { role: "bot", text: busyMsg }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleVoice() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setMsgs((m) => [
        ...m,
        { role: "bot", text: lang === "hi" ? "इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है। Chrome आज़माएँ या टाइप करें।" : "Voice input isn't supported in this browser. Try Chrome, or type instead." },
      ]);
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript;
      setInput(said);
      send(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <>
      <Header back="/" />
      <Stepper current={0} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-44 pt-4">
        <div className="space-y-3">
          <Bubble role="bot" text={t("advisorHello")} />
          {msgs.length === 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK[lang].map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="btn-3d animate-rise rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-brand hover:text-brand"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Saathi…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => setShowForm((s) => !s)} className="text-sm font-medium text-brand underline-offset-2 hover:underline">
            {t("preferForm")}
          </button>
        </div>
        {showForm && (
          <QuickForm
            onDone={(b) => {
              setBundle(b);
              const cart = Object.fromEntries(b.items.map((i) => [i.product_id, i.qty]));
              saveJourney({ bundle: b, cart, ...(b.session_id ? { sessionId: b.session_id } : {}) });
              router.push("/quote");
            }}
          />
        )}
      </main>

      <BottomBar>
        <div className="flex w-full flex-col gap-2">
          {bundle && (
            <button
              onClick={() => router.push("/quote")}
              className="btn-3d btn-3d-solid animate-rise flex items-center justify-between rounded-xl bg-ink px-4 py-2.5 text-left text-surface"
            >
              <span>
                <span className="block text-xs opacity-70">{bundle.segment}</span>
                <span className="font-semibold">
                  {inr(bundle.quote.monthly_total)}
                  <span className="text-sm font-normal opacity-70">{t("perMonth")} + GST</span>
                </span>
              </span>
              <span className="text-sm font-semibold">{t("seeQuote")} →</span>
            </button>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <button
              type="button"
              onClick={toggleVoice}
              aria-label="Voice input"
              className={`btn-3d grid h-11 w-11 shrink-0 place-items-center rounded-full border ${listening ? "animate-pulse border-brand bg-brand text-white" : "border-line bg-surface text-muted"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
              </svg>
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? t("listening") : t("typeHere")}
              className="h-11 min-w-0 flex-1 rounded-full border border-line bg-sunken px-4 text-[15px] outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t("send")}
              className="btn-3d btn-3d-solid grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white disabled:bg-line"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
              </svg>
            </button>
          </form>
        </div>
      </BottomBar>
    </>
  );
}

function Bubble({ role, text }: Msg) {
  const bot = role === "bot";
  return (
    <div className={`animate-rise flex ${bot ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
          bot ? "rounded-tl-sm border border-line bg-surface" : "rounded-tr-sm bg-brand text-white"
        }`}
      >
        {bot ? <Markdownish text={text} /> : text}
      </div>
    </div>
  );
}

const SEGS = [
  { v: "micro", en: "Shop / kirana / salon", hi: "दुकान / किराना / सैलून" },
  { v: "prof", en: "Clinic / office / coaching", hi: "क्लिनिक / ऑफ़िस / कोचिंग" },
  { v: "multi", en: "Multiple outlets", hi: "कई आउटलेट" },
  { v: "mfg", en: "Factory / workshop", hi: "फ़ैक्ट्री / वर्कशॉप" },
];

function QuickForm({ onDone }: { onDone: (b: Bundle) => void }) {
  const { t, lang } = useI18n();
  const [f, setF] = useState({ segment: "micro", city_tier: 1, employees: 3, sites: 1, has_gstin: true, cameras: 0, pos_counters: 1, wants_whatsapp: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const num = (k: keyof typeof f, label: string) => (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="number"
        min={k === "cameras" ? 0 : 1}
        value={f[k] as number}
        onChange={(e) => setF({ ...f, [k]: Math.max(0, Number(e.target.value)) })}
        className="mt-1 h-11 w-full rounded-xl border border-line px-3"
      />
    </label>
  );
  return (
    <div className="animate-rise mt-4 space-y-3 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-semibold">{t("formTitle")}</h3>
      <div className="grid grid-cols-2 gap-2">
        {SEGS.map((s) => (
          <button
            key={s.v}
            onClick={() => setF({ ...f, segment: s.v })}
            className={`btn-3d rounded-xl border px-3 py-2 text-left text-sm ${f.segment === s.v ? "border-brand bg-brand-soft font-medium text-brand" : "border-line bg-surface"}`}
          >
            {lang === "hi" ? s.hi : s.en}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {num("employees", lang === "hi" ? "कर्मचारी" : "Staff")}
        {num("sites", lang === "hi" ? "ब्रांच/साइट" : "Locations")}
        {num("cameras", lang === "hi" ? "CCTV कैमरे" : "CCTV cameras")}
        <label className="block">
          <span className="text-xs text-muted">{lang === "hi" ? "शहर" : "City type"}</span>
          <select
            value={f.city_tier}
            onChange={(e) => setF({ ...f, city_tier: Number(e.target.value) })}
            className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3"
          >
            <option value={1}>{lang === "hi" ? "मेट्रो (टियर 1)" : "Metro (tier 1)"}</option>
            <option value={2}>{lang === "hi" ? "टियर 2" : "Tier 2"}</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.has_gstin} onChange={(e) => setF({ ...f, has_gstin: e.target.checked })} className="h-4 w-4 accent-brand" />
        {lang === "hi" ? "मेरे पास GST रजिस्ट्रेशन है" : "I have GST registration"}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.wants_whatsapp} onChange={(e) => setF({ ...f, wants_whatsapp: e.target.checked })} className="h-4 w-4 accent-brand" />
        {lang === "hi" ? "ग्राहकों के लिए WhatsApp चैनल" : "WhatsApp channel for customers"}
      </label>
      <Button
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            onDone(await api.recommend({ ...f, session_id: loadJourney().sessionId, language: lang }));
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <Spinner />} {t("getBundle")}
      </Button>
      {err && <p className="text-sm text-bad">{err}</p>}
    </div>
  );
}
