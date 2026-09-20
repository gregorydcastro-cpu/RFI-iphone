"use client";

import type { FieldAuthMode } from "@/lib/authMessages";

const MODES: { id: FieldAuthMode; label: string }[] = [
  { id: "signin", label: "Sign in" },
  { id: "signup", label: "Create account" },
  { id: "otp", label: "Magic link" },
];

export const FIELD_AUTH_INPUT_CLASS =
  "min-h-14 w-full border border-line bg-ink px-4 text-base text-paper outline-none focus:border-cta disabled:opacity-60";

type Props = {
  mode: FieldAuthMode;
  onChange: (mode: FieldAuthMode) => void;
  disabled?: boolean;
};

export function FieldAuthModeSwitch({ mode, onChange, disabled }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Sign-in method"
      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
    >
      {MODES.map((item) => {
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            className={
              active
                ? "min-h-14 border border-cta bg-cta px-3 text-sm font-semibold tracking-wide text-secondary uppercase disabled:opacity-60"
                : "min-h-14 border border-line bg-ink px-3 text-sm font-semibold tracking-wide text-muted uppercase hover:border-cta hover:text-paper disabled:opacity-60"
            }
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
