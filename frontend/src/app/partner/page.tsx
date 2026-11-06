"use client";

// Back office for field sales and local channel partners: the journeys the digital flow could not close,
// last quarter's dropped leads ranked by a propensity score, and the success metrics.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, ErrorNote, Logo, Spinner } from "@/components/ui";
import { api, inr, type Band, type LiveLead, type Metrics, type WinbackLead } from "@/lib/api";

const KEY_STORE = "udyam-backoffice-key";
const SEG_LABEL: Record<string, string> = { micro: "Micro retail", prof: "Professional office", multi: "Multi-site", mfg: "Manufacturer" };
const STATUS_LABEL: Record<string, string> = {
  quoted: "Quoted",
  kyc_started: "KYC started",
  kyc_approved: "KYC passed",
  kyc_review: "KYC review",
  kyc_rejected: "KYC failed",
};
const SEGMENTS = ["Micro retail & services", "Professional offices", "Small multi-site businesses", "Small manufacturers"];
const SOURCES = ["Field sales", "Website form", "Channel partner", "Inbound call", "Referral", "WhatsApp campaign"];

function BandPill({ band, score }: { band: Band; score: number }) {
  const cls = { hot: "bg-bad-soft text-bad", warm: "bg-warn-soft text-warn", cold: "bg-sunken text-muted" }[band];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`} title="Predicted chance of activation">
      {band} · {(score * 100).toFixed(0)}%
    </span>
  );
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 0)} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

export default function PartnerPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"live" | "winback" | "metrics">("live");
  const [live, setLive] = useState<LiveLead[] | null>(null);
  const [winback, setWinback] = useState<WinbackLead[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [filters, setFilters] = useState({ segment: "", source: "", digital_fix_only: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(
    async (k: string) => {
      setBusy(true);
      setErr(null);
      try {
        const [l, w, m] = await Promise.all([
          api.backoffice.leads(k),
          api.backoffice.winback(k, { ...filters, limit: 50 }),
          api.backoffice.metrics(k),
        ]);
        setLive(l);
        setWinback(w);
        setMetrics(m);
        setAuthed(true);
        try {
          sessionStorage.setItem(KEY_STORE, k);
        } catch {}
      } catch (e) {
        setErr((e as Error).message);
        setAuthed(false);
      } finally {
        setBusy(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    let saved = "";
    try {
      saved = sessionStorage.getItem(KEY_STORE) || "";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the saved key (sessionStorage is unavailable during prerender)
    if (saved) setKey(saved);
    if (saved) load(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; filters reload below
  }, []);

  useEffect(() => {
    if (authed) api.backoffice.winback(key, { ...filters, limit: 50 }).then(setWinback).catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload the win-back list when filters change
  }, [filters]);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo className="h-6 w-7" />
            <span>
              North<span className="text-brand">Star</span>
            </span>
          </Link>
          <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-surface">Partner desk</span>
          {authed && (
            <button onClick={() => load(key)} className="ml-auto text-sm font-medium text-brand" disabled={busy}>
              {busy ? <Spinner /> : "↻ Refresh"}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-5">
        {!authed ? (
          <Card className="mx-auto max-w-sm">
            <h1 className="text-lg font-bold">Partner &amp; sales desk</h1>
            <p className="mt-1 text-sm text-muted">
              Leads the digital journey couldn&apos;t close, ranked by who is most likely to buy. Demo key: <code>demo-partner</code>
            </p>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                load(key);
              }}
            >
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                type="password"
                aria-label="Back-office key"
                placeholder="Back-office key"
                className="h-12 min-w-0 flex-1 rounded-xl border border-line px-3 outline-none focus:border-brand"
              />
              <Button type="submit" disabled={!key || busy}>
                {busy ? <Spinner /> : "Open"}
              </Button>
            </form>
            <ErrorNote msg={err} />
          </Card>
        ) : (
          <>
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1 ring-1 ring-line" role="tablist">
              {(
                [
                  ["live", `Needs a call${live ? ` (${live.length})` : ""}`],
                  ["winback", "Win-back list"],
                  ["metrics", "Metrics"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${tab === k ? "bg-ink text-surface" : "text-muted hover:bg-sunken"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ErrorNote msg={err} />

            {tab === "live" && live && <LiveList leads={live} />}
            {tab === "winback" && <Winback rows={winback} filters={filters} setFilters={setFilters} />}
            {tab === "metrics" && metrics && <MetricsView m={metrics} />}
          </>
        )}
      </main>
    </>
  );
}

function LiveList({ leads }: { leads: LiveLead[] }) {
  if (!leads.length)
    return (
      <Card className="mt-4 text-center text-sm text-muted">
        Nothing to chase. Every owner who got a quote has ordered, or no one has used the advisor yet.
      </Card>
    );
  return (
    <div className="mt-4 space-y-2.5">
      <p className="text-xs text-muted">
        Owners who asked for a call come first, then the rest by predicted chance of activation. Phone numbers are masked; dial through the
        call bridge.
      </p>
      {leads.map((l) => (
        <Card key={l.lead_id} className={`!p-3.5 ${l.callback_phone ? "border-brand/50" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {l.profile.segment ? SEG_LABEL[l.profile.segment] ?? l.profile.segment : "Callback request"}
            </span>
            {l.profile.employees != null && (
              <span className="text-sm text-muted">
                · {l.profile.employees} staff · {l.profile.sites} site{l.profile.sites === 1 ? "" : "s"} · tier {l.profile.city_tier}
                {l.profile.has_gstin ? " · GST" : " · no GST"}
              </span>
            )}
            <span className="ml-auto">
              <BandPill band={l.band} score={l.score} />
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="rounded bg-sunken px-1.5 py-0.5 font-medium text-ink">{STATUS_LABEL[l.status] ?? l.status}</span>
            {l.monthly_incl_gst != null && <span>{inr(l.monthly_incl_gst)}/mo quoted</span>}
            <span>via {l.channel}</span>
            <span>{l.language === "hi" ? "Hindi" : "English"}</span>
            <span>{ago(l.updated)}</span>
            {l.callback_phone && <span className="font-semibold text-brand">📞 {l.callback_phone}</span>}
          </div>
          <p className="mt-2 text-sm">
            <span className="font-medium">Next: </span>
            {l.next_action}
          </p>
          {l.note && <p className="mt-1 text-xs text-muted">Issue: {l.note}</p>}
        </Card>
      ))}
    </div>
  );
}

