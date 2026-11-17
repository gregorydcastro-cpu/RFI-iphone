import { SKIP_TO_MAIN_HREF, SKIP_TO_MAIN_TEXT } from "@/lib/skipToMainContent";

/**
 * First control on a public page. The .skip-to-main rule hides it until
 * keyboard focus, then shows it with an outline. A plain anchor works
 * with JavaScript off.
 */
export function SkipToMainContent() {
  return (
    <a href={SKIP_TO_MAIN_HREF} className="skip-to-main">
      {SKIP_TO_MAIN_TEXT}
    </a>
  );
}
