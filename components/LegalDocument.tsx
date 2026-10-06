// FOR GREG'S REVIEW — draft, not legal advice

import type { FieldRoleName } from "@/lib/auth";
import { legalSpeakText, type LegalCopy } from "@/lib/legalCopy";
import { REVIEW_NOTICE } from "@/lib/siteInfo";
import { AppHeader } from "./AppHeader";
import { ReadAloudButton } from "./ReadAloudButton";
import { SiteFooter } from "./SiteFooter";

type Props = {
  copy: LegalCopy;
  signedIn?: boolean;
  role?: FieldRoleName | null;
};

/**
 * Public legal page. Short sentences, large type, dark field theme.
 * The notice at the top is a draft marker, not legal advice.
 * Signed-out visitors are not sent to sign-in.
 */
export function LegalDocument({ copy, signedIn = false, role = null }: Props) {
  const speak = legalSpeakText(copy);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader signedIn={signedIn} role={role} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <aside
          role="note"
          data-review-notice=""
          className="border-l-4 border-l-cta border-y border-r border-line bg-ink px-5 py-5 text-lg leading-relaxed text-paper"
        >
          {REVIEW_NOTICE}
        </aside>
        <h1 className="mt-10 text-4xl font-semibold leading-tight text-paper">
          {copy.title}
        </h1>
        <ReadAloudButton
          id={`legal-${copy.path.slice(1)}`}
          text={speak}
          label="Hear this"
          className="mt-6"
        />
        <div className="mt-10 space-y-12">
          {copy.sections.map((section) => (
            <section key={section.heading} className="space-y-4">
              <h2 className="text-2xl font-semibold leading-snug text-paper">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-lg leading-relaxed text-paper">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter currentPath={copy.path} />
    </div>
  );
}