function Winback({
  rows,
  filters,
  setFilters,
}: {
  rows: WinbackLead[] | null;
  filters: { segment: string; source: string; digital_fix_only: boolean };
  setFilters: (f: { segment: string; source: string; digital_fix_only: boolean }) => void;
}) {
  const sel = "h-10 rounded-xl border border-line bg-surface px-2 text-sm";
  return (
    <div className="mt-4">
      <p className="text-xs text-muted">
        Leads dropped last quarter (Apr–Jun 2026), top 50 by predicted chance of activation. &ldquo;Digital fix&rdquo; means the drop reason is
        something the new journey removes (no visit, instant quote, 3-minute KYC), so a WhatsApp link may be enough.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select aria-label="Segment" className={sel} value={filters.segment} onChange={(e) => setFilters({ ...filters, segment: e.target.value })}>
          <option value="">All segments</option>
          {SEGMENTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Lead source" className={sel} value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={filters.digital_fix_only}
            onChange={(e) => setFilters({ ...filters, digital_fix_only: e.target.checked })}
          />
          Digital fix only
        </label>
      </div>
      {!rows ? (
        <Spinner className="mt-4" />
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-sunken text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Lead</th>
                <th className="px-3 py-2 font-medium">Business</th>
                <th className="px-3 py-2 font-medium">Dropped at</th>
                <th className="px-3 py-2 font-medium">Why</th>
                <th className="px-3 py-2 font-medium">Suggested next step</th>
                <th className="px-3 py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.lead_id} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-mono text-xs">{r.lead_id}</td>
                  <td className="px-3 py-2">
                    {r.business_type}
                    <span className="block text-xs text-muted">
                      {r.city} · {r.language} · {r.source}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{r.stage_reached}</td>
                  <td className="px-3 py-2">{r.drop_reason}</td>
                  <td className="px-3 py-2">
                    {r.action}
                    {r.digital_fix && <span className="ml-1 rounded bg-good-soft px-1 text-[11px] font-semibold text-good">digital fix</span>}
                  </td>
                  <td className="px-3 py-2">
                    <BandPill band={r.band} score={r.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-4 text-sm text-muted">No leads match these filters.</p>}
        </div>
      )}
    </div>
  );
}

function MetricsView({ m }: { m: Metrics }) {
  const live = [
    ["Advisor leads", m.live.advisor_leads],
    ["Callback requests", m.live.callbacks],
    ["KYC failed", m.live.kyc_rejected],
    ["Orders placed", m.live.orders],
    ["Activated", m.live.activated],
  ] as const;
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <h2 className="font-semibold">Success metrics</h2>
        <p className="text-xs text-muted">Baseline from last quarter&apos;s 5,000 leads; 12-month targets from the business case.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1.5 font-medium">Metric</th>
                <th className="py-1.5 text-right font-medium">Baseline</th>
                <th className="py-1.5 text-right font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {m.kpis.map((k) => (
                <tr key={k.name} className="border-t border-line">
                  <td className="py-2">{k.name}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{k.baseline}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-good">{k.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">This prototype, live</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          {live.map(([label, v]) => (
            <div key={label} className="rounded-xl bg-sunken p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-2xl font-bold tabular-nums">{v ?? 0}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="font-semibold">Propensity score</h2>
        <p className="mt-1 text-xs text-muted">
          Logistic regression on lead-time facts only (source, segment, size, city tier, GST/Udyam, current internet). Holdout AUC{" "}
          <b className="text-ink">{m.model.auc_holdout.toFixed(2)}</b>; the top 10% of leads activate at{" "}
          <b className="text-ink">{m.model.lift_top_decile.toFixed(1)}×</b> the average ({(m.model.base_rate * 100).toFixed(1)}%).
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {m.model.drivers.map((d) => (
            <li key={d.feature} className="flex items-center gap-2">
              <span className="flex-1">{d.feature}</span>
              <span className={`tabular-nums font-semibold ${d.odds_x >= 1 ? "text-good" : "text-bad"}`}>×{d.odds_x.toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted">× = change in odds of activating, other things equal.</p>
      </Card>
    </div>
  );
}
