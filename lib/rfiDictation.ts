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

const FIELD_LABELS = ["subject", "title", "question", "description", "location"];

function labeledBlock(
  text: string,
  labels: string[],
  stopLabels: string[],
): string {
  const label = labels.map(escapeRe).join("|");
  const stop = stopLabels.map(escapeRe).join("|");
  const re = new RegExp(
    `\\b(?:${label})\\s*(?:[:\\-–.]|is)?\\s+(.+?)(?=\\b(?:${stop})\\s*(?:[:\\-–.]|is)?\\b|$)`,
    "i",
  );
  const match = text.match(re);
  return match?.[1]?.trim().replace(/[.,;]+$/, "") ?? "";
}

function removeLabeledBlock(
  text: string,
  labels: string[],
  stopLabels: string[],
): string {
  const label = labels.map(escapeRe).join("|");
  const stop = stopLabels.map(escapeRe).join("|");
  const re = new RegExp(
    `\\b(?:${label})\\s*(?:[:\\-–.]|is)?\\s+.+?(?=\\b(?:${stop})\\s*(?:[:\\-–.]|is)?\\b|$)`,
    "i",
  );
  return text.replace(re, " ").replace(/\s+/g, " ").trim();
}

function leftoverBody(text: string): string {
  let leftover = removeLabeledBlock(text, ["subject", "title"], FIELD_LABELS);
  leftover = removeLabeledBlock(leftover, ["location"], FIELD_LABELS);
  leftover = leftover.replace(LOCATION_RE, " ").replace(/\s+/g, " ").trim();
  return leftover.replace(/[.,;]+$/, "").trim();
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Spoken body for the Question / description field. Never drops the transcript. */
export function rfiDescriptionFromSpeech(parsed: RfiSpeechFields): string {
  return (
    parsed.description.trim() ||
    parsed.question.trim() ||
    parsed.transcript.trim()
  );
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
  let text = transcript.replace(SEND_PHRASE_RE, " ").replace(/\s+/g, " ").trim();

  let location = labeledBlock(text, ["location"], FIELD_LABELS);
  if (!location) {
    const locMatch = text.match(LOCATION_RE);
    location = locMatch?.[1]?.trim() ?? "";
    if (locMatch) {
      text = `${text.slice(0, locMatch.index)} ${text.slice((locMatch.index ?? 0) + locMatch[0].length)}`
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  let subject = labeledBlock(text, ["subject", "title"], FIELD_LABELS);
  let question = labeledBlock(text, ["question"], FIELD_LABELS);
  let description = labeledBlock(text, ["description"], FIELD_LABELS);

  if (!subject && !question && !description) {
    const cleaned = stripLeadIn(text);
    const split = firstSentence(cleaned);
    if (split.rest) {
      subject = split.head.replace(/[.!?]+$/, "");
      question = split.rest;
      description = split.rest;
    } else if (cleaned.length <= 80) {
      subject = cleaned.replace(/[.!?]+$/, "");
      question = cleaned;
      description = cleaned;
    } else {
      subject = cleaned.slice(0, 80).replace(/[,;:\s]+$/, "");
      question = cleaned;
      description = cleaned;
    }
  } else {
    if (!description && question) description = question;
    if (!question && description) question = description;
    if (!question && !description) {
      const leftover = leftoverBody(text);
      question = leftover || stripLeadIn(text);
      description = question;
    }
    if (!subject && (question || description)) {
      subject = stripLeadIn(description || question).slice(0, 80);
    }
  }

  if (!description && text) {
    description = leftoverBody(text) || stripLeadIn(text);
    if (!question) question = description;
  }

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
