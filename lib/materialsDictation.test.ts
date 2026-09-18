import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyMaterialOps,
  parseMaterialsDictation,
  type MaterialLineState,
} from "./materialsDictation.ts";

const seed: MaterialLineState[] = [
  {
    id: "jb",
    type: "Junction box 4sq",
    qty: 6,
    intent: "order",
    included: true,
  },
  {
    id: "dup",
    type: "Duplex receptacle",
    qty: 4,
    intent: "order",
    included: true,
  },
];

test("add increments an existing takeoff line", () => {
  const ops = parseMaterialsDictation("add 4 junction boxes");
  assert.equal(ops[0]?.kind, "line");
  const next = applyMaterialOps(seed, ops);
  const box = next.lines.find((line) => line.id === "jb");
  assert.equal(box?.qty, 10);
});

test("order sets qty and need marks intent", () => {
  const ops = parseMaterialsDictation(
    "order 2 duplex receptacles and need 1 lighting control relay",
  );
  const next = applyMaterialOps(seed, ops, "Electrical Closet 101");
  const duplex = next.lines.find((line) => line.id === "dup");
  assert.equal(duplex?.qty, 2);
  const relay = next.lines.find((line) => /lighting control/i.test(line.type));
  assert.equal(relay?.qty, 1);
  assert.equal(relay?.intent, "needed");
});

test("note-only utterance fills the order note", () => {
  const ops = parseMaterialsDictation("note need by Friday shop will grab");
  assert.deepEqual(ops, [
    { kind: "note", note: "need by Friday shop will grab" },
  ]);
});
