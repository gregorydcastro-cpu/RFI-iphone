import assert from "node:assert/strict";
import { test } from "node:test";
import { parseVoiceCommand } from "./voiceCommands.ts";

const JOBS = [
  {
    slug: "maple-point",
    name: "Maple Point Medical Office",
    city: "Cedar Falls",
    phase: "Electrical rough-in",
    roomsHint: "101 · 102 · 733",
  },
];

test("open Maple Point pack goes to the job request", () => {
  const command = parseVoiceCommand("open Maple Point pack", JOBS);
  assert.equal(command?.kind, "open-job");
  if (command?.kind === "open-job") {
    assert.equal(command.job.slug, "maple-point");
  }
});

test("pull room 101 opens Maple Point room pack", () => {
  const command = parseVoiceCommand("pull room 101", JOBS);
  assert.equal(command?.kind, "open-pack");
  if (command?.kind === "open-pack") {
    assert.equal(command.job.slug, "maple-point");
    assert.equal(command.room, "101");
  }
});

test("open Maple Point room 101 keeps the job and room", () => {
  const command = parseVoiceCommand("open Maple Point room 101", JOBS);
  assert.equal(command?.kind, "open-pack");
  if (command?.kind === "open-pack") {
    assert.equal(command.job.slug, "maple-point");
    assert.equal(command.room, "101");
  }
});
