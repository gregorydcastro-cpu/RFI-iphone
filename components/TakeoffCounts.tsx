import type { Takeoff } from "@/lib/pack";

type Props = {
  takeoff?: Takeoff;
  roomName: string;
};

export function TakeoffCounts({ takeoff, roomName }: Props) {
  const room =
    takeoff?.by_room.find((entry) => entry.name === roomName) ??
    takeoff?.by_room[0];

  if (!takeoff || !room) {
    return (
      <section className="space-y-2">
        <h2 className="font-display text-xs tracking-[0.18em] text-muted uppercase">
          Takeoff counts
        </h2>
        <p className="text-sm text-muted">
          Placeholder — takeoff counts are not on this pack yet.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="font-display text-xs tracking-[0.18em] text-muted uppercase">
        Takeoff counts{" "}
        <span className="font-sans font-normal tracking-normal text-metal normal-case">
          (placeholder)
        </span>
      </h2>
      <div className="border border-line bg-ink p-3">
        <p className="text-sm font-medium text-paper">{room.name}</p>
        <p className="text-xs text-muted">
          {takeoff.scope} · {takeoff.units}
          {takeoff.confidence ? ` · ${takeoff.confidence}` : ""}
        </p>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-1 font-medium">Type</th>
              <th className="pb-1 text-right font-medium">Qty</th>
            </tr>
          </thead>
          <tbody>
            {room.fixtures.map((fixture) => (
              <tr key={fixture.type} className="border-t border-line">
                <td className="py-1 text-paper">{fixture.type}</td>
                <td className="py-1 text-right font-mono text-metal">
                  {fixture.qty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
