"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Button, Card, ErrorNote, Header, Page, Spinner, Stepper } from "@/components/ui";
import { api, inr, type Order } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { loadJourney } from "@/lib/store";

export default function TrackPage() {
  return (
    <>
      <Header back="/" />
      <Suspense fallback={<Page><Spinner /></Page>}>
        <Tracker />
      </Suspense>
    </>
  );
}

const fmtDate = (s: string, lang: string) =>
  new Date(s).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });

function Tracker() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [id, setId] = useState(params.get("id") ?? "");
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (oid: string, quiet = false) => {
      if (!oid) return;
      if (!quiet) setLoading(true);
      try {
        setOrder(await api.order(oid.trim()));
        setErr(null);
      } catch (e) {
        if (!quiet) {
          setOrder(null);
          setErr(lang === "hi" ? "यह ऑर्डर ID नहीं मिला" : (e as Error).message);
        }
      } finally {
        setLoading(false);
      }
    },
    [lang],
  );

  useEffect(() => {
    const fromUrl = params.get("id") || loadJourney().orderId || "";
    if (fromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of saved journey from sessionStorage (unavailable during prerender)
      setId(fromUrl);
      load(fromUrl);
    }
  }, [params, load]);

  // Light polling so the owner sees changes without calling support
  useEffect(() => {
    if (!order || order.stage === "activated") return;
    const h = setInterval(() => load(order.order_id, true), 15000);
    return () => clearInterval(h);
  }, [order, load]);

  const shareText = order
    ? encodeURIComponent(
        `${lang === "hi" ? "मेरा NorthStar ऑर्डर" : "My NorthStar order"} ${order.order_id}: ${typeof window !== "undefined" ? window.location.href : ""}`,
      )
    : "";

  return (
    <>
      {order && <Stepper current={3} />}
      <Page>
        <h1 className="text-xl font-bold">{t("trackTitle")}</h1>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.replace(`/track?id=${encodeURIComponent(id.trim())}`);
            load(id);
          }}
        >
          <input
            value={id}
            onChange={(e) => setId(e.target.value.toUpperCase())}
            placeholder={`${t("orderId")} (UD…)`}
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 font-mono tracking-wider outline-none focus:border-brand"
          />
          <Button type="submit" variant="secondary" disabled={!id.trim() || loading}>
            {loading ? <Spinner /> : t("find")}
          </Button>
        </form>
        <ErrorNote msg={err} />

        {order && (
          <div className="animate-rise mt-5 space-y-3">
            <Card className={order.stage === "activated" ? "border-good/40 bg-good-soft" : ""}>
              <p className="text-xs text-muted">{t("orderId")}</p>
              <p className="font-mono text-lg font-bold tracking-wider">{order.order_id}</p>
              <p className="mt-1 text-sm">{order.business_name}</p>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted">{order.stage === "activated" ? (lang === "hi" ? "स्थिति" : "Status") : t("eta")}</p>
                  <p className="text-lg font-bold">
                    {order.stage === "activated" ? (lang === "hi" ? "सब सेवाएँ चालू 🎉" : "All services live 🎉") : fmtDate(order.eta, lang)}
                  </p>
                </div>
                <p className="text-right text-xs text-muted">
                  {inr(order.quote.monthly_total_incl_gst)}
                  {t("perMonth")}
                  <br />
                  {order.phone}
                </p>
              </div>
            </Card>

            <Card>
              <ol className="relative">
                {order.timeline.map((s, i) => {
                  const last = i === order.timeline.length - 1;
                  return (
                    <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
                      {!last && (
                        <span className={`absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 ${s.status === "done" ? "bg-good" : "bg-line"}`} />
                      )}
                      <span
                        className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                          s.status === "done"
                            ? "bg-good text-white"
                            : s.status === "current"
                              ? "border-2 border-brand bg-surface text-brand before:absolute before:-inset-[2px] before:rounded-full before:border-2 before:border-brand before:animate-halo"
                              : "border-2 border-line bg-surface text-muted"
                        }`}
                      >
                        {s.status === "done" ? "✓" : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={`font-semibold ${s.status === "upcoming" ? "text-muted" : ""}`}>{s.label}</p>
                          <p className="shrink-0 text-xs text-muted">
                            {s.completed_at ? fmtDate(s.completed_at, lang) : `${lang === "hi" ? "अनुमान" : "by"} ${fmtDate(s.expected_by, lang)}`}
                          </p>
                        </div>
                        {s.status !== "upcoming" && <p className="mt-0.5 text-sm text-muted">{s.description}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <Card>
              <p className="text-sm font-semibold">{lang === "hi" ? "आपकी सेवाएँ" : "Your services"}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {order.items.map((l) => (
                  <li key={l.product_id} className="flex justify-between">
                    <span>
                      {l.name}
                      {l.qty > 1 && <span className="text-muted"> × {l.qty}</span>}
                    </span>
                    <span className="tabular-nums text-muted">{inr(l.monthly)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${shareText}`}
                target="_blank"
                rel="noreferrer"
                className="btn-3d flex h-12 items-center justify-center rounded-xl border border-line bg-surface text-sm font-semibold hover:bg-sunken"
              >
                {t("shareWa")}
              </a>
              <Button
                variant="secondary"
                className="!text-sm"
                disabled={order.stage === "activated"}
                onClick={async () => setOrder(await api.advance(order.order_id))}
              >
                {t("nextStage")}
              </Button>
            </div>
            <p className="text-center text-xs text-muted">
              {lang === "hi"
                ? "हर चरण पर आपको SMS/WhatsApp अपडेट मिलेगा — कॉल करने की ज़रूरत नहीं।"
                : "You'll get an SMS/WhatsApp update at every step, so there's no need to call support."}
            </p>
          </div>
        )}

        {!order && !loading && !err && (
          <p className="mt-6 text-center text-sm text-muted">
            {lang === "hi" ? "ऑर्डर नहीं है?" : "No order yet?"}{" "}
            <Link href="/advisor" className="font-semibold text-brand">
              {t("start")}
            </Link>
          </p>
        )}
      </Page>
    </>
  );
}
