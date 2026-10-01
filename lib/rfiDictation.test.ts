import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRfiSpeechToFields,
  parseRfiDictation,
  rfiDescriptionFromSpeech,
  rfiSpeakText,
} from "./rfiDictation.ts";

test("labeled RFI dictation fills subject, question, location", () => {
  const parsed = parseRfiDictation(
    "Subject panel feed clarification. Question is the feeder three phase? Location electrical closet 101.",
  );
  assert.match(parsed.subject, /panel feed/i);
  assert.match(parsed.question, /feeder/i);
  assert.match(parsed.description, /feeder/i);
  assert.match(parsed.location, /closet 101/i);
  assert.equal(parsed.send, false);
});

test("room mention fills location and first sentence becomes subject", () => {
  const parsed = parseRfiDictation(
    "Spare breaker count. Do we have space for a future IT rack in closet 101?",
  );
  assert.match(parsed.subject, /spare breaker/i);
  assert.match(parsed.question, /future IT rack/i);
  assert.match(parsed.description, /future IT rack/i);
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

test("description label fills the description body", () => {
  const parsed = parseRfiDictation(
    "Subject panel feed. Description the panel schedule is missing spare breakers. Location closet 101.",
  );
  assert.match(parsed.subject, /panel feed/i);
  assert.match(parsed.description, /spare breakers/i);
  assert.match(parsed.question, /spare breakers/i);
  assert.match(parsed.location, /closet 101/i);
});

test("question plus description keeps the description transcript", () => {
  const parsed = parseRfiDictation(
    "Subject panel feed. Question is the feeder three phase? Description confirm spare breaker count for a future IT rack. Location closet 101.",
  );
  assert.match(parsed.subject, /panel feed/i);
  assert.match(parsed.question, /feeder three phase/i);
  assert.match(parsed.description, /spare breaker count/i);
  assert.match(parsed.location, /closet 101/i);
});

test("unlabeled leftover after subject and location fills description", () => {
  const parsed = parseRfiDictation(
    "Subject lighting transfer. Need to confirm where emergency lighting transfers. Location closet 101.",
  );
  assert.match(parsed.subject, /lighting transfer/i);
  assert.match(parsed.description, /emergency lighting/i);
  assert.match(parsed.location, /closet 101/i);
});

test("freeform transcript fills description", () => {
  const parsed = parseRfiDictation(
    "The panel schedule on A207 does not show a spare breaker for a future IT rack",
  );
  assert.match(parsed.description, /spare breaker/i);
  assert.match(parsed.question, /spare breaker/i);
  assert.ok(parsed.description.length > 20);
});

test("applyRfiSpeechToFields always writes transcript into question/description", () => {
  const parsed = parseRfiDictation(
    "Subject panel feed clarification. Location electrical closet 101.",
  );
  const next = applyRfiSpeechToFields(parsed, {
    subject: "",
    question: "",
    location: "Maple Point",
  });
  assert.match(next.subject, /panel feed/i);
  assert.match(next.location, /closet 101/i);
  assert.ok(next.question.length > 0);
  assert.equal(next.question, rfiDescriptionFromSpeech(parsed));
  assert.match(next.question, /panel feed|closet 101/i);
});

test("title block in the subject and description is not cut off", () => {
  const parsed = parseRfiDictation(
    "Subject confirm the panel title block revision. Description the title block is missing the panel schedule.",
  );
  assert.match(parsed.subject, /title block revision/i);
  assert.match(parsed.description, /title block is missing the panel schedule/i);
  const next = applyRfiSpeechToFields(parsed, {
    subject: "",
    question: "",
    location: "",
  });
  assert.match(next.subject, /title block revision/i);
  assert.match(next.question, /title block is missing/i);
});

test("spoken question and description both land in the draft body", () => {
  const parsed = parseRfiDictation(
    "Subject panel feed. Question is the feeder three phase? Description confirm spare breaker count for a future IT rack. Location closet 101.",
  );
  const next = applyRfiSpeechToFields(parsed, {
    subject: "",
    question: "",
    location: "",
  });
  assert.match(next.question, /feeder three phase/i);
  assert.match(next.question, /spare breaker count/i);
  assert.match(next.location, /closet 101/i);
});

test("long freeform subject clips on a word and description keeps the speech", () => {
  const spoken =
    "Need a spare breaker for the future IT rack on the electrical panel schedule before rough-in inspection tomorrow morning at Maple Point";
  const parsed = parseRfiDictation(spoken);
  assert.ok(spoken.length > 80);
  assert.ok(parsed.subject.length <= 80);
  assert.ok(parsed.subject.includes(" "));
  assert.equal(spoken.startsWith(parsed.subject), true);
  assert.equal(parsed.description, spoken);
  assert.match(parsed.description, /Maple Point/);
});

test("a sentence that mentions title block stays in the description", () => {
  const parsed = parseRfiDictation(
    "The drawing is wrong. Title block is missing the revision and the panel schedule.",
  );
  assert.match(parsed.subject, /drawing is wrong/i);
  assert.match(parsed.description, /Title block is missing the revision and the panel schedule/i);
});
