import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { getFieldRole } from "@/lib/auth.server";
import {
  fieldNotFoundCopy,
  fieldNotFoundSpeak,
  type FieldNotFoundVariant,
} from "@/lib/fieldNotFound";
import { logFieldNotFoundDevHint } from "@/lib/fieldNotFoundDev";

/**
 * Missing page or pack. Same calm card as a sheet miss:
 * short title, short line, one big action, Hear this.
 */
export async function FieldNotFoundPage({
  variant,
}: {
  variant: FieldNotFoundVariant;
}) {
  if (variant === "pack") logFieldNotFoundDevHint();
  const access = await getFieldRole();
  const session = access.session;
  const copy = fieldNotFoundCopy(variant);
  const speak = fieldNotFoundSpeak(variant);

  return (
    <div data-field-not-found="" className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={Boolean(session)}
        role={session?.role ?? access.role}
        procoreLinked={access.procoreLinked}
      />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        <div role="status" className="w-full border border-line bg-ink px-4 py-5">
          <h1 className="text-2xl font-semibold text-paper">{copy.title}</h1>
          <p className="mt-2 text-lg leading-snug text-paper">{copy.message}</p>
          <Link
            href={copy.primary.href}
            className="mt-4 flex min-h-14 w-full items-center justify-center bg-cta px-5 text-center text-base font-semibold text-secondary hover:bg-cta-hover"
          >
            {copy.primary.label}
          </Link>
          <Link
            href={copy.secondary.href}
            className="mt-3 inline-flex min-h-12 items-center text-base font-semibold text-accent underline"
          >
            {copy.secondary.label}
          </Link>
          <ReadAloudButton
            id={`field-not-found-${variant}`}
            text={speak}
            label="Hear this"
            className="mt-3"
          />
        </div>
      </main>
    </div>
  );
}
