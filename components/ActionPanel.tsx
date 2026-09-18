import { isWritePackAction } from "@/lib/invites";
import type { PackAction } from "@/lib/pack";

type Props = {
  actions: PackAction[];
  onAction: (action: PackAction) => void;
  procoreLinked?: boolean;
  readOnly?: boolean;
};

export function ActionPanel({
  actions,
  onAction,
  procoreLinked = false,
  readOnly = false,
}: Props) {
  const visible = actions.filter((action) => {
    if (readOnly && isWritePackAction(action.id, action.label)) return false;
    if (procoreLinked) return true;
    const id = action.id.toLowerCase();
    const label = action.label.toLowerCase();
    if (id.includes("pull") || label.includes("pull")) return false;
    if (id.includes("download") || label.includes("download")) return false;
    return true;
  });

  return (
    <section className="space-y-2">
      <h2 className="font-display text-xs tracking-[0.18em] text-muted uppercase">
        Actions
      </h2>
      {readOnly ? (
        <p className="text-xs text-tan">
          View only. Sheets and red boxes / overlays — no markup, print, or
          request actions.
        </p>
      ) : !procoreLinked ? (
        <p className="text-xs text-tan">
          View only. Pull and file-pull controls stay with a linked Procore
          account.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {visible.map((action) => {
          const disabled = action.enabled === false;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action)}
              className={`min-h-12 border px-3 py-2 text-left text-sm font-medium ${
                disabled
                  ? "border-line bg-panel-2 text-tan"
                  : "border-cta bg-cta text-secondary hover:bg-cta-hover"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                {action.label}
                {disabled ? (
                  <span className="border border-accent/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-metal uppercase">
                    Coming soon
                  </span>
                ) : null}
              </span>
              {action.note && action.note.toLowerCase() !== "coming soon" ? (
                <span className="mt-0.5 block text-xs font-normal text-muted">
                  {action.note}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
