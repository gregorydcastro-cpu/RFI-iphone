/**
 * Baseline response headers for every route.
 *
 * This is not a script policy. Supabase Auth, Procore OAuth, hosted Stripe
 * Checkout, Google Drive PDF fetches, and xAI are left alone.
 *
 * Framing is denied. The share portal and pack viewer are same-origin pages.
 * Sheets draw with pdf.js on a canvas, and Checkout leaves this origin with
 * a top-level redirect. Nothing in the app frames these routes.
 *
 * Camera, microphone, and geolocation stay available on this origin for
 * voice dictation, photos, and punch-in. Payment is omitted so Stripe keeps
 * the browser default. Other powerful features are omitted rather than denied.
 */

export type SecurityHeader = {
  key: string;
  value: string;
};

export const SECURITY_HEADERS: SecurityHeader[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(self)",
  },
];
