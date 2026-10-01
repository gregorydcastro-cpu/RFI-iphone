/**
 * Turn a field dictation into Generate RFI form fields.
 * Still a draft to the foreman — never a Procore submit.
 */

export type RfiSpeechFields = {
  subject: string;
  question: string;
  /** Body for the Question / description textarea (STT always lands here). */
  description: string;
  location: string;
  send: boolean;
  transcript: string;
};

export type RfiFormSpeechFields = {
  subject: string;
  question: string;
  location: string;
};

const SEND_PHRASE_RE =
  /\b(?:please\s+)?(?:send(?:\s+it)?(?:\s+to\s+(?:pat(?:\s+nguyen)?|the\s+foreman))?|(?:create|file|submit)(?:\s+the)?(?:\s+rfi|\s+draft)?|send(?:\s+the)?\s+draft)\b[.!]?\s*/gi;

const LOCATION_RE =
  /\b(?:in\s+|at\s+)?(?:location\s+(?:is\s+)?)?((?:electrical\s+)?closet\s+\d{2,4}[a-z]?|room\s+\d{2,4}[a-z]?)\b/i;

type FieldLabel = "subject" | "title" | "question" | "description" | "location";

type LabelSpan = {
  label: FieldLabel;
  start: number;
  contentStart: number;
  end: number;
};

function cleanEnd(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/[.,;]+$/, "").trim();
}

/** Keep a short subject, but never slice through a word. */
function clipWords(text: string, max: number): string {
  const clean = cleanEnd(text);
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const clipped = (lastSpace > 24 ? slice.slice(0, lastSpace) : slice).replace(
    /[,;:\s]+$/,
    "",
  );
  return clipped.trim();
}

function isFieldLabel(label: FieldLabel, rest: string): boolean {
  if (label === "title" && /^block\b/i.test(rest)) return false;
  if (label === "location" && /^of\b/i.test(rest)) return false;
  if (label === "subject" && /^to\b/i.test(rest)) return false;
  return true;
}

/**
 * Field labels only count at the start of the utterance or after a sentence
 * break. "title block" and "the question is" in the middle of a sentence
 * are speech, not field stops.
 */
function findLabelSpans(text: string): LabelSpan[] {
  const re =
    /(?:^|[.!?]\s+)(subject|title|question|description|location)\b\s*(?:[:\-–.]|is)?\s+/gi;
  const spans: LabelSpan[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const label = match[1].toLowerCase() as FieldLabel;
    const contentStart = match.index + match[0].length;
    if (!isFieldLabel(label, text.slice(contentStart))) {
      re.lastIndex = match.index + match[0].length;
      continue;
    }
    spans.push({ label, start: match.index, contentStart, end: text.length });
  }
  for (let i = 0; i < spans.length; i++) {
    const next = spans[i + 1];
    if (next) spans[i].end = next.start;
  }
  return spans;
}

function spanText(text: string, spans: LabelSpan[], labels: FieldLabel[]): string {
  const span = spans.find((item) => labels.includes(item.label));
  if (!span) return "";
  return cleanEnd(text.slice(span.contentStart, span.end));
}

function unlabeledRemainder(text: string, spans: LabelSpan[]): string {
  if (!spans.length) return "";
  const parts: string[] = [];
  let cursor = 0;
  for (const span of spans) {
    parts.push(text.slice(cursor, span.start));
    cursor = span.end;
  }
  parts.push(text.slice(cursor));
  return cleanEnd(stripLeadIn(parts.join(" ")));
}

function mergeSpeechParts(question: string, description: string): string {
  if (!question) return description;
  if (!description) return question;
  if (question === description) return question;
  if (description.includes(question)) return description;
  if (question.includes(description)) return question;
  return `${question} ${description}`.replace(/\s+/g, " ").trim();
}

/** Spoken body for the Question / description field. Never drops the transcript. */
export function rfiDescriptionFromSpeech(parsed: RfiSpeechFields): string {
  const body = mergeSpeechParts(parsed.question.trim(), parsed.description.trim());
  return body || parsed.transcript.trim();
}

