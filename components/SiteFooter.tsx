import Link from "next/link";
import { SITE_FOOTER_LINKS } from "@/lib/siteInfo";

type Props = {
  currentPath?: string;
};

/**
 * Privacy, Terms, and Support. Used on the sign-in page, pricing,
 * and the legal pages. Not used on pack routes.
 */
export function SiteFooter({ currentPath }: Props) {
  return (
    <footer data-site-footer="" className="mt-auto border-t border-line bg-primary">
      <nav
        aria-label="Privacy, terms, and support"
        className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-8 sm:px-6"
      >
        {SITE_FOOTER_LINKS.map((link) => {
          const current = currentPath === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current ? "page" : undefined}
              className={`inline-flex min-h-12 items-center text-lg font-semibold underline underline-offset-4 ${
                current ? "text-cta" : "text-paper hover:text-cta"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </footer>
  );
}
