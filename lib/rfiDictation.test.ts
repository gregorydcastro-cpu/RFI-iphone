import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRfiDictation, rfiSpeakText } from "./rfiDictation.ts";

test("labeled RFI dictation fills subject, question, location", () => {
  const parsed = parseRfiDictation(
    "Subject panel feed clarification. Question is the feeder three phase? Location electrical closet 101.",
  );
  assert.match(parsed.subject, /panel feed/i);
  assert.match(parsed.question, /feeder/i);
  assert.match(parsed.location, /closet 101/i);
  assert.equal(parsed.send, false);
});

test("room mention fills location and first sentence becomes subject", () => {
  const parsed = parseRfiDictation(
    "Spare breaker count. Do we have space for a future IT rack in closet 101?",
  );
  assert.match(parsed.subject, /spare breaker/i);
  assert.match(parsed.question, /future IT rack/i);
  assert.match(parsed.location, /closet 101/i);
});

test("send draft intent is detected and stripped", () => {
  const parsed = parseRfiDictation(
    "Subject lighting transfer. Question where does emergency lighting transfer? Send draft to Pat Nguyen.",
  );
  assert.equal(parsed.send, true);
  assert.match(parsed.subject, /lighting transfer/i);
  assert.doesNotMatch(parsed.question, /send draft/i);
});

test("read-aloud for pack RFIs is number title status only", () => {
  const spoken = rfiSpeakText({
    number: "RFI-001",
    title: "Panel feed clarification for PP-101",
    status: "open",
  });
  assert.match(spoken, /RFI-001/);
  assert.match(spoken, /Panel feed clarification/);
  assert.match(spoken, /Status open/);
  assert.doesNotMatch(spoken, /Pat Nguyen/);
});

test("draft confirmation includes foreman disclaimer", () => {
  const spoken = rfiSpeakText({
    title: "Panel feed",
    status: "draft",
    question: "What size feeder?",
    location: "Electrical Closet 101",
    draftToForeman: true,
  });
  assert.match(spoken, /What size feeder/);
  assert.match(spoken, /Pat Nguyen/);
  assert.match(spoken, /Not a Procore submit/);
});