/** Map STT parse → Generate RFI inputs. Description/question always take the transcript. */
export function applyRfiSpeechToFields(
  parsed: RfiSpeechFields,
  current: RfiFormSpeechFields,
): RfiFormSpeechFields {
  return {
    subject: parsed.subject || current.subject,
    question: rfiDescriptionFromSpeech(parsed) || current.question,
    location: parsed.location || current.location,
  };
}

function firstSentence(text: string): { head: string; rest: string } {
  const match = text.match(/^(.+?[.!?])(?:\s+|$)([\s\S]*)$/);
  if (match) {
    return { head: match[1].trim(), rest: match[2].trim() };
  }
  const comma = text.split(/\s+(?:question|what's|what is|do we|is the)\s+/i);
  if (comma.length >= 2 && comma[0] && comma[0].length <= 90) {
    return { head: comma[0].trim(), rest: text.slice(comma[0].length).trim() };
  }
  return { head: text.trim(), rest: "" };
}

function stripLeadIn(text: string): string {
  return text
    .replace(/^\s*(?:new\s+)?(?:rfi|draft)(?:\s+about|\s+for|:)?\s+/i, "")
    .trim();
}

export function parseRfiDictation(raw: string): RfiSpeechFields {
  const transcript = raw.trim();
  const send = SEND_PHRASE_RE.test(transcript);
  SEND_PHRASE_RE.lastIndex = 0;
  const text = transcript.replace(SEND_PHRASE_RE, " ").replace(/\s+/g, " ").trim();

  const spans = findLabelSpans(text);
  let location = spanText(text, spans, ["location"]);
  if (!location) {
    location = text.match(LOCATION_RE)?.[1]?.trim() ?? "";
  }

  let subject = spanText(text, spans, ["subject", "title"]);
  let question = spanText(text, spans, ["question"]);
  let description = spanText(text, spans, ["description"]);

  if (!spans.length) {
    const cleaned = stripLeadIn(text);
    const split = firstSentence(cleaned);
    if (split.rest) {
      subject = split.head.replace(/[.!?]+$/, "").trim();
      question = cleanEnd(split.rest);
      description = question;
    } else if (cleaned.length <= 80) {
      subject = cleaned.replace(/[.!?]+$/, "").trim();
      question = cleaned;
      description = cleaned;
    } else {
      subject = clipWords(cleaned, 80);
      question = cleaned;
      description = cleaned;
    }
  } else if (subject) {
    const split = firstSentence(subject);
    if (split.rest) {
      subject = split.head.replace(/[.!?]+$/, "").trim();
      const extra = cleanEnd(split.rest);
      if (extra) {
        question = question ? `${extra} ${question}`.replace(/\s+/g, " ").trim() : extra;
        description = description
          ? `${extra} ${description}`.replace(/\s+/g, " ").trim()
          : extra;
      }
    }
  }

  if (!description && question) description = question;
  if (!question && description) question = description;
  if (!question && !description) {
    const body = unlabeledRemainder(text, spans) || subject || stripLeadIn(text) || text;
    question = body;
    description = body;
  }
  if (!subject && (question || description)) {
    subject = clipWords(stripLeadIn(description || question), 80);
  }
  if (!description && text) {
    description = stripLeadIn(text) || text;
    if (!question) question = description;
  }
  if (!subject && description) subject = clipWords(description, 80);

  return {
    subject: subject.trim(),
    question: question.trim(),
    description: description.trim(),
    location: location.trim(),
    send,
    transcript,
  };
}

export function rfiSpeakText(input: {
  number?: string;
  title: string;
  status: string;
  question?: string;
  location?: string;
  draftToForeman?: boolean;
}): string {
  const parts = [
    input.number ? `${input.number}.` : "Draft RFI.",
    input.title.replace(/[.!?]+$/, ""),
    `Status ${input.status}`,
  ];
  if (input.location) parts.push(`Location ${input.location}`);
  if (input.question) parts.push(`Question. ${input.question}`);
  if (input.draftToForeman) {
    parts.push("Draft to foreman Pat Nguyen. Not a Procore submit.");
  }
  return parts.join(". ").replace(/\.\s*\./g, ".");
}
