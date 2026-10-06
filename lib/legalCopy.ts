/**
 * FOR GREG'S REVIEW — draft, not legal advice.
 *
 * Plain-language drafts for /privacy, /terms, and /support.
 * Facts are limited to what this web app's code does.
 * Placeholders come from lib/siteInfo.ts. Fill them there.
 */

import { REVIEW_NOTICE, SITE_INFO } from "./siteInfo.ts";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalCopy = {
  path: "/privacy" | "/terms" | "/support";
  title: string;
  description: string;
  sections: LegalSection[];
};

/**
 * Files the privacy draft was checked against.
 * Not shown on the page. Used so a review can find the code.
 */
export const PRIVACY_FACT_SOURCES = [
  "app/api/session/route.ts",
  "app/api/session/logout/route.ts",
  "lib/session.ts",
  "lib/session.server.ts",
  "lib/auth.ts",
  "lib/procoreOAuth.ts",
  "lib/procoreRest.ts",
  "lib/supabaseRoomPack.ts",
  "app/api/procore/disconnect/route.ts",
  "lib/fieldDrafts.ts",
  "lib/markup.ts",
  "components/GenerateRfiForm.tsx",
  "app/api/dictation/route.ts",
  "app/api/tts/route.ts",
  "lib/xai.ts",
  "lib/driveAuth.ts",
  "lib/sheetPdfDownload.ts",
  "lib/offlinePackStore.ts",
  "lib/fieldEmail.ts",
  "lib/notifyMike.ts",
  "lib/gmailSmtp.ts",
  "app/api/invites/route.ts",
  "app/api/share/link/route.ts",
  "app/api/stripe/checkout/route.ts",
  "lib/stripe.ts",
  "components/useSiteGeofence.ts",
  "vercel.json",
  "package.json",
  "supabase/migrations/20260918010000_procore_connections.sql",
  "supabase/migrations/20260918230000_procore_connections_notify_email.sql",
  "supabase/migrations/20260918120000_billing_customers.sql",
  "supabase/migrations/20260918021000_rfis.sql",
  "supabase/migrations/20260918020000_share_markup_rfi_trial.sql",
  "supabase/migrations/20260918093000_time_tracking.sql",
  "supabase/migrations/20260919220000_supabase_auth_profiles.sql",
  "supabase/migrations/20260919010000_invite_tokens.sql",
] as const;

function dateLine(): string {
  return `The date on this draft is ${SITE_INFO.effectiveDate}.`;
}

export function privacyCopy(): LegalCopy {
  const email = SITE_INFO.supportEmail;
  const name = SITE_INFO.businessName;
  return {
    path: "/privacy",
    title: "Privacy policy",
    description:
      "What GC Field Log collects, which services process it, and how to ask for deletion.",
    sections: [
      {
        heading: "What this page is",
        paragraphs: [
          `This is the privacy policy for GC Field Log. It is written for ${name}.`,
          "It describes what this website does with data. It is a draft. It is not legal advice.",
          dateLine(),
        ],
      },
      {
        heading: "Your account",
        paragraphs: [
          "You can sign in with an email and a password. You can also ask for a one-time email link.",
          "Supabase Auth stores that account. A profile stores your email and your role.",
          "The roles in the app are viewer, full, and puller.",
        ],
      },
      {
        heading: "Cookies and sign-in",
        paragraphs: [
          "A sign-in cookie keeps you logged in. Another cookie remembers that Procore is connected.",
          "A few short-lived cookies are used only while you connect Procore.",
          "Signing out clears the sign-in cookie. An old unused cookie is cleared too. It is not a way to sign in.",
        ],
      },
      {
        heading: "Procore",
        paragraphs: [
          "If you connect Procore, we store tokens for your user in Supabase. Those are an access token and a refresh token.",
          "We also store when the token expires, the Procore user id, a company id, and the email on that connection.",
          "You can save a separate email for sheet-revision alerts.",
          "When a puller refreshes a pack, the app reads companies, projects, drawing revisions, and RFIs from Procore.",
          "Room pack snapshots are stored in Supabase. A snapshot has the project, the room, and the sheet list.",
          "You can disconnect Procore on the Account page. That deletes the stored tokens for your user. It also asks Procore to revoke the access token.",
        ],
      },
      {
        heading: "Notes you save",
        paragraphs: [
          "A saved RFI can include a subject, a description, a location, a sheet id, a markup link, and a status.",
          "Markups can include circles, boxes, arrows, and text notes.",
          "Share folders and pinned sheets are stored for the folder owner.",
          "An invite can store a role and an email address.",
          "These rows live in the Supabase database when that database is turned on.",
        ],
      },
      {
        heading: "Photos",
        paragraphs: [
          "A photo you attach to an RFI stays in this browser. It is saved with the draft in local storage.",
          "It is not uploaded to Procore. The RFI row in the database does not include the photo file.",
        ],
      },
      {
        heading: "Voice",
        paragraphs: [
          "Dictation sends a short audio clip to this website's server. The server sends that clip to xAI (Grok) to turn it into text.",
          "Read-aloud sends the words on the screen to xAI to make spoken audio.",
          "This app does not save those clips in its database.",
        ],
      },
      {
        heading: "Time and place",
        paragraphs: [
          "The time page can record punch in and punch out.",
          "A punch can include latitude, longitude, accuracy, and distance from the job fence.",
          "A job site stores a fence center and a radius. A worker row can store a name, a role, and an email.",
          "Punches are stored in Supabase when that storage is turned on.",
        ],
      },
      {
        heading: "Billing",
        paragraphs: [
          "If you subscribe, checkout is handled by Stripe. We can send Stripe your email and your user id.",
          "Stripe collects the payment method. This app does not store your card number.",
          "We store the Stripe customer id, subscription id, status, trial end, and email in Supabase.",
          "If billing is not turned on, the pricing page does not charge you.",
        ],
      },
      {
        heading: "Email",
        paragraphs: [
          "Invite emails and share-link emails are sent with Resend.",
          "A share-link address is used to send that message. The app does not keep a separate list of those addresses.",
          "Sheet-revision alerts go to the notify email you saved. Those alerts use Resend. If Resend is not set up, they use Gmail.",
          "An alert names the sheet and the new revision. This app does not send text messages.",
        ],
      },
      {
        heading: "Sheet PDFs",
        paragraphs: [
          "Sheet PDFs are fetched by our server. The server uses a Google Drive service account with read-only access, or a public PDF link.",
          "Your own Google account is not connected.",
          "A pack and its PDFs can be saved in this browser for offline use. That copy uses IndexedDB and the browser cache.",
        ],
      },
      {
        heading: "On this device",
        paragraphs: [
          "The browser can keep RFI drafts, material-order drafts, and markup backups in local storage.",
          "Offline pack snapshots use IndexedDB.",
        ],
      },
      {
        heading: "Hosting",
        paragraphs: [
          "The website is hosted on Vercel. This code does not add a web analytics tool.",
        ],
      },
      {
        heading: "Ask us to delete your data",
        paragraphs: [
          "There is no delete-account button in the app.",
          "You can disconnect Procore yourself on the Account page.",
          `To ask for the rest of your data to be deleted, open the Support page. Write to ${email}.`,
        ],
      },
    ],
  };
}

