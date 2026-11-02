"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BottomBar, Button, Card, ErrorNote, Header, Page, Spinner, Stepper } from "@/components/ui";
import { api, inr, type Bundle, type Product, type Quote } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cartItems, loadJourney, saveJourney } from "@/lib/store";

const PER_UNIT = new Set(["per line", "per user", "per device", "per camera", "per counter", "per vehicle", "per channel", "per site"]);

export default function QuotePage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [catalogue, setCatalogue] = useState<Product[]>([]);
  const [quoteState, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const j = loadJourney();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of saved journey from sessionStorage (unavailable during prerender)
    setBundle(j.bundle ?? null);
    setCart(j.cart ?? {});
    setReady(true);
    api.catalogue().then(setCatalogue).catch(() => {});
  }, []);

  // Live re-quote through the rules engine whenever the cart changes
  useEffect(() => {
    if (!ready || !bundle) return;
    const items = cartItems(cart);
    saveJourney({ cart });
    if (!items.length) return;
    const h = setTimeout(() => {
      setLoading(true);
      api
        .quote(items, bundle.profile)
        .then((q) => {
          setQuote(q);
          setErr(null);
        })
        .catch((e) => setErr(e.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(h);
  }, [cart, bundle, ready]);

  const seg = String(bundle?.profile?.segment ?? "micro");
  const bundleIds = useMemo(() => new Set(bundle?.items.map((i) => i.product_id)), [bundle]);
  const excludedIds = useMemo(() => new Set(bundle?.excluded.map((e) => e.product_id)), [bundle]);
  const addOns = catalogue
    .filter((p) => !bundleIds.has(p.id) && !excludedIds.has(p.id) && p.segments.includes(seg))
    .filter((p) => !["P05", "P06", "P03", "P04", "P01", "P02"].includes(p.id)) // main link chosen by the engine
    .slice(0, 6);
  const byId = useMemo(() => Object.fromEntries(catalogue.map((p) => [p.id, p])), [catalogue]);

  if (ready && !bundle) {
    return (
      <>
        <Header back="/advisor" />
        <Page>
          <Card className="text-center">
            <p className="text-muted">{lang === "hi" ? "पहले साथी से अपना प्लान बनवाइए।" : "Chat with Saathi first to build your bundle."}</p>
            <Link href="/advisor" className="mt-4 inline-block font-semibold text-brand">
              {t("start")} →
            </Link>
          </Card>
        </Page>
      </>
    );
  }

  const quote = cartItems(cart).length ? quoteState : null;
  const setQty = (pid: string, q: number) => setCart((c) => ({ ...c, [pid]: Math.max(0, Math.min(q, 99)) }));
  const lines = quote?.lines ?? [];
  const reason = (pid: string) => bundle?.items.find((i) => i.product_id === pid)?.reason;
  const removed = bundle?.items.filter((i) => !cart[i.product_id]) ?? [];

  return (
    <>
      <Header back="/advisor" />
      <Stepper current={1} />
      <Page>
        <h1 className="text-xl font-bold">{t("quoteTitle")}</h1>
        <p className="text-sm text-muted">{bundle?.segment}</p>

        <h2 className="mt-5 text-sm font-semibold text-muted">{t("inBundle")}</h2>
        <div className="mt-2 space-y-2">
          {lines.map((l) => (
            <Card key={l.product_id} className="animate-rise !p-3.5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{l.name}</p>
                  {(reason(l.product_id) || byId[l.product_id]) && (
                    <p className="mt-0.5 text-sm leading-snug text-muted">{reason(l.product_id) ?? byId[l.product_id]?.description}</p>
                  )}
                  <p className="mt-1.5 text-xs text-muted">
                    {inr(l.unit_price)} {l.unit} · {l.min_contract > 1 ? `${l.min_contract} ${t("months")}` : lang === "hi" ? "मासिक" : "monthly"}
                    {l.setup > 0 && ` · ${t("setup")} ${inr(l.setup)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{inr(l.monthly)}</p>
                  <p className="text-xs text-muted">{t("perMonth")}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                {PER_UNIT.has(l.unit) ? (
                  <div className="flex items-center rounded-full border border-line">
                    <button className="h-8 w-9 text-lg text-muted" onClick={() => setQty(l.product_id, l.qty - 1)} aria-label="Decrease">
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                    <button className="h-8 w-9 text-lg text-muted" onClick={() => setQty(l.product_id, l.qty + 1)} aria-label="Increase">
                      +
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <button onClick={() => setQty(l.product_id, 0)} className="text-sm font-medium text-muted hover:text-bad">
                  {lang === "hi" ? "हटाएँ" : "Remove"}
                </button>
              </div>
            </Card>
          ))}
          {removed.map((i) => (
            <button
              key={i.product_id}
              onClick={() => setQty(i.product_id, i.qty || 1)}
              className="flex w-full items-center justify-between rounded-2xl border border-dashed border-line px-3.5 py-2.5 text-left text-sm text-muted"
            >
              <span className="line-through">{i.name}</span>
              <span className="font-semibold text-brand">+ {lang === "hi" ? "वापस जोड़ें" : "Add back"}</span>
            </button>
          ))}
        </div>

        {bundle && bundle.excluded.length > 0 && (
          <div className="mt-4 rounded-2xl bg-warn-soft p-3.5 text-sm text-warn">
            <p className="font-semibold">{lang === "hi" ? "अभी उपलब्ध नहीं" : "Not available yet"}</p>
            <ul className="mt-1 space-y-1">
              {bundle.excluded.map((e) => (
                <li key={e.product_id}>
                  <strong>{e.name}</strong>: {e.reasons[0]}
                </li>
              ))}
            </ul>
          </div>
        )}

        {addOns.length > 0 && (
          <>
            <h2 className="mt-6 text-sm font-semibold text-muted">{t("addOns")}</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {addOns.map((p) => {
                const on = !!cart[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => setQty(p.id, on ? 0 : 1)}
                    className={`rounded-2xl border p-3 text-left transition ${on ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-snug">{p.name}</span>
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-xs ${on ? "border-brand bg-brand text-white" : "border-line"}`}
                      >
                        {on ? "✓" : "+"}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {inr(p.price)} {p.unit}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {quote && (
          <Card className="mt-6">
            <Row k={t("monthly")} v={inr(quote.monthly_total)} />
            <Row k={t("gst")} v={inr(quote.gst_18pct)} />
            <div className="my-2 border-t border-line" />
            <Row k={t("totalMonthly")} v={inr(quote.monthly_total_incl_gst)} strong />
            <Row k={t("setup")} v={inr(quote.one_time_setup)} />
            <Row k={t("contract")} v={`${quote.contract_months} ${t("months")}`} />
            <Row k={t("activation")} v={`${quote.expected_activation_days} ${t("days")}`} />
            <p className="mt-3 text-xs text-muted">
              {lang === "hi"
                ? "कोई छिपा शुल्क नहीं। एक बिल, एक सपोर्ट नंबर।"
                : "No hidden charges. One bill, one support number for everything."}
            </p>
          </Card>
        )}

        {quote && !quote.valid && (
          <div role="alert" className="mt-3 rounded-xl bg-bad-soft p-3 text-sm text-bad">
            {quote.errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
        <ErrorNote msg={err} />
      </Page>

      <BottomBar>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{t("totalMonthly")}</p>
          <p className="text-lg font-bold tabular-nums">
            {quote ? inr(quote.monthly_total_incl_gst) : "—"}
            {loading && <Spinner className="ml-2 text-muted" />}
          </p>
        </div>
        <Button disabled={!quote || !quote.valid || loading} onClick={() => router.push("/kyc")}>
          {t("continueKyc")}
        </Button>
      </BottomBar>
    </>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "text-base font-bold" : "text-sm"}`}>
      <span className={strong ? "" : "text-muted"}>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
