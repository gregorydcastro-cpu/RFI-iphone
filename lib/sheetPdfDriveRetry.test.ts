import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { resetDriveTokenCache } from "./driveAuth.ts";
import { fetchDrivePdf, shouldRefreshDriveToken } from "./sheetPdfDownload.ts";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const account = {
  clientEmail: "packs@example.iam.gserviceaccount.com",
  privateKey: pem,
};

const auth = { kind: "service_account" as const, account };

function pdfResponse(): Response {
  return new Response(new TextEncoder().encode("%PDF-1.4\n"), {
    status: 200,
    headers: { "content-type": "application/pdf" },
  });
}

function tokenResponse(token: string): Response {
  return new Response(
    JSON.stringify({ access_token: token, expires_in: 3600 }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

test("a Drive 401 refreshes the token once and then stops", async () => {
  resetDriveTokenCache();
  assert.equal(
    shouldRefreshDriveToken({ code: "drive_auth_rejected", allowRefresh: true }),
    true,
  );
  assert.equal(
    shouldRefreshDriveToken({ code: "drive_auth_rejected", allowRefresh: false }),
    false,
  );
  assert.equal(
    shouldRefreshDriveToken({ code: "drive_forbidden", allowRefresh: true }),
    false,
  );

  let tokenCalls = 0;
  let fileCalls = 0;
  const recovered = await fetchDrivePdf("mapleDemoFileId0001", {
    auth,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        tokenCalls += 1;
        return tokenResponse(`ya29.try-${tokenCalls}`);
      }
      fileCalls += 1;
      if (fileCalls === 1) return new Response("no", { status: 401 });
      return pdfResponse();
    },
  });
  assert.equal(recovered.ok, true);
  assert.equal(tokenCalls, 2);
  assert.equal(fileCalls, 2);

  resetDriveTokenCache();
  tokenCalls = 0;
  fileCalls = 0;
  const stuck = await fetchDrivePdf("mapleDemoFileId0001", {
    auth,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        tokenCalls += 1;
        return tokenResponse(`ya29.stuck-${tokenCalls}`);
      }
      fileCalls += 1;
      return new Response("no", { status: 401 });
    },
  });
  assert.equal(stuck.ok, false);
  if (!stuck.ok) {
    assert.equal(stuck.code, "drive_auth_rejected");
    assert.equal(stuck.error.includes("no"), false);
  }
  assert.equal(tokenCalls, 2);
  assert.equal(fileCalls, 2);
  resetDriveTokenCache();
});

test("Drive 403 and a rejected token endpoint are not retried", async () => {
  resetDriveTokenCache();
  let tokenCalls = 0;
  let fileCalls = 0;
  const forbidden = await fetchDrivePdf("mapleDemoFileId0001", {
    auth,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        tokenCalls += 1;
        return tokenResponse("ya29.once");
      }
      fileCalls += 1;
      return new Response(JSON.stringify({ error: "BEGIN PRIVATE KEY" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal(forbidden.ok, false);
  if (!forbidden.ok) {
    assert.equal(forbidden.code, "drive_forbidden");
    assert.equal(forbidden.error.includes("BEGIN PRIVATE"), false);
  }
  assert.equal(tokenCalls, 1);
  assert.equal(fileCalls, 1);

  resetDriveTokenCache();
  tokenCalls = 0;
  fileCalls = 0;
  const rejected = await fetchDrivePdf("mapleDemoFileId0001", {
    auth,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        tokenCalls += 1;
        return new Response(
          JSON.stringify({ error_description: "BEGIN PRIVATE KEY" }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }
      fileCalls += 1;
      return pdfResponse();
    },
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.equal(rejected.code, "drive_auth_rejected");
    assert.equal(rejected.error.includes("BEGIN PRIVATE"), false);
  }
  assert.equal(tokenCalls, 1);
  assert.equal(fileCalls, 0);
  resetDriveTokenCache();
});

test("an empty Drive body retries then reports empty, not a missing PDF", async () => {
  resetDriveTokenCache();
  let fileCalls = 0;
  const empty = await fetchDrivePdf("mapleDemoFileId0001", {
    auth,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return tokenResponse("ya29.empty-body");
      }
      fileCalls += 1;
      return new Response(new Uint8Array(), {
        status: 200,
        headers: { "content-type": "application/pdf", "content-length": "0" },
      });
    },
  });
  assert.equal(empty.ok, false);
  if (!empty.ok) {
    assert.equal(empty.code, "empty_body");
    assert.notEqual(empty.code, "pdf_missing");
    assert.match(empty.error, /empty/i);
  }
  assert.equal(fileCalls, 2);
  resetDriveTokenCache();
});
