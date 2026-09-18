import type { PackAction } from "@/lib/pack";

type Props = {
  actions: PackAction[];
  onAction: (action: PackAction) => void;
  procoreLinked?: boolean;
};

export function ActionPanel({ actions, onAction, procoreLinked = false }: Props) {
  const visible = actions.filter((action) => {
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
      {!procoreLinked ? (
        <p className="text-xs text-tan">
          View only. Pull and file-pull controls stay with a linked Procore
          account.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {visible.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action)}
            className="border border-cta bg-cta px-3 py-2 text-left text-sm font-medium text-secondary hover:bg-cta-hover"
          >
            <span className="flex items-center justify-between gap-2">
              {action.label}
              {action.enabled === false ? (
                <span className="border border-accent/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-metal uppercase">
                  Coming soon
                </span>
              ) : null}
            </span>
            {action.note ? (
              <span className="mt-0.5 block text-xs font-normal text-muted">
                {action.note}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}
