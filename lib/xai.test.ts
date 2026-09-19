import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { XAI_API_KEY_ALIASES, isXaiConfigured, normalizeTtsLanguage, readXaiApiKey } from "./xai.ts";

const CLIENT_VOICE_FILES = [
  "lib/voiceStatus.ts",
  "lib/readAloudStore.ts",
  "lib/voiceErrors.ts",
  "components/DictationButton.tsx",
  "components/ReadAloudButton.tsx",
  "components/VoiceSetupNote.tsx",
  "components/VoiceFeedback.tsx",
];

test("XAI key aliases are server-only and never NEXT_PUBLIC_", () => {
  assert.deepEqual([...XAI_API_KEY_ALIASES], ["XAI_API_KEY", "xai_api_key"]);
  for (const alias of XAI_API_KEY_ALIASES) {
    assert.equal(alias.startsWith("NEXT_PUBLIC_"), false);
  }
});

test("readXaiApiKey ignores NEXT_PUBLIC_XAI_API_KEY", () => {
  const saved = {
    XAI_API_KEY: process.env.XAI_API_KEY,
    xai_api_key: process.env.xai_api_key,
    NEXT_PUBLIC_XAI_API_KEY: process.env.NEXT_PUBLIC_XAI_API_KEY,
  };
  try {
    delete process.env.XAI_API_KEY;
    delete process.env.xai_api_key;
    process.env.NEXT_PUBLIC_XAI_API_KEY = "public-must-not-win";
    assert.equal(readXaiApiKey(), undefined);
    assert.equal(isXaiConfigured(), false);

    process.env.XAI_API_KEY = " server-only-key ";
    assert.equal(readXaiApiKey(), "server-only-key");
    assert.equal(isXaiConfigured(), true);
  } finally {
    restoreEnv("XAI_API_KEY", saved.XAI_API_KEY);
    restoreEnv("xai_api_key", saved.xai_api_key);
    restoreEnv("NEXT_PUBLIC_XAI_API_KEY", saved.NEXT_PUBLIC_XAI_API_KEY);
  }
});

test("normalizeTtsLanguage accepts auto / BCP-47 and falls back", () => {
  assert.equal(normalizeTtsLanguage(undefined), "en");
  assert.equal(normalizeTtsLanguage("auto"), "auto");
  assert.equal(normalizeTtsLanguage("pt-BR"), "pt-BR");
  assert.equal(normalizeTtsLanguage("not a lang"), "en");
});

test("client voice modules do not import the server key reader", () => {
  for (const file of CLIENT_VOICE_FILES) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    assert.doesNotMatch(src, /readXaiApiKey|readEnvAlias|xaiUpstream/);
    assert.doesNotMatch(src, /NEXT_PUBLIC_XAI/);
    assert.doesNotMatch(src, /process\.env/);
  }
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
