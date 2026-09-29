"use client";

import { type FormEvent, useState } from "react";

type Props = {
  configured: boolean;
  defaultEmail?: string;
};

export function SubscribeCta({ configured, defaultEmail = "" }: Props) {
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
      };
      if (!response.ok || !data.ok || !data.url) {
        setError(checkoutErrorMessage(data.error));
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
      {!configured ? (
        <p className="text-sm text-cta">
          Stripe keys are missing on Vercel. Set{" "}
          <code className="font-mono">STRIPE_SECRET_KEY</code> and{" "}
          <code className="font-mono">STRIPE_PRICE_ID</code> on Production
          (server-only).
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

function checkoutErrorMessage(code: string | undefined): string {
  switch (code) {
    case "billing_unconfigured":
      return "Stripe keys are missing on Vercel. Checkout cannot start until they are set.";
    case "checkout_failed":
    case "checkout_url_missing":
      return "Stripe Checkout could not start. Check the Price ID and secret key.";
    default:
      return "Could not start Checkout. Try again.";
  }
}
