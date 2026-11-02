"use client";

// Journey state lives in sessionStorage: it survives page navigation but not a closed tab,
// and nothing personal is kept in long-lived browser storage.
import type { Bundle } from "./api";

export type Journey = {
  sessionId?: string | null;
  bundle?: Bundle | null;
  cart?: Record<string, number>; // product_id -> qty
  consentId?: string;
  kycId?: string;
  orderId?: string;
};

const KEY = "udyam-journey";

export function loadJourney(): Journey {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveJourney(patch: Partial<Journey>): Journey {
  const next = { ...loadJourney(), ...patch };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function clearJourney() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function cartItems(cart: Record<string, number> = {}): [string, number][] {
  return Object.entries(cart).filter(([, q]) => q > 0);
}
