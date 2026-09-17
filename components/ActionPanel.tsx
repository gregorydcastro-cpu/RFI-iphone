import type { PackAction } from "@/lib/pack";

type Props = {
  actions: PackAction[];
  onAction: (action: PackAction) => void;
};

export function ActionPanel({ actions, onAction }: Props) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        Actions
      </h2>
      <div className="flex flex-col gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action)}
            className="rounded-md border border-zinc-300 bg-zinc-900 px-3 py-2 text-left text-sm font-medium text-white hover:bg-zinc-800"
          >
            <span className="flex items-center justify-between gap-2">
              {action.label}
              {action.enabled === false ? (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700 uppercase">
                  Coming soon
                </span>
              ) : null}
            </span>
            {action.note ? (
              <span className="mt-0.5 block text-xs font-normal text-zinc-400">
                {action.note}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}
