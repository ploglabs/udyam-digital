export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

// ---------- Types ----------
export type QuoteLine = {
  product_id: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  unit_price: number;
  monthly: number;
  setup: number;
  install_days: number;
  min_contract: number;
  reason?: string;
};
export type QuoteTotals = {
  monthly_total: number;
  gst_18pct: number;
  monthly_total_incl_gst: number;
  one_time_setup: number;
  contract_months: number;
  expected_activation_days: number;
  valid: boolean;
  errors: string[];
};
export type Quote = QuoteTotals & { lines: QuoteLine[] };
export type Bundle = {
  segment: string;
  items: QuoteLine[];
  excluded: { product_id: string; name: string; reasons: string[] }[];
  quote: QuoteTotals;
  profile: Record<string, unknown>;
};
export type Product = {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  price: number;
  setup: number;
  min_contract: number;
  install_days: number;
  requires_gstin: boolean;
  requires_one_of: string[];
  segments: string[];
  min_employees: number;
  min_sites: number;
};
export type Finding = { code: string; severity: "pass" | "warn" | "fail"; message: string; doc: string | null };
export type KycResult = {
  verdict: "approved" | "manual_review" | "rejected";
  gstin_active: boolean;
  business_name: string | null;
  findings: Finding[];
  summary: string[];
};
export type DocUpload = {
  doc_type: string;
  fields: Record<string, string | null>;
  quality_issues: string[];
  uploaded: string[];
  missing: string[];
};
export type TimelineStep = {
  key: string;
  label: string;
  description: string;
  status: "done" | "current" | "upcoming";
  completed_at: string | null;
  expected_by: string;
};
export type Order = {
  order_id: string;
  created: string;
  business_name: string;
  gstin: string;
  phone: string;
  items: QuoteLine[];
  quote: QuoteTotals;
  stage: string;
  eta: string;
  timeline: TimelineStep[];
};
export type ConsentNotice = {
  purposes: Record<string, string>;
  retention: string;
  data_collected: string[];
  not_collected: string[];
  grievance_contact: string;
};

// ---------- Calls ----------
export const api = {
  chat: (message: string, session_id?: string | null, language = "en") =>
    req<{ session_id: string; reply: string; bundle: Bundle | null }>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, session_id, language }),
    }),
  recommend: (profile: Record<string, unknown>) =>
    req<Bundle>("/recommend", { method: "POST", body: JSON.stringify(profile) }),
  catalogue: () => req<Product[]>("/catalogue"),
  quote: (items: [string, number][], profile?: Record<string, unknown>) =>
    req<Quote>("/quote", { method: "POST", body: JSON.stringify({ items, profile }) }),
  consentNotice: () => req<ConsentNotice>("/consent/notice"),
  consent: (purposes: string[]) =>
    req<{ consent_id: string; kyc_id: string; retention: string }>("/consent", {
      method: "POST",
      body: JSON.stringify({ purposes }),
    }),
  withdrawConsent: (id: string) => req<{ withdrawn: boolean }>(`/consent/${id}`, { method: "DELETE" }),
  uploadDoc: (kycId: string, file: Blob, name: string) => {
    const fd = new FormData();
    fd.append("file", file, name);
    return req<DocUpload>(`/kyc/${kycId}/document`, { method: "POST", body: fd });
  },
  verify: (kycId: string) => req<KycResult>(`/kyc/${kycId}/verify`, { method: "POST" }),
  createOrder: (items: [string, number][], kyc_id: string, phone: string, language: string) =>
    req<Order>("/orders", { method: "POST", body: JSON.stringify({ items, kyc_id, phone, language }) }),
  order: (id: string) => req<Order>(`/orders/${encodeURIComponent(id)}`),
  advance: (id: string) => req<Order>(`/orders/${encodeURIComponent(id)}/advance`, { method: "POST" }),
};

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
