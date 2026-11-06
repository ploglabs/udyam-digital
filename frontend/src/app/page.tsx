"use client";

import Link from "next/link";
import { Header } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const SEGMENTS = [
  { icon: "🛒", en: "Kirana & retail", hi: "किराना व दुकान", price: 2196 },
  { icon: "🩺", en: "Clinics & offices", hi: "क्लिनिक व ऑफ़िस", price: 3170 },
  { icon: "🍽️", en: "Multi-store chains", hi: "कई ब्रांच वाले", price: 6241 },
  { icon: "🏭", en: "Small factories", hi: "छोटी फ़ैक्ट्री", price: 3519 },
];

export default function Home() {
  const { t, lang } = useI18n();
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10">
        <section className="pt-8">
          <span className="animate-fade inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            ● Udyam Digital
          </span>
          <h1 style={{ ["--rise" as string]: "12px" }} className="animate-rise mt-3 text-[28px] font-bold leading-tight tracking-tight">{t("tagline")}</h1>
          <p style={{ animationDelay: "70ms" }} className="animate-rise mt-3 text-[15px] leading-relaxed text-muted">{t("heroSub")}</p>
          <div style={{ animationDelay: "120ms" }} className="animate-rise mt-6 flex flex-col gap-3">
            <Link
              href="/advisor"
              className="btn-3d btn-3d-solid flex h-12 items-center justify-center rounded-xl bg-brand text-[15px] font-semibold text-white hover:bg-brand-strong"
            >
              {t("start")} →
            </Link>
            <Link
              href="/track"
              className="btn-3d flex h-12 items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold hover:bg-sunken"
            >
              {t("track")}
            </Link>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-3">
          {(["how1", "how2", "how3", "how4"] as const).map((k, i) => (
            <div key={k} style={{ animationDelay: `${160 + [0, 40, 70, 90][i]}ms` }} className="animate-rise rounded-2xl border border-line bg-surface p-3.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-bold text-surface">{i + 1}</span>
              <p className="mt-2 text-sm font-medium leading-snug">{t(k)}</p>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-muted">{lang === "hi" ? "किसके लिए" : "Built for"}</h2>
          <div className="mt-3 space-y-2">
            {SEGMENTS.map((s, i) => (
              <Link
                key={s.en}
                href="/advisor"
                style={{ animationDelay: `${260 + i * 30}ms` }}
                className="btn-3d animate-rise flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 hover:border-brand"
              >
                <span className="text-2xl" aria-hidden>
                  {s.icon}
                </span>
                <span className="font-medium">{lang === "hi" ? s.hi : s.en}</span>
                <span className="ml-auto text-sm text-muted">
                  {lang === "hi" ? "से" : "from"} ₹{s.price.toLocaleString("en-IN")}
                  {lang === "hi" ? "/माह" : "/mo"}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-muted">
          Fictional operator for the Airtel SYNC hackathon · synthetic data only
        </p>
        <p className="mt-2 text-center text-xs">
          <Link href="/partner" className="text-muted underline underline-offset-2 hover:text-brand">
            {lang === "hi" ? "पार्टनर / सेल्स डेस्क" : "Partner & sales desk"}
          </Link>
        </p>
      </main>
    </>
  );
}
