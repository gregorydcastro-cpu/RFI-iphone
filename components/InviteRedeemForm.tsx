"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { InviteRole, InviteStatus } from "@/lib/invites";

type Props = {
  token: string;
  status: InviteStatus;
  role: InviteRole | null;
  inviteeEmail: string | null;
  expiresAt: string | null;
  sessionEmail: string | null;
};

type RedeemResponse = {
  ok?: boolean;
  error?: string;
  role?: "puller" | "full" | "viewer";
  invite_role?: InviteRole;
};

export function InviteRedeemForm({
  token,
  status,
  role,
  inviteeEmail,
  expiresAt,
  sessionEmail,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(inviteeEmail ?? sessionEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [redeemedRole, setRedeemedRole] = useState<InviteRole | null>(null);

  const lockedEmail = Boolean(inviteeEmail);
  const roleLabel = role === "full" ? "full crew" : "view only";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/invites/${encodeURIComponent(token)}/redeem`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as RedeemResponse;
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Could not accept this invite.");
        return;
      }
      setRedeemedRole(data.invite_role ?? role);
      router.refresh();
    } catch {
      setError("Could not reach the invite service. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (status === "not_found") {
    return (
      <StatusCard
        title="Invite not found"
        body="This link is not a valid crew invite."
      />
    );
  }
  if (status === "expired") {
    return (
      <StatusCard
        title="Invite expired"
        body="Ask the GC or foreman for a new link."
      />
    );
  }
  if (status === "used") {
    return (
      <StatusCard
        title="Invite already used"
        body="This link is single-use. Sign in with the email that accepted it — the invited role stays on that account."
      />
    );
  }

  if (redeemedRole) {
    const full = redeemedRole === "full";
    return (
      <section className="w-full max-w-lg space-y-4 border border-line bg-panel p-5">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Invite
        </p>
        <h1 className="font-display text-2xl tracking-wide text-paper">
          You are in as {full ? "full crew" : "view only"}
        </h1>
        <p className="text-sm text-muted">
          {full
            ? "Connect your own Procore next. Access stays full crew — connecting does not change the invite role."
            : "View-only session. Sheets and red boxes only. Connecting Procore will not upgrade this account."}
        </p>
        <div className="flex flex-wrap gap-3">
          {full ? (
            <a
              href="/api/procore/connect"
              className="bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
            >
              Connect Procore
            </a>
          ) : null}
          <Link
            href="/jobs"
            className="border border-line px-5 py-2.5 text-sm font-semibold tracking-wide text-paper uppercase hover:border-cta"
          >
            Open jobs
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-lg space-y-4 border border-line bg-panel p-5"
    >
      <div>
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Invite
        </p>
        <h1 className="font-display mt-1 text-2xl tracking-wide text-paper sm:text-3xl">
          Join as {roleLabel}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Sign in with your own email, then{" "}
          {role === "full" ? "connect your own Procore" : "open packs read-only"}.
          Role is baked into this link and cannot be changed here.
        </p>
        {expiresAt ? (
          <p className="mt-2 text-xs text-tan">
            Expires {new Date(expiresAt).toLocaleString()}. Single-use.
          </p>
        ) : null}
      </div>
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Email
        <input
          required
          type="email"
          autoComplete="username"
          value={email}
          readOnly={lockedEmail}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
          placeholder="alex.rivera@crew.example"
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
        className="min-h-12 w-full bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {pending ? "Joining…" : `Accept ${roleLabel} invite`}
      </button>
    </form>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="w-full max-w-lg space-y-3 border border-line bg-panel p-5">
      <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
        Invite
      </p>
      <h1 className="font-display text-2xl tracking-wide text-paper">{title}</h1>
      <p className="text-sm text-muted">{body}</p>
      <Link href="/" className="inline-block text-sm text-accent underline">
        Sign in
      </Link>
    </section>
  );
}
