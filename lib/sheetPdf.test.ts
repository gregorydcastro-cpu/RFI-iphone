import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import {
  normalizePrivateKey,
  parseDriveServiceAccountJson,
} from "./driveCredentials.ts";
import { driveFileId, resolveSheetPdf } from "./packNormalize.ts";
import {
  isAllowedDriveDownloadHost,
  isBlockedFetchHost,
  isBrowserDirectPdfUrl,
  isGoogleDrivePdfUrl,
  isGoogleLoginHost,
  isPdfMagic,
  isProcorePdfUrl,
  viewerSheetPdfSrc,
} from "./sheetPdfUrl.ts";

test("Maple Point /packs paths stay direct for the viewer", () => {
  const src = viewerSheetPdfSrc({
    requestId: "maple-point",
    sheetId: "A-101",
    pdfUrl: "/packs/maple-point-a101.pdf",
  });
  assert.equal(src, "/packs/maple-point-a101.pdf");
  assert.equal(isBrowserDirectPdfUrl("/packs/maple-point-a101.pdf"), true);
  assert.equal(isBrowserDirectPdfUrl("//evil.example/packs/x.pdf"), false);
});

test("remote Drive sheet URLs go through the same-origin proxy", () => {
  const liveUrl =
    "https://drive.google.com/uc?export=download&id=1exampleDriveFileId0001";
  const src = viewerSheetPdfSrc({
    requestId: "sample-arch-bounds-733",
    sheetId: "A207_N",
    pdfUrl: liveUrl,
  });
  assert.equal(
    src,
    "/api/sheet-pdf?requestId=sample-arch-bounds-733&sheetId=A207_N",
  );
  assert.equal(isGoogleDrivePdfUrl(liveUrl), true);
  assert.equal(
    driveFileId("https://drive.google.com/file/d/1exampleDriveFileId0001/view"),
    "1exampleDriveFileId0001",
  );
});

test("stamp/resolve keep Drive preview links as uc download URLs", () => {
  const resolved = resolveSheetPdf({
    pdf: "",
    preview: "https://drive.google.com/file/d/abc123/view",
  });
  assert.equal(
    resolved,
    "https://drive.google.com/uc?export=download&id=abc123",
  );
});

test("live bot empty pdf uses crop/preview Drive view URLs", () => {
  const view =
    "https://drive.google.com/file/d/1-UluTsR9__FBCyfiQay_A3k_ulGW5rmx/view";
  const resolved = resolveSheetPdf({
    pdf: "",
    preview: view,
    crop: view,
  });
  assert.equal(
    resolved,
    "https://drive.google.com/uc?export=download&id=1-UluTsR9__FBCyfiQay_A3k_ulGW5rmx",
  );
  assert.equal(
    viewerSheetPdfSrc({
      requestId: "sample-arch-bounds-733",
      sheetId: "A207_N",
      pdfUrl: resolved,
    }),
    "/api/sheet-pdf?requestId=sample-arch-bounds-733&sheetId=A207_N",
  );
});

test("crop Drive view URL is enough when preview is also empty", () => {
  const resolved = resolveSheetPdf({
    pdf: "",
    preview: "",
    crop: "https://drive.google.com/file/d/1-UluTsR9__FBCyfiQay_A3k_ulGW5rmx/view",
  });
  assert.equal(
    resolved,
    "https://drive.google.com/uc?export=download&id=1-UluTsR9__FBCyfiQay_A3k_ulGW5rmx",
  );
});

test("bbox crop does not hide a preview Drive view URL", () => {
  const resolved = resolveSheetPdf({
    pdf: "",
    preview: "https://drive.google.com/file/d/abc123/view",
    crop: { x: 0.2, y: 0.2, w: 0.3, h: 0.3 },
  });
  assert.equal(
    resolved,
    "https://drive.google.com/uc?export=download&id=abc123",
  );
});

test("empty pdf does not invent a proxy URL", () => {
  assert.equal(
    viewerSheetPdfSrc({
      requestId: "sample-arch-bounds-733",
      sheetId: "A257_N",
      pdfUrl: "",
    }),
    "",
  );
});

test("Procore drawing hosts are flagged so the proxy can refuse them", () => {
  assert.equal(
    isProcorePdfUrl("https://api.procore.com/rest/v1.0/drawing_revisions/1/pdf"),
    true,
  );
  assert.equal(isProcorePdfUrl("/packs/maple-point-a101.pdf"), false);
});

test("Drive media redirects stay on Google download hosts", () => {
  assert.equal(isAllowedDriveDownloadHost("www.googleapis.com"), true);
  assert.equal(isAllowedDriveDownloadHost("doc-0s-docs.googleusercontent.com"), true);
  assert.equal(isAllowedDriveDownloadHost("drive.usercontent.google.com"), true);
  assert.equal(isAllowedDriveDownloadHost("accounts.google.com"), false);
  assert.equal(isAllowedDriveDownloadHost("oauth2.googleapis.com"), false);
  assert.equal(isAllowedDriveDownloadHost("169.254.169.254"), false);
  assert.equal(isAllowedDriveDownloadHost("evil.example"), false);
});

test("private hosts are blocked for plain PDF fetch", () => {
  assert.equal(isBlockedFetchHost("localhost"), true);
  assert.equal(isBlockedFetchHost("127.0.0.1"), true);
  assert.equal(isBlockedFetchHost("10.0.0.4"), true);
  assert.equal(isBlockedFetchHost("169.254.169.254"), true);
  assert.equal(isBlockedFetchHost("drive.google.com"), false);
  assert.equal(isGoogleLoginHost("accounts.google.com"), true);
});

test("PDF magic bytes are %PDF", () => {
  assert.equal(isPdfMagic(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.equal(isPdfMagic(Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c])), false);
});

test("service account JSON parses client_email and escaped private key", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const json = JSON.stringify({
    type: "service_account",
    client_email: "packs@example.iam.gserviceaccount.com",
    private_key: pem,
  });
  const parsed = parseDriveServiceAccountJson(json);
  assert.equal(parsed?.clientEmail, "packs@example.iam.gserviceaccount.com");
  assert.match(parsed?.privateKey ?? "", /BEGIN PRIVATE KEY/);
  assert.equal(
    normalizePrivateKey(
      '"-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n"',
    ).includes("BEGIN"),
    true,
  );
});
