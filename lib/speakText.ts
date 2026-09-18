/**
 * Prepare prose for Grok TTS. Speak text, not markup.
 * Strip markdown and documented speech tags so untrusted strings cannot
 * steer delivery. Keep punctuation (it drives pacing).
 */

const FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`([^`]+)`/g;
const LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;
const HEADING_RE = /^#{1,6}\s+/gm;
const BOLD_RE = /\*\*([^*]+)\*\*|__([^_]+)__/g;
const ITALIC_RE = /(^|[^*])\*([^*]+)\*($|[^*])/g;
const TABLE_ROW_RE = /^\s*\|.+\|\s*$/gm;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm;

const SPEECH_BRACKETS = [
  "pause",
  "long-pause",
  "laugh",
  "chuckle",
  "giggle",
  "cry",
  "sigh",
  "breath",
  "inhale",
  "exhale",
  "tsk",
  "tongue-click",
  "lip-smack",
  "hum-tune",
];

const SPEECH_WRAPS = [
  "whisper",
  "soft",
  "loud",
  "emphasis",
  "build-intensity",
  "decrease-intensity",
  "slow",
  "fast",
  "higher-pitch",
  "lower-pitch",
  "singing",
  "sing-song",
];

const BRACKET_TAG_RE = new RegExp(
  `\\[\\s*(?:${SPEECH_BRACKETS.join("|")})\\s*\\]`,
  "gi",
);

const WRAP_TAG_RE = new RegExp(
  `</?(?:${SPEECH_WRAPS.join("|")})\\b[^>]*>`,
  "gi",
);

export const TTS_MAX_CHARS = 15_000;

export function stripMarkdownForSpeech(text: string): string {
  let out = text.replace(FENCE_RE, "[pause] Code block omitted.");
  out = out.replace(INLINE_CODE_RE, "$1");
  out = out.replace(LINK_RE, "$1");
  out = out.replace(HEADING_RE, "");
  out = out.replace(BOLD_RE, "$1$2");
  out = out.replace(ITALIC_RE, "$1$2$3");
  out = out.replace(TABLE_SEP_RE, "");
  out = out.replace(TABLE_ROW_RE, (row) => {
    const cells = row
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
    return cells.length ? `${cells.join(", ")}.` : "";
  });
  return out;
}

export function stripSpeechTags(text: string): string {
  return text.replace(BRACKET_TAG_RE, " ").replace(WRAP_TAG_RE, " ");
}

export function prepareSpeakText(text: string): string {
  const prepared = stripMarkdownForSpeech(stripSpeechTags(text))
    .replace(/\s+/g, " ")
    .trim();
  return prepared;
}

/** Split on paragraph, then sentence, then word so each chunk is ≤ max. */
export function splitSpeakChunks(
  text: string,
  max = TTS_MAX_CHARS,
): string[] {
  const prepared = prepareSpeakText(text);
  if (!prepared) return [];
  if (prepared.length <= max) return [prepared];

  const chunks: string[] = [];
  const paragraphs = prepared.split(/\s{2,}|\n+/);
  let current = "";

  function pushCurrent() {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  }

  function appendPiece(piece: string) {
    const next = current ? `${current} ${piece}` : piece;
    if (next.length <= max) {
      current = next;
      return;
    }
    if (current) pushCurrent();
    if (piece.length <= max) {
      current = piece;
      return;
    }
    const words = piece.split(/\s+/);
    for (const word of words) {
      const withWord = current ? `${current} ${word}` : word;
      if (withWord.length > max) {
        pushCurrent();
        current = word.slice(0, max);
        pushCurrent();
        current = "";
      } else {
        current = withWord;
      }
    }
  }

  for (const para of paragraphs) {
    const sentences = para.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [para];
    for (const sentence of sentences) {
      appendPiece(sentence.trim());
    }
  }
  pushCurrent();
  return chunks.filter(Boolean);
}
