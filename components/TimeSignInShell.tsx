import { AppHeader } from "@/components/AppHeader";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { timeSignInGate } from "@/lib/timeGate";

/**
 * Signed-out /time. No roster, PINs, punches, or punch controls.
 * The sign-in link returns to /time. Anchors work with JavaScript off.
 */
export function TimeSignInShell({ sessionEnded }: { sessionEnded: boolean }) {
  const gate = timeSignInGate(sessionEnded);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader signedIn={false} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        <div className="w-full border border-line bg-ink px-4 py-5">
          <h1 className="text-2xl font-semibold text-paper">Time</h1>
          <p className="mt-2 text-lg leading-snug text-paper">{gate.text}</p>
          <a
            href={gate.signInHref}
            className="mt-4 flex min-h-14 w-full items-center justify-center bg-cta px-5 text-center text-base font-semibold text-secondary hover:bg-cta-hover"
          >
            {gate.signInLabel}
          </a>
          <a
            href={gate.homeHref}
            className="mt-3 inline-flex min-h-12 items-center text-base font-semibold text-accent underline"
          >
            {gate.homeLabel}
          </a>
          <ReadAloudButton
            id="time-sign-in"
            text={gate.text}
            label="Hear this"
            className="mt-3"
          />
        </div>
      </main>
    </div>
  );
}
