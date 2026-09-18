import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareSpeakText } from "./speakText.ts";

test("strips markdown, speech tags, keeps citations and code-block pause", () => {
  const spoken = prepareSpeakText(
    [
      "# Heading",
      "See [the note](https://example.com) and **bold** item [1].",
      "```",
      "secret",
      "```",
      "Row stays.",
      "[laugh]<whisper>quietly</whisper>",
      "[note] keep this",
    ].join("\n"),
  );
  assert.match(spoken, /Heading/);
  assert.match(spoken, /the note/);
  assert.match(spoken, /bold/);
  assert.match(spoken, /\[1\]/);
  assert.match(spoken, /Code block omitted/);
  assert.doesNotMatch(spoken, /secret/);
  assert.doesNotMatch(spoken, /\[laugh\]/);
  assert.doesNotMatch(spoken, /<whisper>/);
  assert.match(spoken, /quietly/);
  assert.match(spoken, /\[note\] keep this/);
});
