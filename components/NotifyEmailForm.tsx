"use client";

import { type FormEvent, useState } from "react";
import type { NotifyEmailStorage } from "@/lib/accountNotifyEmail";

type Props = {
  initialEmail: string | null;
  storage: NotifyEmailStorage;
};

export function NotifyEmailForm({ initialEmail, storage }: Props) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/account/notify-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify_email: email }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        notify_email?: string | null;
        storage?: NotifyEmailStorage;
      };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Could not save notify email.");
        return;
      }
      setEmail(data.notify_email ?? "");
      setStatus(
        data.notify_email
          ? "Revision bump emails will go to this address."
          : "Notify email cleared. Bump alerts will not use a per-user address.",
      );
    } catch {
      setError("Could not reach the account service. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-lg border border-line bg-panel p-4 shadow-[0_0_0_1px_rgb(225_6_0_/_0.15)]"
    >
      <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
        Alerts
      </p>
      <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
        Revision bump email
      </h2>
      <p className="mt-2 text-sm text-muted">
        Sheet-rev bump alerts go to the puller running this job — not a
        shared inbox. This is separate from your Procore login email.
      </p>
      <label className="mt-4 block text-xs font-semibold tracking-wide text-muted uppercase">
        Notify email
        <input
          type="email"
          name="notify_email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
          placeholder="foreman@crew.example"
        />
      </label>
      <p className="mt-1 text-xs text-metal">
        Leave blank to clear. Saved on this user&apos;s{" "}
        <span className="font-mono">procore_connections.notify_email</span>
        {storage === "memory"
          ? " (local demo memory until Supabase is set)"
          : ""}.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-cta">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="mt-3 text-sm text-accent-2">
          {status}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save notify email"}
      </button>
    </form>
  );
}
