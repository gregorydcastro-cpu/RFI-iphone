/**
 * Parse materials dictation into line-item / note ops for the order draft.
 */

import type { MaterialDraftLine, MaterialIntent } from "./fieldDrafts";

export type MaterialLineState = MaterialDraftLine & { included: boolean };

export type MaterialSpeechOp =
  | { kind: "note"; note: string }
  | {
      kind: "line";
      type: string;
      qty: number;
      intent: MaterialIntent;
      mode: "add" | "set";
    };

function newLineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `line-${crypto.randomUUID()}`;
  }
  return `line-${Date.now().toString(36)}`;
}

function foldWord(word: string): string {
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function normalizeType(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(please|thanks|thank you)\b/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(foldWord)
    .join(" ")
    .trim();
}

function cleanType(value: string): string {
  return value
    .replace(/[.!?]+$/g, "")
    .replace(/\b(please|thanks|thank you)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function intentFromVerb(verb: string): MaterialIntent {
  return /need/i.test(verb) ? "needed" : "order";
}

function splitCommands(text: string): string[] {
  return text
    .split(/\s*(?:,|\band then\b|\bthen\b|\band\b|;)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

export function parseMaterialsDictation(raw: string): MaterialSpeechOp[] {
  const transcript = raw.trim();
  if (!transcript) return [];

  const ops: MaterialSpeechOp[] = [];
  if (
    /^(?:add\s+)?(?:a\s+)?notes?\b/i.test(transcript) &&
    !/\b(?:add|order|need(?:ed)?|set|change|increase)\s+\d+/i.test(transcript)
  ) {
    const note = transcript.replace(/^(?:add\s+)?(?:a\s+)?notes?\s*[:\-]?\s*/i, "").trim();
    if (note) return [{ kind: "note", note }];
  }

  const trailingNote = transcript.match(/\bnotes?\s*[:\-]\s*(.+)$/i);
  let working = transcript;
  if (trailingNote?.[1] && trailingNote.index && trailingNote.index > 0) {
    ops.push({ kind: "note", note: trailingNote[1].trim() });
    working = transcript.slice(0, trailingNote.index).trim();
  }

  const commands = splitCommands(working);
  for (const command of commands.length ? commands : [working]) {
    const noteCmd = command.match(/^(?:add\s+)?(?:a\s+)?notes?\s*[:\-]\s*(.+)$/i);
    if (noteCmd?.[1]) {
      ops.push({ kind: "note", note: noteCmd[1].trim() });
      continue;
    }

    const setMatch = command.match(
      /\b(?:set|change|increase|make|update)\s+(.+?)\s+to\s+(\d+)\b/i,
    );
    if (setMatch?.[1] && setMatch[2]) {
      const qty = Number.parseInt(setMatch[2], 10);
      if (Number.isFinite(qty) && qty >= 0) {
        ops.push({
          kind: "line",
          type: cleanType(setMatch[1]),
          qty,
          intent: "order",
          mode: "set",
        });
        continue;
      }
    }

    const addMatch = command.match(
      /\b(add|order|need(?:ed)?)\s+(\d+)\s+(?:of\s+)?(.+)$/i,
    );
    if (addMatch?.[1] && addMatch[2] && addMatch[3]) {
      const qty = Number.parseInt(addMatch[2], 10);
      if (Number.isFinite(qty) && qty > 0) {
        const verb = addMatch[1];
        ops.push({
          kind: "line",
          type: cleanType(addMatch[3]),
          qty,
          intent: intentFromVerb(verb),
          mode: /^add$/i.test(verb) ? "add" : "set",
        });
        continue;
      }
    }

    const bare = command.match(/^(\d+)\s+(?:of\s+)?(.+)$/i);
    if (bare?.[1] && bare[2]) {
      const qty = Number.parseInt(bare[1], 10);
      if (Number.isFinite(qty) && qty > 0) {
        ops.push({
          kind: "line",
          type: cleanType(bare[2]),
          qty,
          intent: "order",
          mode: "add",
        });
      }
    }
  }

  return ops.filter((op) => (op.kind === "note" ? op.note.length > 0 : op.type.length > 0));
}

export function matchMaterialLine(
  lines: MaterialLineState[],
  type: string,
): MaterialLineState | undefined {
  const needle = normalizeType(type);
  if (needle.length < 3) return undefined;
  let best: { line: MaterialLineState; score: number } | undefined;
  for (const line of lines) {
    const hay = normalizeType(line.type);
    if (!hay) continue;
    let score = 0;
    if (hay === needle) score = 100;
    else if (hay.includes(needle) || needle.includes(hay)) {
      score = Math.min(hay.length, needle.length);
    } else {
      const hayParts = new Set(hay.split(" "));
      const overlap = needle.split(" ").filter((part) => hayParts.has(part));
      if (overlap.length >= 2) score = overlap.join(" ").length;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { line, score };
    }
  }
  return best?.line;
}

export function applyMaterialOps(
  lines: MaterialLineState[],
  ops: MaterialSpeechOp[],
  roomName?: string,
): { lines: MaterialLineState[]; note?: string } {
  let next = lines.map((line) => ({ ...line }));
  let note: string | undefined;

  for (const op of ops) {
    if (op.kind === "note") {
      note = note ? `${note} ${op.note}` : op.note;
      continue;
    }
    const existing = matchMaterialLine(next, op.type);
    if (existing) {
      next = next.map((line) => {
        if (line.id !== existing.id) return line;
        const qty = op.mode === "set" ? op.qty : line.qty + op.qty;
        return {
          ...line,
          qty: Math.max(0, qty),
          intent: op.intent,
          included: true,
        };
      });
      continue;
    }
    next = [
      ...next,
      {
        id: newLineId(),
        type: op.type,
        qty: op.qty,
        intent: op.intent,
        room: roomName,
        included: true,
      },
    ];
  }

  return { lines: next, note };
}
