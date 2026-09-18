"use client";

import { type FormEvent, useState } from "react";
import type { InviteRole } from "@/lib/invites";

type MintResponse = {
  ok?: boolean;
  error?: string;
  token?: string;
  role?: InviteRole;
  url?: string;
  invitee_email?: string | null;
  expires_at?: string;
  storage?: string;
};

export function InviteCreateForm() {
  const [role, setRole] = useState<InviteRole>("viewer");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<MintResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setCopied(false);
    setLink(null);

    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          invitee_email: inviteeEmail.trim() || null,
        }),
      });
      const data = (await response.json()) as MintResponse;
      if (!response.ok || !data.ok || !data.url) {
        setError(data.error ?? "Could not create invite.");
        return;
      }
      setLink(data);
    } catch {
      setError("Could not reach the invite service. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
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
          Crew invite link
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pick a role, optionally add their email, and copy one unique URL.
          They sign in with their own Procore. Role stays as invited.
        </p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold tracking-wide text-muted uppercase">
          Role
        </legend>
        <label className="flex items-start gap-2 text-sm text-paper">
          <input
            type="radio"
            name="invite-role"
            value="viewer"
            checked={role === "viewer"}
            onChange={() => setRole("viewer")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">View only</span>
            <span className="mt-0.5 block text-xs text-muted">
              Sheets and red boxes / overlays. No markup, print, or drafts.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-paper">
          <input
            type="radio"
            name="invite-role"
            value="full"
            checked={role === "full"}
            onChange={() => setRole("full")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Full crew</span>
            <span className="mt-0.5 block text-xs text-muted">
              Normal dashboard (puller): request prints, markup, drafts to
              the foreman.
            </span>
          </span>
        </label>
      </fieldset>
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Invitee email (optional)
        <input
          type="email"
          value={inviteeEmail}
          onChange={(event) => setInviteeEmail(event.target.value)}
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
        className="min-h-12 bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {pending ? "Creating…" : "Generate link"}
      </button>
      {link?.url ? (
        <div className="space-y-2 border border-line bg-ink p-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            Unique link · {link.role === "full" ? "full crew" : "view only"}
          </p>
          <p className="break-all font-mono text-xs text-paper">{link.url}</p>
          <p className="text-xs text-tan">
            Single-use. Expires {link.expires_at ? new Date(link.expires_at).toLocaleString() : "soon"}
            {link.invitee_email ? ` · ${link.invitee_email}` : ""}.
          </p>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="border border-cta px-4 py-2 text-xs font-semibold tracking-wide text-secondary uppercase hover:bg-cta"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
