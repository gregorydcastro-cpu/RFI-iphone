"use client";

/**
 * Field login chrome. POSTs to /api/session (email/password or magic link).
 * No role picker. No stub / guest bypass.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  FieldAuthModeSwitch,
  FIELD_AUTH_INPUT_CLASS,
} from "@/components/FieldAuthModeSwitch";
import {
  authUnconfiguredMessage,
  friendlyAuthError,
  loginCallbackMessage,
  loginModeCopy,
  safeNextPath,
  type FieldAuthMode,
} from "@/lib/authMessages";

type Props = {
  authConfigured?: boolean;
};

export function LoginForm({ authConfigured = true }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<FieldAuthMode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const copy = loginModeCopy(mode);
  const callbackError = loginCallbackMessage(
    searchParams.get("auth"),
    searchParams.get("reason"),
  );
  const configError = authConfigured ? null : authUnconfiguredMessage();
  const bannerError = error ?? configError ?? callbackError;

  function changeMode(next: FieldAuthMode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setShowPassword(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !authConfigured) return;
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: mode === "otp" ? undefined : password,
          mode,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        needsEmailConfirm?: boolean;
      };
      if (!response.ok || !data.ok) {
        setError(friendlyAuthError(data.error, "Could not sign in."));
        return;
      }
      if (data.needsEmailConfirm) {
        setInfo(
          mode === "otp"
            ? "Check your email for a sign-in link."
            : "Check your email to confirm this account, then sign in.",
        );
        return;
      }
      router.push(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("Could not reach auth. Check the connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-busy={pending}
      className="w-full max-w-md border-l-4 border-l-cta border-y border-r border-line bg-panel p-6 shadow-[0_0_0_1px_rgb(225_6_0_/_0.18)] sm:p-8"
    >
      <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
        GC Field Log
      </p>
      <h1 className="font-display mt-1 text-3xl tracking-wide text-secondary sm:text-4xl">
        {copy.title}
      </h1>
      <p className="mt-2 text-base text-accent-2">{copy.helper}</p>

      <div className="mt-6">
        <FieldAuthModeSwitch
          mode={mode}
          onChange={changeMode}
          disabled={pending}
        />
      </div>

      <label className="mt-6 block text-sm font-semibold tracking-wide text-muted uppercase">
        Email
        <input
          required
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
          className={`mt-1 ${FIELD_AUTH_INPUT_CLASS}`}
          placeholder="foreman@crew.example"
        />
      </label>

      {mode !== "otp" ? (
        <label className="mt-4 block text-sm font-semibold tracking-wide text-muted uppercase">
          Password
          <span className="relative mt-1 block">
            <input
              required
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
              className={`${FIELD_AUTH_INPUT_CLASS} pr-24`}
              placeholder="••••••••"
              minLength={6}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 min-h-14 min-w-20 px-3 text-xs font-semibold tracking-wide text-muted uppercase hover:text-paper"
              onClick={() => setShowPassword((value) => !value)}
              disabled={pending}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>
      ) : null}

      {bannerError ? (
        <p
          role="alert"
          className="mt-5 border border-cta/50 bg-cta/10 px-4 py-3 text-base text-cta"
        >
          {bannerError}
        </p>
      ) : null}
      {info ? (
        <p
          role="status"
          className="mt-5 border border-accent-2/40 bg-panel-2 px-4 py-3 text-base text-accent-2"
        >
          {info}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !authConfigured}
        className="mt-6 min-h-14 w-full bg-cta px-5 text-base font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {pending ? copy.pending : copy.submit}
      </button>
    </form>
  );
}
