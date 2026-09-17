import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RoomPack } from "./pack";

const PACK_ID = /^[a-zA-Z0-9._-]+$/;

export async function loadPack(requestId: string): Promise<RoomPack | null> {
  if (!PACK_ID.test(requestId)) return null;

  const file = path.join(process.cwd(), "public", "packs", `${requestId}.json`);
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as RoomPack;
  } catch {
    return null;
  }
}
