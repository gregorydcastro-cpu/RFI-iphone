"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  FieldAuthModeSwitch,
  FIELD_AUTH_INPUT_CLASS,
} from "@/components/FieldAuthModeSwitch";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import {
  friendlyAuthError,
  inviteAcceptedMessage,
  inviteConfirmMessage,
  inviteBlockedAction,
  inviteFormHelper,
  inviteLanding,
  type FieldAuthMode,
} from "@/lib/authMessages";
import type { InviteRole, InviteStatus } from "@/lib/invites";

type Props = {
  token: string;
  status: InviteStatus;
  role: InviteRole | null;
  inviteeEmail: string | null;
  expiresAt: string | null;
  sessionEmail: string | null;
  signedIn: boolean;
};

type RedeemResponse = {
  ok?: boolean;
  error?: string;
  role?: "puller" | "full" | "viewer";
  invite_role?: InviteRole;
  needsEmailConfirm?: boolean;
};

export function InviteRedeemForm({
  token,
  status,
  role,
  inviteeEmail,
  expiresAt,
  sessionEmail,
  signedIn,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(
    signedIn ? (sessionEmail ?? inviteeEmail ?? "") : (inviteeEmail ?? ""),
  );
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<FieldAuthMode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [redeemedRole, setRedeemedRole] = useState<InviteRole | null>(null);

  const lockedEmail = signedIn || Boolean(inviteeEmail);
  const roleLabel = role === "full" ? "full crew" : "view only";
  const helper = inviteFormHelper({
    signedIn,
    role,
    sessionEmail,
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch(`/api/invites/${encodeURIComponent(token)}/redeem`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: signedIn || mode === "otp" ? undefined : password,
          mode: signedIn ? undefined : mode,
        }),
      });
      const data = (await response.json()) as RedeemResponse;
      if (!response.ok || !data.ok) {
        setError(friendlyAuthError(data.error, "Could not accept this invite."));
        return;
      }
      if (data.needsEmailConfirm) {
        setInfo(inviteConfirmMessage(mode === "otp" ? "otp" : "signup"));
        return;
      }
      setRedeemedRole(data.invite_role ?? role ?? "viewer");
      router.refresh();
    } catch {
      setError("Could not reach the invite service. Try again.");
    } finally {
      setPending(false);
    }
  }

  // Keep the success card ahead of the refreshed "used" status so a
  // single-use redeem does not flip into a failure.
  if (redeemedRole) {
    const accepted = inviteAcceptedMessage(redeemedRole === "full" ? "full" : "viewer");
    const spoken = `${accepted.title}. ${accepted.body}`;
    return (
      <section className="w-full max-w-lg space-y-4 border border-line bg-panel p-5">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Invite
        </p>
        <h1 className="font-display text-2xl tracking-wide text-paper">
          {accepted.title}
        </h1>
        <p className="text-sm text-muted">{accepted.body}</p>
        <div className="flex flex-wrap gap-3">
          {redeemedRole === "full" ? (
            // Full navigation to the Procore connect route handler.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
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
        <ReadAloudButton id="invite-accepted" text={spoken} label="Hear this" />
      </section>
    );
  }

  const landing = inviteLanding({
    status,
    signedIn,
    inviteeEmail,
    sessionEmail,
  });
  if (landing.kind === "blocked") {
    const action = inviteBlockedAction(landing, token);
    return (
      <InviteBlockedCard
        title={landing.title}
        body={landing.body}
        actionHref={action.href}
        actionLabel={action.label}
      />
    );
  }

  const spoken = error ?? info ?? helper;

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
        <p className="mt-2 text-sm text-muted">{helper}</p>
        {expiresAt ? (
          <p className="mt-2 text-xs text-tan">
            Expires {new Date(expiresAt).toLocaleString()}. Single-use.
          </p>
        ) : null}
      </div>
      {!signedIn ? (
        <FieldAuthModeSwitch mode={mode} onChange={setMode} disabled={pending} />
      ) : null}
      <label className="block text-sm font-semibold tracking-wide text-muted uppercase">
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
          readOnly={lockedEmail}
          onChange={(event) => setEmail(event.target.value)}
          className={`mt-1 ${FIELD_AUTH_INPUT_CLASS}`}
          placeholder="alex.rivera@crew.example"
        />
      </label>
      {!signedIn && mode !== "otp" ? (
        <label className="block text-sm font-semibold tracking-wide text-muted uppercase">
          Password
          <input
            required
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`mt-1 ${FIELD_AUTH_INPUT_CLASS}`}
            placeholder="••••••••"
            minLength={6}
          />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="border border-cta/50 bg-cta/10 px-4 py-3 text-base text-cta">
          {error}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="border border-accent-2/40 bg-panel-2 px-4 py-3 text-base text-accent-2">
          {info}
        </p>
      ) : null}
      <ReadAloudButton id="invite-status" text={spoken} label="Hear this" />
      <button
        type="submit"
        disabled={pending}
        className="min-h-14 w-full bg-cta px-5 text-base font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {pending ? "Joining…" : `Accept ${roleLabel} invite`}
      </button>
    </form>
  );
}

export function InviteBlockedCard({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section className="w-full max-w-lg space-y-3 border border-line bg-panel p-5">
      <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
        Invite
      </p>
      <h1 className="font-display text-2xl tracking-wide text-paper">{title}</h1>
      <p className="text-sm text-muted">{body}</p>
      {actionHref.startsWith("/api/") ? (
        <a href={actionHref} className="inline-block text-sm text-accent underline">
          {actionLabel}
        </a>
      ) : (
        <Link href={actionHref} className="inline-block text-sm text-accent underline">
          {actionLabel}
        </Link>
      )}
      <ReadAloudButton
        id="invite-blocked"
        text={`${title}. ${body}`}
        label="Hear this"
      />
    </section>
  );
}
