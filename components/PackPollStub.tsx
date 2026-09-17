"use client";

type Props = {
  requestId: string;
  jobName: string;
  requestedRoom?: string;
};

/**
 * Accepted-state copy only. Drive polling is later; the Maple Point demo pack
 * stays visible until `{requestId}.json` exists.
 */
export function PackPollStub({ requestId, jobName, requestedRoom }: Props) {
  const roomLabel = requestedRoom ? ` · room ${requestedRoom}` : "";

  return (
    <p className="mt-0.5 text-xs text-tan">
      Request accepted for {jobName}
      {roomLabel}. Pack is being prepared — this page does not wait for the
      full file. Showing Maple Point demo until{" "}
      <span className="font-mono">{requestId}.json</span> is ready. Drive poll
      later.
    </p>
  );
}
