import type { Rfi } from "@/lib/pack";

const STATUS_CLASS: Record<string, string> = {
  open: "bg-amber-100 text-amber-900",
  answered: "bg-sky-100 text-sky-900",
  closed: "bg-zinc-200 text-zinc-700",
};

type Props = {
  rfis: Rfi[];
};

export function RfiList({ rfis }: Props) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        RFIs
      </h2>
      {rfis.length === 0 ? (
        <p className="text-sm text-zinc-500">No RFIs linked to this room.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
          {rfis.map((rfi) => (
            <li key={rfi.id} className="px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-zinc-500">{rfi.number}</p>
                  {rfi.url ? (
                    <a
                      href={rfi.url}
                      className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
                    >
                      {rfi.title}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-zinc-900">{rfi.title}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                    STATUS_CLASS[rfi.status] ?? "bg-zinc-100 text-zinc-700"
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
