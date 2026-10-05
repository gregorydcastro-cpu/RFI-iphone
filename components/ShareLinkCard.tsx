"use client";

import { useState } from "react";
import { FieldFailureCard, FieldFailureEmpty } from "@/components/FieldFailureCard";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import {
  CREW_SEND_JOBS,
  SHARE_LINK_PATH,
  SHARE_SENT_MESSAGE,
  classifyCrewSendDraft,
  crewSendBanner,
  postCrewSend,
  type CrewSendBanner,
  type CrewSendEmpty,
  type CrewSendRole,
} from "@/lib/crewSendField";

type Props = {
  canSend: boolean;
};

export function ShareLinkCard({ canSend }: Props) {
  const [role, setRole] = useState<CrewSendRole>("viewer");
  const [email, setEmail] = useState("");
  const [job, setJob] = useState(CREW_SEND_JOBS[0].slug);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<CrewSendBanner | null>(null);
  const [empty, setEmpty] = useState<CrewSendEmpty | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSend() {
    if (pending) return;
    setLink(null);
    setSent(false);
    if (!canSend) {
      setEmpty(null);
      setFailure(crewSendBanner("share", "forbidden"));
      return;
    }
    const draft = classifyCrewSendDraft({
      kind: "share",
      recipient: email,
      role,
      job,
    });
    if (!draft.ok) {
      if ("empty" in draft) {
        setEmpty(draft.empty);
        setFailure(null);
      } else {
        setEmpty(null);
        setFailure(draft.banner);
      }
      return;
    }
    if (!draft.recipient || !draft.job) {
      setEmpty(null);
      setFailure(crewSendBanner("share", "invalid"));
      return;
    }

    setPending(true);
    setFailure(null);
    setEmpty(null);
    const result = await postCrewSend({
      kind: "share",
      path: SHARE_LINK_PATH,
      body: {
        recipient: draft.recipient,
        role: draft.role,
        job: draft.job.slug,
      },
      emailRequested: true,
    });
    setPending(false);
    if (!result.ok) {
      setFailure(result.banner);
      return;
    }
    setSent(true);
    setLink(result.url);
  }

  return (
    <section className="border border-line bg-panel p-5">
      <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
        Portal link
      </p>
      <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
        Send a share link
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Email a Maple Point or Cedar Ridge portal link. The address and role
        stay on this screen if the send does not go through.
      </p>

      <fieldset className="mt-4 space-y-2">
        <legend className="text-xs font-semibold tracking-wide text-muted uppercase">
          Role
        </legend>
        <label className="flex items-start gap-2 text-sm text-paper">
          <input
            type="radio"
            name="share-link-role"
            value="full"
            checked={role === "full"}
            onChange={() => setRole("full")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Full</span>
            <span className="mt-0.5 block text-xs text-muted">
              Normal crew tools for this job.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-paper">
          <input
            type="radio"
            name="share-link-role"
            value="viewer"
            checked={role === "viewer"}
            onChange={() => setRole("viewer")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Viewer</span>
            <span className="mt-0.5 block text-xs text-muted">
              Sheets and the red room box only.
            </span>
          </span>
        </label>
      </fieldset>

      <label className="mt-4 block text-xs font-semibold tracking-wide text-muted uppercase">
        Job
        <select
          value={job}
          onChange={(event) => setJob(event.target.value)}
          className="mt-1 w-full max-w-md border border-line bg-ink px-3 py-2 text-sm font-normal tracking-normal text-paper outline-none focus:border-cta"
        >
          {CREW_SEND_JOBS.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block max-w-md text-xs font-semibold tracking-wide text-muted uppercase">
        Email
        <input
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm font-normal tracking-normal text-paper outline-none focus:border-cta"
          placeholder="crew@maple-point.example"
        />
      </label>

      {failure ? (
        <div className="mt-4">
          <FieldFailureCard
            title={failure.title}
            message={failure.message}
            speak={failure.speak}
            speakId="share-link-error"
            onRetry={failure.retry ? () => void onSend() : undefined}
            retryDisabled={pending}
          />
        </div>
      ) : null}
      {empty ? (
        <div className="mt-4">
          <FieldFailureEmpty
            title={empty.title}
            message={empty.message}
            speak={empty.speak}
            speakId="share-link-empty"
          />
        </div>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => void onSend()}
        className="mt-4 w-full max-w-md bg-cta px-4 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send link"}
      </button>

      {sent ? (
        <div className="mt-4 max-w-md border border-line bg-ink p-3" role="status">
          <p className="text-sm text-accent-2">{SHARE_SENT_MESSAGE}</p>
          {link ? (
            <p className="mt-2 break-all font-mono text-xs text-paper">{link}</p>
          ) : null}
          <ReadAloudButton
            id="share-link-sent"
            text={SHARE_SENT_MESSAGE}
            label="Hear this"
            className="mt-3"
          />
        </div>
      ) : null}
    </section>
  );
}
