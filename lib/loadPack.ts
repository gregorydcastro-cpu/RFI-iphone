import { readFile } from "node:fs/promises";
import path from "node:path";
import { stampRoomPack, type RoomPack } from "./pack.ts";
import { coerceRoomPack } from "./packNormalize.ts";
import { isRoomPackShape } from "./packStatus.ts";

const PACK_ID = /^[a-zA-Z0-9._-]+$/;

export async function loadPack(requestId: string): Promise<RoomPack | null> {
  if (!PACK_ID.test(requestId)) return null;

  const file = path.join(process.cwd(), "public", "packs", `${requestId}.json`);
  try {
    const raw = await readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRoomPackShape(parsed)) return null;
    const coerced = coerceRoomPack(parsed);
    return coerced ? stampRoomPack(coerced) : stampRoomPack(parsed);
  } catch {
    return null;
  }
}
