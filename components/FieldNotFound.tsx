import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { getFieldRole } from "@/lib/auth.server";
import {
  FIELD_NOT_FOUND_MESSAGE,
  FIELD_NOT_FOUND_TITLE,
  HOME_HREF,
  HOME_LABEL,
  MAPLE_POINT_DEMO_HREF,
  MAPLE_POINT_DEMO_LABEL,
  fieldNotFoundSpeak,
} from "@/lib/fieldNotFound";
import { logFieldNotFoundDevHint } from "@/lib/fieldNotFoundDev";

/**
 * Missing page or pack. Same calm card as a sheet miss:
 * short title, short line, one big action, Hear this.
 */
export async function FieldNotFoundPage() {
  logFieldNotFoundDevHint();
  const access = await getFieldRole();
  const session = access.session;
  const speak = fieldNotFoundSpeak();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={Boolean(session)}
        role={session?.role ?? access.role}
        procoreLinked={access.procoreLinked}
      />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        <div role="status" className="w-full border border-line bg-ink px-4 py-5">
          <h1 className="text-2xl font-semibold text-paper">{FIELD_NOT_FOUND_TITLE}</h1>
          <p className="mt-2 text-lg leading-snug text-paper">{FIELD_NOT_FOUND_MESSAGE}</p>
          <Link
            href={MAPLE_POINT_DEMO_HREF}
            className="mt-4 flex min-h-14 w-full items-center justify-center bg-cta px-5 text-center text-base font-semibold text-secondary hover:bg-cta-hover"
          >
            {MAPLE_POINT_DEMO_LABEL}
          </Link>
          <Link
            href={HOME_HREF}
            className="mt-3 inline-flex min-h-12 items-center text-base font-semibold text-accent underline"
          >
            {HOME_LABEL}
          </Link>
          <ReadAloudButton
            id="field-not-found"
            text={speak}
            label="Hear this"
            className="mt-3"
          />
        </div>
      </main>
    </div>
  );
}
