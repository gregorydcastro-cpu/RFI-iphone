"use client";

import { useState } from "react";
import {
  createInviteRequestBody,
  INVITE_CREATE_PATH,
  resolveInviteDisplayUrl,
  type CreateInviteFailure,
  type CreateInviteSuccess,
  type InviteRole,
} from "@/lib/inviteRole";

type Props = {
  canInvite: boolean;
};

export function InviteCrewCard({ canInvite }: Props) {
  const [role, setRole] = useState<InviteRole>("full");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!canInvite) return null;

  async function onGenerate() {
    if (pending) return;
    setPending(true);
    setError(null);
    setCopied(false);

    const body = createInviteRequestBody({
      role,
      invitee_email: email,
    });
    if ("error" in body) {
      setError(body.error);
      setPending(false);
      return;
    }

    try {
      const response = await fetch(INVITE_CREATE_PATH, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data: CreateInviteSuccess | CreateInviteFailure | null = null;
      try {
        data = (await response.json()) as
          | CreateInviteSuccess
          | CreateInviteFailure;
      } catch {
        data = null;
      }
      if (!response.ok || !data || !data.ok || !data.url) {
        setError(
          (data && !data.ok && data.error) ||
            "Could not generate an invite link. Try again.",
        );
        return;
      }

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setLink(resolveInviteDisplayUrl(data.url, origin));
    } catch {
      setError("Could not reach the invite service. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function onCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("Could not copy. Select the link and copy it.");
    }
  }

  return (
    <section
      id="invite"
      className="max-w-lg border border-line bg-panel p-4"
    >
      <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
        Invite
      </p>
      <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
        Invite crew
      </h2>
      <p className="mt-2 text-sm text-muted">
        Generate a shareable Maple Point link. Role is stored on the token
        server-side — the URL path alone is not a role.
      </p>

      <fieldset className="mt-4 space-y-2">
        <legend className="text-xs font-semibold tracking-wide text-muted uppercase">
          Role
        </legend>
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
            <span className="font-medium">Full</span>
            <span className="mt-0.5 block text-xs text-muted">
              Normal crew tools for this job — markup, drafts, order
              materials.
            </span>
          </span>
        </label>
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
            <span className="font-medium">Viewer</span>
            <span className="mt-0.5 block text-xs text-muted">
              Sheets and the red room box only. No pull, print, or markup.
            </span>
          </span>
        </label>
      </fieldset>

      <label className="mt-4 block text-xs font-semibold tracking-wide text-muted uppercase">
        Email <span className="font-normal normal-case">(optional)</span>
        <input
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
          placeholder="crew@maple-point.example"
        />
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-cta">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => void onGenerate()}
        className="mt-4 w-full bg-cta px-4 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate link"}
      </button>

      {link ? (
        <div className="mt-4 border border-line bg-ink p-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            Share this link
          </p>
          <p className="mt-2 break-all font-mono text-xs text-paper">{link}</p>
          <button
            type="button"
            onClick={() => void onCopy()}
            className="mt-3 border border-cta bg-cta px-4 py-2 text-xs font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
