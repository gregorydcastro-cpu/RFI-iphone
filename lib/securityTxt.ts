/**
 * RFC 9116 security.txt.
 * Contact is a placeholder page. Do not invent an email.
 */

export const SECURITY_TXT_COMMENT =
  "# FOR GREG'S REVIEW: replace Contact with the real security contact";

/** One year out from 2026-10-09. RFC 3339, as required by RFC 9116. */
export const SECURITY_TXT_EXPIRES = "2027-10-09T00:00:00.000Z";

export const SECURITY_TXT_CONTACT = "https://www.gcfieldlog.com/support";

export const SECURITY_TXT_CANONICAL =
  "https://www.gcfieldlog.com/.well-known/security.txt";

export function securityTxtBody(): string {
  return [
    SECURITY_TXT_COMMENT,
    `Contact: ${SECURITY_TXT_CONTACT}`,
    `Expires: ${SECURITY_TXT_EXPIRES}`,
    `Canonical: ${SECURITY_TXT_CANONICAL}`,
    "Preferred-Languages: en",
    "",
  ].join("\n");
}
