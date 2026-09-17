import type { Rfi } from "@/lib/pack";

const STATUS_CLASS: Record<string, string> = {
  open: "border-accent/50 bg-accent-deep/30 text-paper",
  answered: "border-metal/40 bg-panel-2 text-metal",
  closed: "border-line bg-ink text-muted",
};

type Props = {
  rfis: Rfi[];
};

export function RfiList({ rfis }: Props) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xs tracking-[0.18em] text-muted uppercase">
        RFIs
      </h2>
      {rfis.length === 0 ? (
        <p className="text-sm text-muted">No RFIs linked to this room.</p>
      ) : (
        <ul className="divide-y divide-line border border-line bg-ink">
          {rfis.map((rfi) => (
            <li key={rfi.id} className="px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-metal">{rfi.number}</p>
                  {rfi.url ? (
                    <a
                      href={rfi.url}
                      className="text-sm font-medium text-paper underline-offset-2 hover:underline"
                    >
                      {rfi.title}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-paper">{rfi.title}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                    STATUS_CLASS[rfi.status] ?? "border-line bg-panel text-muted"
                  }`}
                >
                  {rfi.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
