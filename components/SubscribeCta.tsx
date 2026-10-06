"use client";

import { BILLING_OPENS_SOON } from "@/lib/billingPublicCopy";
import { type FormEvent, useId, useState } from "react";

type Props = {
  configured: boolean;
  defaultEmail?: string;
};

type CheckoutPayload = {
  ok?: boolean;
  url?: string;
  error?: string;
  missing?: string[];
};

export function SubscribeCta({
  configured,
  defaultEmail = "",
}: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [pending, setPending] = useState(false);
  const statusId = useId();
  const showHeld = !configured || held;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
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
      const data = await readCheckoutJson(response);
      const feedback = checkoutFeedback(data.error);
      if (feedback.kind === "held") {
        setHeld(true);
        return;
      }
      if (!response.ok || !data.ok || !data.url) {
        setHeld(false);
        setError(feedback.message);
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
      {showHeld ? (
        <BillingHeldNotice id={statusId} confirmed={held} />
      ) : (
        <p id={statusId} role="status" className="text-xs leading-relaxed text-muted">
          Checkout is ready. Stripe key values stay on the server.
        </p>
      )}
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
      {error ? (
        <p role="alert" className="text-sm text-cta">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        aria-describedby={statusId}
        className="w-full bg-cta px-4 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60 sm:w-auto"
      >
        {pending
          ? configured
            ? "Redirecting…"
            : "Checking…"
          : "Subscribe"}
      </button>
    </form>
  );
}

function BillingHeldNotice({
  id,
  confirmed,
}: {
  id: string;
  confirmed: boolean;
}) {
  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      className={
        confirmed
          ? "text-sm leading-relaxed text-muted"
          : "sr-only"
      }
    >
      {confirmed
        ? "Checkout stayed closed. Nothing was charged — it will open on this page when billing is turned on."
        : BILLING_OPENS_SOON}
    </p>
  );
}

async function readCheckoutJson(response: Response): Promise<CheckoutPayload> {
  try {
    return (await response.json()) as CheckoutPayload;
  } catch {
    return {};
  }
}

function checkoutFeedback(
  code: string | undefined,
): { kind: "held" } | { kind: "error"; message: string } {
  switch (code) {
    case "billing_unconfigured":
      return { kind: "held" };
    case "checkout_failed":
    case "checkout_url_missing":
      return {
        kind: "error",
        message:
          "Stripe Checkout could not start. The Price ID or secret key was rejected. This is not missing Production env.",
      };
    default:
      return { kind: "error", message: "Could not start Checkout. Try again." };
  }
}
