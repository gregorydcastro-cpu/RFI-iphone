import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asMarkupVector,
  buildMarkupRfiPrefill,
  clearAllMarkups,
  createMarkupFromGesture,
  createTextMarkup,
  findMarkupAt,
  foremanDraftStillAllowed,
  hitTestMarkup,
  markupSaveChip,
  markupStorageKey,
  parseVectors,
  prefillRfiFromMarkup,
  undoLastMarkup,
  updateTextMarkup,
} from "./markup.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("storage key is request_id + sheet_id", () => {
  assert.equal(
    markupStorageKey("maple-point", "A-101"),
    "gcfieldlog.markup:maple-point:A-101",
  );
});

test("parseVectors keeps circle box arrow text and drops junk", () => {
  const parsed = parseVectors({
    items: [
      { id: "a", kind: "box", x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
      { id: "b", kind: "circle", cx: 0.5, cy: 0.5, r: 0.1 },
      { id: "c", kind: "arrow", x1: 0.1, y1: 0.1, x2: 0.8, y2: 0.2 },
      { id: "d", kind: "text", x: 0.2, y: 0.3, text: "Check panel" },
      { id: "e", kind: "star" },
      { kind: "box", x: 0, y: 0, w: 1, h: 1 },
    ],
  });
  assert.equal(parsed.items.length, 4);
  assert.equal(parsed.items[0]?.kind, "box");
  assert.equal(parsed.items[3]?.kind, "text");
});

test("createMarkupFromGesture draws box circle and arrow", () => {
  const box = createMarkupFromGesture({
    kind: "box",
    start: { x: 0.4, y: 0.4 },
    end: { x: 0.1, y: 0.2 },
    id: "box-1",
  });
  assert.deepEqual(box, {
    id: "box-1",
    kind: "box",
    x: 0.1,
    y: 0.2,
    w: 0.3,
    h: 0.2,
  });

  const circle = createMarkupFromGesture({
    kind: "circle",
    start: { x: 0.5, y: 0.5 },
    end: { x: 0.6, y: 0.5 },
    id: "circ-1",
  });
  assert.equal(circle?.kind, "circle");
  if (circle?.kind === "circle") {
    assert.ok(Math.abs(circle.r - 0.1) < 1e-9);
  }

  const tiny = createMarkupFromGesture({
    kind: "box",
    start: { x: 0.5, y: 0.5 },
    end: { x: 0.501, y: 0.501 },
  });
  assert.equal(tiny, null);
});

test("hitTestMarkup selects box circle arrow and text", () => {
  const box = asMarkupVector({
    id: "b",
    kind: "box",
    x: 0.2,
    y: 0.2,
    w: 0.2,
    h: 0.1,
  });
  assert.ok(box);
  assert.equal(hitTestMarkup(box, 0.25, 0.25), true);
  assert.equal(hitTestMarkup(box, 0.9, 0.9), false);

  const items = [
    box,
    createTextMarkup({ point: { x: 0.8, y: 0.8 }, text: "Note", id: "t" }),
  ];
  assert.equal(findMarkupAt(items, 0.81, 0.81)?.id, "t");
});

test("RFI prefill uses Maple Point sheet pin and never names real clients", () => {
  const item = createTextMarkup({
    point: { x: 0.3, y: 0.4 },
    text: "Panel feed unclear",
    id: "note-1",
  });
  const prefill = prefillRfiFromMarkup({
    item,
    sheetId: "A-101",
    sheetRev: "A",
    roomName: "Electrical Closet 101",
    roomNumber: "101",
  });
  assert.match(prefill.subject, /Panel feed unclear/);
  assert.match(prefill.question, /A-101 Rev A/);
  assert.match(prefill.question, /Vector overlay/);
  assert.match(prefill.question, /not a Procore submit/i);
  assert.equal(prefill.location, "Electrical Closet 101");
  assert.doesNotMatch(prefill.subject, forbidden);
  assert.doesNotMatch(prefill.question, forbidden);
  assert.doesNotMatch(prefill.location, forbidden);

  const boxed = buildMarkupRfiPrefill({
    requestId: "maple-point",
    overlayId: "11111111-1111-4111-8111-111111111111",
    item: {
      id: "box-1",
      kind: "box",
      x: 0.2,
      y: 0.2,
      w: 0.3,
      h: 0.3,
    },
    sheetId: "A-101",
    sheetRev: "A",
    roomName: "Electrical Closet 101",
    vectors: { items: [] },
  });
  assert.match(boxed.subject, /Box on A-101 Rev A/);
  assert.match(boxed.subject, /Electrical Closet 101/);
  assert.equal(boxed.kind, "box");
  assert.doesNotMatch(JSON.stringify(boxed), forbidden);
});

test("undoLastMarkup drops the newest vector and clearAllMarkups wipes the sheet", () => {
  const items = [
    { id: "a", kind: "box" as const, x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    { id: "b", kind: "arrow" as const, x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.2 },
    createTextMarkup({ point: { x: 0.2, y: 0.3 }, text: "Check panel", id: "c" }),
  ];
  const undone = undoLastMarkup(items);
  assert.equal(undone.length, 2);
  assert.equal(undone[0]?.id, "a");
  assert.equal(undone[1]?.id, "b");
  assert.equal(items.length, 3);
  assert.deepEqual(undoLastMarkup([]), []);

  const cleared = clearAllMarkups(items);
  assert.deepEqual(cleared, []);
  assert.equal(items.length, 3);
  const empty: typeof items = [];
  assert.equal(clearAllMarkups(empty), empty);
  assert.equal(undoLastMarkup(empty), empty);
});

test("updateTextMarkup rewrites the tapped note and leaves other vectors", () => {
  const note = createTextMarkup({
    point: { x: 0.2, y: 0.3 },
    text: "Old note",
    id: "note-1",
  });
  const box = { id: "box-1", kind: "box" as const, x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
  const source = [box, note];
  const next = updateTextMarkup(source, "note-1", "  Panel feed unclear  ");
  assert.equal(next[0], box);
  assert.equal(next[1]?.id, "note-1");
  assert.equal(next[1]?.kind, "text");
  if (next[1]?.kind === "text") {
    assert.equal(next[1].text, "Panel feed unclear");
    assert.equal(next[1].x, note.x);
    assert.equal(next[1].y, note.y);
  }
  assert.equal(updateTextMarkup(source, "missing", "Nope"), source);
  assert.equal(updateTextMarkup(source, "note-1", "Old note"), source);
  assert.equal(source[1], note);
  assert.doesNotMatch(JSON.stringify(next), forbidden);
});

test("markupSaveChip maps storage and in-flight persist", () => {
  assert.deepEqual(markupSaveChip({ storage: "supabase", saving: true }), {
    label: "Saving…",
    tone: "saving",
  });
  assert.deepEqual(
    markupSaveChip({ storage: "local", saving: true, persistFailed: true }),
    { label: "Saving…", tone: "saving" },
  );
  assert.deepEqual(markupSaveChip({ storage: "supabase", saving: false }), {
    label: "Saved",
    tone: "saved",
  });
  assert.deepEqual(markupSaveChip({ storage: "unconfigured", saving: false }), {
    label: "Local only",
    tone: "local",
  });
  assert.deepEqual(markupSaveChip({ storage: "local", saving: false }), {
    label: "Local only",
    tone: "local",
  });
  assert.deepEqual(markupSaveChip({ storage: "unavailable", saving: false }), {
    label: "Couldn't save",
    tone: "failed",
  });
  assert.deepEqual(
    markupSaveChip({ storage: "local", saving: false, persistFailed: true }),
    { label: "Couldn't save", tone: "failed" },
  );
  assert.equal(
    foremanDraftStillAllowed({ selected: true, persistFailed: true }),
    true,
  );
  assert.equal(
    foremanDraftStillAllowed({ selected: false, persistFailed: true }),
    false,
  );
  assert.equal(
    foremanDraftStillAllowed({ selected: true, persistFailed: false }),
    true,
  );
});
