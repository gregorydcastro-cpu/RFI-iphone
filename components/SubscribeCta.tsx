"use client";

import { formatBillingUnconfigured } from "@/lib/billingMessages";
import { type FormEvent, useState } from "react";

type Props = {
  configured: boolean;
  /** Unset Production env key names. Values are never passed. */
  missing?: readonly string[];
  defaultEmail?: string;
};

export function SubscribeCta({
  configured,
  missing = [],
  defaultEmail = "",
}: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
        missing?: string[];
      };
      if (!response.ok || !data.ok || !data.url) {
        setError(checkoutErrorMessage(data.error, data.missing));
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Could not reach billing. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-md space-y-4">
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Email for Checkout
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
          placeholder="foreman@crew.example"
        />
      </label>
      {!configured || missing.length > 0 ? (
        <p role="status" className="text-sm text-cta">
          {formatBillingUnconfigured(missing)}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-cta">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!configured || pending}
        className="w-full bg-cta px-4 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Redirecting…" : "Subscribe"}
      </button>
    </form>
  );
}

function checkoutErrorMessage(
  code: string | undefined,
  missing?: readonly string[],
): string {
  switch (code) {
    case "billing_unconfigured":
      return formatBillingUnconfigured(missing);
    case "checkout_failed":
    case "checkout_url_missing":
      return "Stripe Checkout could not start. The Price ID or secret key was rejected. This is not missing Production env.";
    default:
      return "Could not start Checkout. Try again.";
  }
}
