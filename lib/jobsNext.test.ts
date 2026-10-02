import assert from "node:assert/strict";
import { test } from "node:test";
import {
  JOBS_OPEN_FAILED,
  JOBS_OPEN_FORBIDDEN,
  JOBS_PUNCH_RESULT_NEXT,
  JOBS_SHAKY_NEXT,
  jobsFailureFromUnknown,
  jobsOpenFailure,
} from "./jobsNext.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107|supabase|api[_ ]?key|cookie|header/i;

test("shaky-network next step names open, punch, and retry", () => {
  assert.match(JOBS_SHAKY_NEXT, /Open a job/);
  assert.match(JOBS_SHAKY_NEXT, /punch/i);
  assert.match(JOBS_SHAKY_NEXT, /Retry/);
  assert.ok(JOBS_SHAKY_NEXT.length <= 64, JOBS_SHAKY_NEXT);
  assert.ok(JOBS_OPEN_FAILED.length <= 48, JOBS_OPEN_FAILED);
  assert.match(JOBS_PUNCH_RESULT_NEXT, /saved/i);
  assert.match(JOBS_PUNCH_RESULT_NEXT, /did not save/i);
  assert.match(JOBS_PUNCH_RESULT_NEXT, /not punched in/i);
  assert.ok(JOBS_PUNCH_RESULT_NEXT.length <= 64, JOBS_PUNCH_RESULT_NEXT);
  const blob = [
    JOBS_SHAKY_NEXT,
    JOBS_PUNCH_RESULT_NEXT,
    JOBS_OPEN_FAILED,
    JOBS_OPEN_FORBIDDEN,
  ].join(" ");
  assert.doesNotMatch(blob, forbidden);
});

test("a dropped open becomes the shaky next step, not the server string", () => {
  assert.deepEqual(jobsOpenFailure({ offline: true, error: "Failed to fetch" }), {
    message: JOBS_SHAKY_NEXT,
    retry: true,
  });
  assert.deepEqual(
    jobsOpenFailure({
      status: 0,
      error: "TypeError: Failed to fetch",
    }),
    { message: JOBS_SHAKY_NEXT, retry: true },
  );
  assert.equal(
    jobsOpenFailure({
      status: 403,
      error:
        "Puller role required. Connect Procore (procoreLinked cookie after OAuth, or x-procore-linked header).",
    }).message,
    JOBS_OPEN_FORBIDDEN,
  );
  assert.equal(jobsOpenFailure({ status: 403 }).retry, false);
  assert.equal(jobsOpenFailure({ status: 500, error: "boom" }).message, JOBS_OPEN_FAILED);
  assert.equal(jobsOpenFailure({ status: 404 }).retry, false);
  assert.doesNotMatch(
    jobsOpenFailure({ status: 403, error: "procoreLinked cookie" }).message,
    /cookie|header|Procore/i,
  );
});

test("unknown throw with status 0 uses the shaky line", () => {
  const error = new Error("Failed to fetch");
  (error as Error & { status?: number }).status = 0;
  assert.deepEqual(jobsFailureFromUnknown(error), {
    message: JOBS_SHAKY_NEXT,
    retry: true,
  });
  assert.equal(jobsFailureFromUnknown("nope").message, JOBS_OPEN_FAILED);
});
