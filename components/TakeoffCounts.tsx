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
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Takeoff counts
        </h2>
        <p className="text-sm text-zinc-500">No takeoff counts on this pack.</p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        Takeoff counts
      </h2>
      <div className="rounded-md border border-zinc-200 bg-white p-3">
        <p className="text-sm font-medium text-zinc-900">{room.name}</p>
        <p className="text-xs text-zinc-500">
          {takeoff.scope} · {takeoff.units}
          {takeoff.confidence ? ` · ${takeoff.confidence}` : ""}
        </p>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="pb-1 font-medium">Type</th>
              <th className="pb-1 text-right font-medium">Qty</th>
            </tr>
          </thead>
          <tbody>
            {room.fixtures.map((fixture) => (
              <tr key={fixture.type} className="border-t border-zinc-100">
                <td className="py-1 text-zinc-800">{fixture.type}</td>
                <td className="py-1 text-right font-mono text-zinc-900">
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
