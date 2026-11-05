"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

const LOGO_PATH =
  "M1083 936 c-6 -1 -45 -14 -120 -40 -46 -15 -103 -35 -127 -43 -51 -17 -53 -17 -61 -26 -10 -10 -10 -9 -33 -100 -5 -20 -13 -53 -19 -74 -6 -21 -14 -53 -18 -71 -11 -40 -13 -48 -17 -54 -10 -16 -31 -16 -43 1 -7 8 -18 24 -30 41 -5 8 -16 23 -24 34 -7 10 -18 26 -25 35 -70 99 -74 104 -104 112 -33 10 -59 4 -96 -22 -9 -6 -25 -17 -36 -24 -11 -8 -29 -20 -40 -28 -11 -7 -30 -21 -42 -29 -12 -8 -37 -25 -54 -37 -17 -12 -38 -27 -46 -32 -8 -6 -22 -15 -30 -22 -41 -27 -64 -44 -84 -58 -25 -17 -31 -22 -33 -27 -4 -10 4 -19 16 -19 5 0 11 1 54 11 9 1 23 5 32 7 8 1 21 4 27 5 6 2 16 4 23 5 58 14 152 32 215 42 90 15 122 7 209 -49 108 -70 117 -75 148 -74 45 0 55 8 110 94 7 10 18 28 25 39 7 11 16 25 21 32 4 6 18 27 31 47 34 52 64 99 77 119 6 10 17 27 24 38 8 11 19 28 25 38 7 9 17 25 23 35 29 42 42 63 44 67 8 16 -4 32 -22 27z M426 479 c-31 -6 -46 -18 -74 -64 -35 -55 -33 -52 -80 -129 -52 -85 -58 -95 -83 -135 -6 -9 -14 -23 -18 -30 -16 -25 -31 -49 -41 -67 -22 -34 -24 -43 -12 -51 9 -6 7 -7 144 41 49 18 91 32 120 42 49 17 53 20 59 56 2 9 4 21 5 27 1 5 6 29 10 52 27 141 24 131 33 138 8 7 20 7 29 1 4 -3 17 -18 40 -47 6 -9 22 -29 34 -45 13 -17 29 -38 36 -47 35 -46 43 -55 49 -61 28 -23 64 -28 99 -13 12 5 50 30 192 124 74 49 95 63 131 87 16 10 19 14 19 22 0 14 -11 18 -37 14 -6 -1 -31 -5 -57 -8 -26 -4 -48 -7 -50 -7 -16 -3 -76 -11 -88 -13 -9 -1 -31 -4 -48 -7 -121 -16 -154 -12 -222 29 -17 10 -55 34 -91 57 -46 30 -72 39 -99 34z";

/** NorthStar mark, traced from public/logo.png (also at public/logo.svg). Inherits text colour. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1118 937" fill="currentColor" aria-hidden className={className}>
      <path transform="translate(0 937) scale(1 -1)" d={LOGO_PATH} />
    </svg>
  );
}

export function Header({ back }: { back?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
        {back && (
          <Link href={back} aria-label="Back" className="-ml-2 rounded-full p-2 text-muted hover:bg-sunken">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        )}
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo className="h-6 w-7" />
          <span>
            North<span className="text-brand">Star</span>
          </span>
        </Link>
        <div className="relative ml-auto grid grid-cols-2 rounded-full border border-line p-0.5 text-xs font-medium">
          <span
            aria-hidden
            className={`btn-3d btn-3d-solid absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-ink ${lang === "hi" ? "translate-x-full" : ""}`}
          />
          {(["en", "hi"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`relative w-9 rounded-full py-1 transition-colors duration-200 ${lang === l ? "text-surface" : "text-muted"}`}
            >
              {l === "en" ? "EN" : "हिं"}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

const STEPS = ["Advisor", "Quote", "KYC", "Track"];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="mx-auto flex max-w-md gap-1.5 px-4 pt-3" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex-1">
          <div className="h-1 overflow-hidden rounded-full bg-line">
            {i <= current && <div className={`h-full rounded-full bg-brand ${i === current ? "animate-grow-x" : ""}`} />}
          </div>
          <span className={`mt-1 block text-[11px] ${i === current ? "font-semibold text-ink" : "text-muted"}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-4">{children}</main>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</div>;
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "btn-3d-solid bg-brand text-white hover:bg-brand-strong disabled:bg-line disabled:text-muted",
    secondary: "border border-line bg-surface text-ink hover:bg-sunken disabled:text-muted",
    ghost: "border border-line bg-surface text-brand hover:bg-brand-soft",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold btn-3d ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      aria-hidden
    />
  );
}

export function ErrorNote({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p role="alert" className="animate-rise mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
      {msg}
    </p>
  );
}

/** Minimal markdown for advisor replies: **bold**, bullet lines, paragraphs. */
export function Markdownish({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
    );
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[*-]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[*-]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {inline(l.replace(/^\s*[*-]\s+/, "• "))}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
