"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

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
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-bold text-white">A</span>
          <span>
            Accel <span className="text-brand">Business</span>
          </span>
        </Link>
        <div className="ml-auto flex rounded-full border border-line p-0.5 text-xs font-medium">
          {(["en", "hi"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-full px-2.5 py-1 ${lang === l ? "bg-ink text-surface" : "text-muted"}`}
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
          <div className={`h-1 rounded-full ${i <= current ? "bg-brand" : "bg-line"}`} />
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
    primary: "bg-brand text-white hover:bg-brand-strong disabled:bg-line disabled:text-muted",
    secondary: "border border-line bg-surface text-ink hover:bg-sunken disabled:text-muted",
    ghost: "text-brand hover:bg-brand-soft",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition ${styles} ${className}`}
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
    <p role="alert" className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
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
