"use client";

import {
  billingEnvNames,
  formatBillingUnconfigured,
} from "@/lib/billingMessages";
import { type FormEvent, useId, useState } from "react";

type Props = {
  configured: boolean;
  /** Unset Production env key names. Values are never passed. */
  missing?: readonly string[];
  defaultEmail?: string;
};

type CheckoutPayload = {
  ok?: boolean;
  url?: string;
  error?: string;
  missing?: string[];
};

const BILLING_HELD_TITLE = "Billing isn't live yet";

export function SubscribeCta({
  configured,
  missing = [],
  defaultEmail = "",
}: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [apiMissing, setApiMissing] = useState<readonly string[]>([]);
  const [pending, setPending] = useState(false);
  const statusId = useId();
  const namedMissing = billingEnvNames([...missing, ...apiMissing]);
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
        if (data.missing?.length) setApiMissing(data.missing);
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
        <BillingHeldNotice
          id={statusId}
          confirmed={held}
          missing={namedMissing}
        />
      ) : namedMissing.length > 0 ? (
        <p id={statusId} role="status" className="text-xs leading-relaxed text-tan">
          {formatBillingUnconfigured(namedMissing)}
        </p>
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
  missing,
}: {
  id: string;
  confirmed: boolean;
  missing: readonly string[];
}) {
  return (
    <div id={id} role="status" aria-live="polite" className="border border-line bg-ink">
      <div className="h-0.5 w-full bg-cta" aria-hidden />
      <div className="px-3 py-3">
        <p className="font-display text-base tracking-wide text-paper">
          {BILLING_HELD_TITLE}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {confirmed
            ? "Checkout stayed closed. Nothing was charged — it will open on this page when billing is turned on."
            : "Checkout is coming soon. Nothing is charged from this page until billing opens."}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-tan">
          {formatBillingUnconfigured(missing)}
        </p>
      </div>
    </div>
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
