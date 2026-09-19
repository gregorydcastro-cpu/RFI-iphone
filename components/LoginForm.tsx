"use client";

/**
 * Working Auth form only. Field Log owns login chrome / session-route polish.
 * Do not add product copy or role pickers here.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

type Mode = "signin" | "signup" | "otp";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const authReason = searchParams.get("reason");
  const authFlag = searchParams.get("auth");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
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
        setError(data.error ?? "Could not sign in");
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
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : "/jobs");
      router.refresh();
    } catch {
      setError("Could not reach auth. Try again.");
    } finally {
      setPending(false);
    }
  }

  const submitLabel =
    mode === "otp"
      ? pending
        ? "Sending…"
        : "Email me a link"
      : mode === "signup"
        ? pending
          ? "Creating…"
          : "Create account"
        : pending
          ? "Signing in…"
          : "Sign in";

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md space-y-4 border border-line bg-panel p-6 shadow-[0_0_0_1px_rgb(225_6_0_/_0.15)]"
    >
      <div>
        <h1 className="font-display text-3xl tracking-wide text-secondary">
          GC Field Log
        </h1>
        <p className="mt-2 text-sm text-accent-2">
          Email and password, or a magic link.
        </p>
      </div>
      {authFlag === "error" ? (
        <p role="alert" className="text-sm text-cta">
          {authReason === "auth_unconfigured"
            ? "Supabase Auth is not configured on this host."
            : "Sign-in link expired or failed. Try again."}
        </p>
      ) : null}
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Email
        <input
          required
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
          placeholder="foreman@crew.example"
        />
      </label>
      {mode !== "otp" ? (
        <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
          Password
          <input
            required
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
            placeholder="••••••••"
            minLength={6}
          />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          className={
            mode === "signin"
              ? "border border-cta px-2 py-1 text-paper"
              : "border border-line px-2 py-1 text-muted"
          }
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={
            mode === "signup"
              ? "border border-cta px-2 py-1 text-paper"
              : "border border-line px-2 py-1 text-muted"
          }
          onClick={() => setMode("signup")}
        >
          Create account
        </button>
        <button
          type="button"
          className={
            mode === "otp"
              ? "border border-cta px-2 py-1 text-paper"
              : "border border-line px-2 py-1 text-muted"
          }
          onClick={() => setMode("otp")}
        >
          Magic link
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-cta">
          {error}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="text-sm text-accent-2">
          {info}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-cta px-4 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  );
}
