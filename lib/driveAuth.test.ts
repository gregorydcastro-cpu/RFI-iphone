import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { getDriveAccessToken, resetDriveTokenCache } from "./driveAuth.ts";
import { DriveTokenError } from "./sheetPdfErrors.ts";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const account = {
  clientEmail: "packs@example.iam.gserviceaccount.com",
  privateKey: pem,
};

test("token 503 retries and does not treat it as a rejected service account", async () => {
  resetDriveTokenCache();
  let calls = 0;
  const token = await getDriveAccessToken(account, {
    fetchImpl: async (url, init) => {
      calls += 1;
      assert.equal(url, "https://oauth2.googleapis.com/token");
      assert.equal(init.redirect, "manual");
      if (calls === 1) return new Response("unavailable", { status: 503 });
      return new Response(
        JSON.stringify({ access_token: "ya29.test-token", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
    sleep: async () => {},
  });
  assert.equal(token, "ya29.test-token");
  assert.equal(calls, 2);
  resetDriveTokenCache();
});

test("token 401 is not retried and the upstream body is not returned", async () => {
  resetDriveTokenCache();
  let calls = 0;
  await assert.rejects(
    () =>
      getDriveAccessToken(account, {
        fetchImpl: async () => {
          calls += 1;
          return new Response(
            JSON.stringify({
              error: "invalid_grant",
              error_description: "BEGIN PRIVATE KEY secret-body",
            }),
            { status: 401, headers: { "content-type": "application/json" } },
          );
        },
        sleep: async () => {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof DriveTokenError);
      assert.equal(error.code, "drive_auth_rejected");
      assert.equal(error.message.includes("secret-body"), false);
      assert.equal(error.message.includes("BEGIN PRIVATE"), false);
      return true;
    },
  );
  assert.equal(calls, 1);
  resetDriveTokenCache();
});

test("token timeouts retry then surface timeout", async () => {
  resetDriveTokenCache();
  let calls = 0;
  await assert.rejects(
    () =>
      getDriveAccessToken(account, {
        fetchImpl: async () => {
          calls += 1;
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          throw error;
        },
        sleep: async () => {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof DriveTokenError);
      assert.equal(error.code, "timeout");
      assert.equal(error.message.includes("aborted"), false);
      return true;
    },
  );
  assert.equal(calls, 2);
  resetDriveTokenCache();
});
