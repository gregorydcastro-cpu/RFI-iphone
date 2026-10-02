"use client";

import { ReadAloudButton } from "@/components/ReadAloudButton";
import { JOBS_PUNCH_RESULT_NEXT, JOBS_SHAKY_NEXT } from "@/lib/jobsNext";

/**
 * Standing next step on the jobs list.
 * Punch in and Open a job stay on the cards above.
 */
export function JobsNextStep() {
  return (
    <div
      role="status"
      className="mt-4 max-w-3xl border border-tan/80 bg-ink px-4 py-4"
    >
      <p className="text-base font-semibold leading-snug text-paper">
        {JOBS_SHAKY_NEXT}
      </p>
      <p className="mt-2 text-base leading-snug text-paper">
        {JOBS_PUNCH_RESULT_NEXT}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-12 items-center justify-center bg-cta px-4 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
        >
          Retry
        </button>
        <ReadAloudButton
          id="jobs-shaky-next"
          text={`${JOBS_SHAKY_NEXT} ${JOBS_PUNCH_RESULT_NEXT}`}
          label="Hear this"
        />
      </div>
    </div>
  );
}
