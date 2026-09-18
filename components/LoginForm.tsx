"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { FieldRoleName } from "@/lib/auth";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/jobs";
  }
  if (raw.includes("://")) return "/jobs";
  return raw;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<FieldRoleName>("viewer");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Could not start a session");
        return;
      }
      console.info("[gcfieldlog] stub login — no real auth yet", {
        email,
        role,
      });
      // Full document navigation so the httpOnly cookie is on the next
      // request (Share / Jobs) instead of a stale Next.js client cache.
      window.location.assign(safeNextPath(searchParams.get("next")));
    } catch {
      setError("Could not reach the session service. Try again.");
    } finally {
      setPending(false);
    }
  }

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
          Stub login. No real auth or Apple sign-in. Viewers open packs
          without Procore. Pullers connect their own Procore account to
          pull. Monthly billing is a 60-day Stripe Checkout trial on{" "}
          <a href="/pricing" className="text-accent underline">
            /pricing
          </a>
          .
        </p>
      </div>
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
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Password
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
          placeholder="••••••••"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold tracking-wide text-muted uppercase">
          Role
        </legend>
        <label className="flex items-start gap-2 text-sm text-paper">
          <input
            type="radio"
            name="role"
            value="viewer"
            checked={role === "viewer"}
            onChange={() => setRole("viewer")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">View only</span>
            <span className="mt-0.5 block text-xs text-muted">
              Open packs. No Procore connect required. Cannot trigger a pull.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-paper">
          <input
            type="radio"
            name="role"
            value="puller"
            checked={role === "puller"}
            onChange={() => setRole("puller")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Puller</span>
            <span className="mt-0.5 block text-xs text-muted">
              Must Connect Procore with your own credentials. No developer
              portal signup.
            </span>
          </span>
        </label>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-cta">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-cta px-4 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {pending ? "Entering…" : "Enter dashboard"}
      </button>
    </form>
  );
}
