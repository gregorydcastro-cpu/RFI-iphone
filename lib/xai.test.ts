import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { readEnvAlias } from "./env.ts";

const CLIENT_VOICE_FILES = [
  "lib/voiceStatus.ts",
  "lib/readAloudStore.ts",
  "lib/voiceErrors.ts",
  "components/DictationButton.tsx",
  "components/ReadAloudButton.tsx",
  "components/VoiceSetupNote.tsx",
  "components/VoiceFeedback.tsx",
];

const xaiSrc = readFileSync(join(process.cwd(), "lib/xai.ts"), "utf8");

test("XAI key aliases are server-only and never NEXT_PUBLIC_", () => {
  assert.match(
    xaiSrc,
    /XAI_API_KEY_ALIASES = \["XAI_API_KEY", "xai_api_key"\] as const/,
  );
  assert.match(xaiSrc, /readEnvAlias\(\.\.\.XAI_API_KEY_ALIASES\)/);
  assert.doesNotMatch(xaiSrc, /readEnvAlias\([^)]*NEXT_PUBLIC_XAI/);
  assert.match(xaiSrc, /NEXT_PUBLIC_XAI_API_KEY` is ignored/);
});

test("readEnvAlias used for XAI ignores NEXT_PUBLIC_XAI_API_KEY", () => {
  const saved = {
    XAI_API_KEY: process.env.XAI_API_KEY,
    xai_api_key: process.env.xai_api_key,
    NEXT_PUBLIC_XAI_API_KEY: process.env.NEXT_PUBLIC_XAI_API_KEY,
  };
  try {
    delete process.env.XAI_API_KEY;
    delete process.env.xai_api_key;
    process.env.NEXT_PUBLIC_XAI_API_KEY = "public-must-not-win";
    assert.equal(readEnvAlias("XAI_API_KEY", "xai_api_key"), undefined);

    process.env.XAI_API_KEY = " server-only-key ";
    assert.equal(readEnvAlias("XAI_API_KEY", "xai_api_key"), "server-only-key");
  } finally {
    restoreEnv("XAI_API_KEY", saved.XAI_API_KEY);
    restoreEnv("xai_api_key", saved.xai_api_key);
    restoreEnv("NEXT_PUBLIC_XAI_API_KEY", saved.NEXT_PUBLIC_XAI_API_KEY);
  }
});

test("normalizeTtsLanguage accepts auto / BCP-47 and falls back", () => {
  const match = xaiSrc.match(
    /export function normalizeTtsLanguage[\s\S]+?^}/m,
  );
  assert.ok(match, "normalizeTtsLanguage must be exported from xai.ts");
  assert.match(xaiSrc, /TTS_LANGUAGE_RE = \/\^\(auto\|\[a-z\]\{2\}/);
  assert.match(xaiSrc, /XAI_TTS_LANGUAGE/);
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
