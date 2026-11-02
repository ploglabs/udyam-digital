"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

export type Lang = "en" | "hi";

const dict = {
  en: {
    tagline: "Get your business connected in one sitting",
    heroSub: "Internet, business SIMs, billing, CCTV and WhatsApp on one bill. Tell us about your business and get a clear monthly price in 2 minutes.",
    start: "Find my bundle",
    track: "Track my order",
    how1: "Chat in your language",
    how2: "See one monthly price",
    how3: "KYC in 3 minutes, no visit",
    how4: "Track activation live",
    advisorTitle: "Accel Saathi",
    advisorHello: "Namaste! I'm Saathi. Tell me about your business: what do you do and in which city?",
    typeHere: "Type your message…",
    send: "Send",
    listening: "Listening…",
    seeQuote: "Review quote",
    perMonth: "/month",
    preferForm: "Prefer a quick form?",
    formTitle: "Quick form",
    getBundle: "Get bundle",
    quoteTitle: "Your quote",
    inBundle: "In your bundle",
    addOns: "Popular add-ons",
    monthly: "Monthly",
    gst: "GST 18%",
    totalMonthly: "Total per month",
    setup: "One-time setup",
    contract: "Contract",
    months: "months",
    activation: "Activation in",
    days: "days",
    continueKyc: "Continue to KYC",
    kycTitle: "Quick KYC",
    consentTitle: "Your data, your consent",
    agree: "I agree, continue",
    upload: "Upload",
    retake: "Replace",
    verify: "Verify documents",
    useSample: "Demo: use sample applicant",
    phone: "Mobile number for updates",
    placeOrder: "Place order",
    trackTitle: "Order status",
    orderId: "Order ID",
    find: "Find",
    eta: "Expected activation",
    nextStage: "Demo: move to next stage",
    shareWa: "Share on WhatsApp",
    callback: "Talk to a person",
    startOver: "Start over",
  },
  hi: {
    tagline: "एक ही बार में अपने बिज़नेस को डिजिटल बनाइए",
    heroSub: "इंटरनेट, बिज़नेस सिम, बिलिंग, CCTV और WhatsApp — सब एक बिल पर। अपने बिज़नेस के बारे में बताइए और 2 मिनट में साफ़ मासिक कीमत पाइए।",
    start: "मेरा प्लान ढूँढें",
    track: "ऑर्डर ट्रैक करें",
    how1: "अपनी भाषा में बात करें",
    how2: "एक ही मासिक कीमत",
    how3: "3 मिनट में KYC, कोई विज़िट नहीं",
    how4: "एक्टिवेशन लाइव ट्रैक करें",
    advisorTitle: "Accel साथी",
    advisorHello: "नमस्ते! मैं साथी हूँ। अपने बिज़नेस के बारे में बताइए — आप क्या करते हैं और किस शहर में?",
    typeHere: "अपना संदेश लिखें…",
    send: "भेजें",
    listening: "सुन रहा हूँ…",
    seeQuote: "कोटेशन देखें",
    perMonth: "/महीना",
    preferForm: "फ़ॉर्म से भरना चाहते हैं?",
    formTitle: "छोटा फ़ॉर्म",
    getBundle: "प्लान देखें",
    quoteTitle: "आपका कोटेशन",
    inBundle: "आपके प्लान में",
    addOns: "लोकप्रिय ऐड-ऑन",
    monthly: "मासिक",
    gst: "GST 18%",
    totalMonthly: "कुल मासिक",
    setup: "एक बार का सेटअप",
    contract: "कॉन्ट्रैक्ट",
    months: "महीने",
    activation: "एक्टिवेशन",
    days: "दिन में",
    continueKyc: "KYC पर आगे बढ़ें",
    kycTitle: "झटपट KYC",
    consentTitle: "आपका डेटा, आपकी सहमति",
    agree: "मैं सहमत हूँ, आगे बढ़ें",
    upload: "अपलोड",
    retake: "बदलें",
    verify: "दस्तावेज़ जाँचें",
    useSample: "डेमो: सैंपल आवेदक",
    phone: "अपडेट के लिए मोबाइल नंबर",
    placeOrder: "ऑर्डर करें",
    trackTitle: "ऑर्डर की स्थिति",
    orderId: "ऑर्डर ID",
    find: "खोजें",
    eta: "अनुमानित एक्टिवेशन",
    nextStage: "डेमो: अगला चरण",
    shareWa: "WhatsApp पर भेजें",
    callback: "किसी व्यक्ति से बात करें",
    startOver: "फिर से शुरू करें",
  },
} as const;

export type Key = keyof (typeof dict)["en"];

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => dict.en[k],
});

const LANG_KEY = "udyam-lang";
const listeners = new Set<() => void>();

function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLang, () => "en" as Lang);
  const setLang = (l: Lang) => {
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
    listeners.forEach((cb) => cb());
  };
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang, t: (k) => dict[lang][k] }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