export function termsCopy(): LegalCopy {
  const email = SITE_INFO.supportEmail;
  const name = SITE_INFO.businessName;
  return {
    path: "/terms",
    title: "Terms of use",
    description: "Plain-language terms for using GC Field Log.",
    sections: [
      {
        heading: "Using the site",
        paragraphs: [
          `These terms are for GC Field Log, from ${name}.`,
          dateLine(),
          "The service is provided as it is. We do not promise that it will always be up, complete, or fit for a particular job.",
        ],
      },
      {
        heading: "Your jobsite data",
        paragraphs: [
          "You are responsible for the jobsite data you enter. That includes RFIs, markups, photos, time punches, and share folders.",
          "You are responsible for how you use your own Procore account. Connect only a Procore account you are allowed to use.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: [
          "Use the site for your own crew work.",
          "Do not try to break the site. Do not try to get into someone else's account.",
          "Do not send data you are not allowed to share.",
        ],
      },
      {
        heading: "Billing",
        paragraphs: [
          "If you subscribe, billing runs through Stripe. The price and the trial are shown at checkout.",
          "If billing is not turned on, the pricing page does not charge you.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "We may change these terms. When we do, the date at the top will change.",
          "If you keep using the site after a change, you accept the new terms.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          `Questions go to ${email}. You can also open the Support page.`,
        ],
      },
    ],
  };
}

export function supportCopy(): LegalCopy {
  const email = SITE_INFO.supportEmail;
  const name = SITE_INFO.businessName;
  return {
    path: "/support",
    title: "Support",
    description: "How to get help with GC Field Log.",
    sections: [
      {
        heading: "How to get help",
        paragraphs: [
          "Start with the page you were on. Try the action again.",
          "If you are signed out, sign in from the home page.",
          "If a pack will not refresh, open Account. Disconnect Procore, then connect it again.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          `This draft does not have a live help desk yet. Write to ${email}.`,
          "Say what you were doing, and what you saw.",
          "Do not send your password. Do not send Procore tokens.",
          `${name} has not filled in a phone number or a mailing address.`,
          dateLine(),
        ],
      },
      {
        heading: "Ask to delete your data",
        paragraphs: [
          "Use the same contact to ask for your data to be deleted. The Privacy page says what the app stores.",
        ],
      },
    ],
  };
}

export function legalPlainText(copy: LegalCopy): string {
  const parts = [
    REVIEW_NOTICE,
    copy.title,
    ...copy.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
  ];
  return parts.join("\n");
}

/** One block for the Hear this button. Same words as the page. */
export function legalSpeakText(copy: LegalCopy): string {
  return legalPlainText(copy).replaceAll("\n", " ");
}
