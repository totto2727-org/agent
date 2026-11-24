// Source: ASD-STE100 Issue 9, rules 5.1, 6.3, 6.6 and section 8.
// This is a bounded prose parser, not a grammar, typography or dictionary oracle.
const GROUP_CATEGORIES = [
  "number",
  "measurement",
  "abbreviation",
  "identifier",
  "quoted",
  "title",
  "proper-noun",
  "formula",
];

export function validateSteContext(value, label, ErrorType = Error) {
  if (value === undefined) return undefined;
  const reject = (message) => {
    throw new ErrorType(`${label}: ${message}`);
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) reject("must be an object");
  if (
    Object.keys(value).some(
      (key) =>
        !["writingMode", "wordGroups", "measurementUnits", "vocabularyFile", "nounGroups"].includes(
          key,
        ),
    )
  )
    reject("unexpected parameter");
  if (value.writingMode !== undefined && !["procedural", "descriptive"].includes(value.writingMode))
    reject("writingMode must be procedural or descriptive");
  const literal = (text) =>
    typeof text === "string" &&
    text.trim() === text &&
    text.length > 0 &&
    text.length <= 512 &&
    ![...text].some((character) => character.codePointAt(0) < 32);
  if (
    value.wordGroups !== undefined &&
    (!Array.isArray(value.wordGroups) ||
      value.wordGroups.length > 1000 ||
      value.wordGroups.some(
        (group) =>
          !group ||
          typeof group !== "object" ||
          Array.isArray(group) ||
          Object.keys(group).some((key) => !["text", "category"].includes(key)) ||
          !literal(group.text) ||
          !GROUP_CATEGORIES.includes(group.category),
      ))
  )
    reject("wordGroups must contain at most 1000 literal text/category records");
  if (
    value.measurementUnits !== undefined &&
    (!Array.isArray(value.measurementUnits) ||
      value.measurementUnits.length > 1000 ||
      value.measurementUnits.some(
        (unit) => !literal(unit) || !/^[\p{L}°µμΩ%/]+(?: [\p{L}°µμΩ%/]+)*$/u.test(unit),
      ))
  )
    reject("measurementUnits must contain at most 1000 literal units");
  if (value.vocabularyFile !== undefined && !literal(value.vocabularyFile))
    reject("vocabularyFile must be a non-empty local path");
  if (
    value.nounGroups !== undefined &&
    (!Array.isArray(value.nounGroups) ||
      value.nounGroups.length > 1000 ||
      value.nounGroups.some(
        (group) =>
          !group ||
          typeof group !== "object" ||
          Array.isArray(group) ||
          Object.keys(group).some((key) => !["text", "kind", "source"].includes(key)) ||
          !literal(group.text) ||
          !["new-technical", "multi-word", "official"].includes(group.kind) ||
          !literal(group.source),
      ))
  )
    reject(
      "nounGroups must contain at most 1000 literal text/kind/source records, never submitted counts",
    );
  return { ...value };
}

// Section 2.2 counts hyphenated noun tokens as one word while limiting newly
// made hyphen groups to three components. This does not identify noun roles.
export function countDeclaredNounGroup(text) {
  if (!/^[A-Za-z]+(?:-[A-Za-z]+)*(?: [A-Za-z]+(?:-[A-Za-z]+)*)*$/.test(text)) return null;
  const words = text.split(" ");
  return {
    wordCount: words.length,
    hyphenComponentCounts: words.map((word) => word.split("-").length),
  };
}

export function validateSteVocabulary(value, label, ErrorType = Error) {
  const reject = (message) => {
    throw new ErrorType(`${label}: ${message}`);
  };
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => !["issue", "source", "entries", "technicalTerms"].includes(key),
    )
  )
    reject("must contain issue, source, entries and optional technicalTerms");
  if (value.issue !== 9 || typeof value.source !== "string" || !value.source.trim())
    reject("requires issue 9 and declared source provenance");
  if (!Array.isArray(value.entries) || !value.entries.length || value.entries.length > 20000)
    reject("entries must contain 1 through 20000 records");
  const token = (text) =>
    typeof text === "string" &&
    text.length <= 128 &&
    /^[\p{L}\p{N}]+(?:[-' ][\p{L}\p{N}]+)*$/u.test(text);
  for (const entry of value.entries) {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      Object.keys(entry).some(
        (key) => !["word", "forms", "approved", "partOfSpeech", "meaning"].includes(key),
      ) ||
      !token(entry.word) ||
      typeof entry.approved !== "boolean" ||
      typeof entry.partOfSpeech !== "string" ||
      !entry.partOfSpeech.trim() ||
      typeof entry.meaning !== "string" ||
      !entry.meaning.trim() ||
      (entry.forms !== undefined &&
        (!Array.isArray(entry.forms) ||
          entry.forms.length > 100 ||
          entry.forms.some((form) => !token(form))))
    )
      reject(
        "invalid dictionary record: declare word, approved, partOfSpeech, meaning and optional exact forms",
      );
  }
  const technicalLiteral = (term) =>
    typeof term === "string" &&
    term.length > 0 &&
    term.length <= 512 &&
    term.trim() === term &&
    /^[\p{L}\p{N}]+(?:[-' ][\p{L}\p{N}]+)*$/u.test(term);
  if (
    value.technicalTerms !== undefined &&
    (!Array.isArray(value.technicalTerms) ||
      value.technicalTerms.length > 1000 ||
      value.technicalTerms.some((term) => {
        if (typeof term === "string") return !technicalLiteral(term);
        return (
          !term ||
          typeof term !== "object" ||
          Array.isArray(term) ||
          Object.keys(term).some((key) => !["text", "kind", "category", "source"].includes(key)) ||
          !technicalLiteral(term.text) ||
          !["noun", "verb"].includes(term.kind) ||
          !Number.isInteger(term.category) ||
          term.category < 1 ||
          term.category > (term.kind === "noun" ? 22 : 4) ||
          typeof term.source !== "string" ||
          !term.source.trim() ||
          term.source.length > 512
        );
      }))
  )
    reject("invalid technicalTerms: use candidate literals or text/kind/category/source records");
  return value;
}

// Edits preserve source offsets. A group becomes one artificial lowercase word.
function collapse(characters, start, end) {
  for (let index = start; index < end; index += 1)
    if (!/[\r\n]/.test(characters[index])) characters[index] = index === start ? "x" : " ";
}
function boundary(text, index) {
  return index < 0 || index >= text.length || !/[\p{L}\p{N}_]/u.test(text[index]);
}

export function analyzeSteProse(text, context = {}, { paragraph = false } = {}) {
  const warnings = [];
  const warn = (reason, start = 0, end = text.length) => warnings.push({ reason, start, end });
  const characters = text.split("");
  const label =
    context.writingMode === "procedural"
      ? /^\s*(?:WARNING|CAUTION|DANGER):[ \t]*/.exec(text)
      : /^\s*(?:NOTE|NOTES):[ \t]*/.exec(text);
  if (label)
    for (let index = 0; index < label[0].length; index += 1)
      if (!/[\r\n]/.test(characters[index])) characters[index] = " ";
  // Section 8.6 excludes document/work-step numbering, not ordinary identifiers.
  if (context.writingMode === "procedural")
    for (const match of text.matchAll(/^(?:\(\d+\)|[A-Z][.)])\s+/gm)) {
      for (let index = match.index; index < match.index + match[0].length; index += 1)
        if (!/[\r\n]/.test(characters[index])) characters[index] = " ";
    }
  const extraSentences = [];
  const groups = [...(context.wordGroups ?? [])].sort((a, b) => b.text.length - a.text.length);
  for (const group of groups) {
    let at = 0;
    while ((at = characters.join("").indexOf(group.text, at)) !== -1) {
      if (boundary(text, at - 1) && boundary(text, at + group.text.length))
        collapse(characters, at, at + group.text.length);
      at += group.text.length;
    }
  }
  // Quoted text, including its punctuation, is one word, not new sentences.
  for (const match of characters.join("").matchAll(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’/g))
    collapse(characters, match.index, match.index + match[0].length);
  if (/["“”‘’]/.test(characters.join("")))
    warn("Unbalanced quotation marks require contextual parsing.");
  let current = characters.join("");
  if (/\([^()]*\([^)]*\)/.test(current)) warn("Nested parentheses require contextual parsing.");
  for (const match of current.matchAll(/\([^()]*\)/g)) {
    const inner = match[0].slice(1, -1);
    const identifier = /^[A-Z0-9]+(?:[/-][A-Z0-9]+)*$/.test(inner);
    const attached = match.index > 0 && /[\p{L}\p{N}]/u.test(current[match.index - 1]);
    if (attached) {
      warn(
        "Attached singular/plural parentheses require contextual counting.",
        match.index,
        match.index + match[0].length,
      );
      continue;
    }
    if (!identifier) {
      if (paragraph)
        warn(
          "Parenthetical prose has a separate word-count sentence, but its paragraph sentence boundary requires review.",
          match.index,
          match.index + match[0].length,
        );
      const analysis = analyzeSteProse(inner, { ...context, fragment: true });
      warnings.push(
        ...analysis.warnings.map((warning) => ({
          ...warning,
          start: warning.start + match.index + 1,
          end: warning.end + match.index + 1,
        })),
      );
      extraSentences.push(
        ...analysis.sentences.map((sentence) => ({
          ...sentence,
          start: sentence.start + match.index + 1,
          end: sentence.end + match.index + 1,
          parenthetical: true,
        })),
      );
    }
    collapse(characters, match.index, match.index + match[0].length);
  }
  current = characters.join("");
  if (/[()]/.test(current)) warn("Unbalanced or nested parentheses require contextual parsing.");
  // These abbreviations and compounds are explicitly illustrated in section 8.6.
  for (const match of current.matchAll(
    /\b(?:No\.\s+\d[\w-]*|\d+(?:\.\d+)?\s+(?:a\.m\.|p\.m\.))(?=\s|[,.!?]|$)/g,
  )) {
    collapse(characters, match.index, match.index + match[0].length);
    if (match[0].endsWith(".") && !current.slice(match.index + match[0].length).trim())
      characters[match.index + match[0].length - 1] = ".";
  }
  const units = [
    ...new Set([
      "mm",
      "mA",
      "°C",
      "degrees Celsius",
      "kg",
      "kilograms",
      "ohms",
      "Ω",
      ...(context.measurementUnits ?? []),
    ]),
  ].sort((a, b) => b.length - a.length);
  current = characters.join("");
  for (const match of current.matchAll(/[+-]?\d+(?:,\d{3})*(?:\.\d+)?/g)) {
    if (!boundary(current, match.index - 1) || !boundary(current, match.index + match[0].length))
      continue;
    const tail = current.slice(match.index + match[0].length);
    const gap = /^\s+/.exec(tail)?.[0] ?? "";
    const unit = units.find(
      (candidate) =>
        tail.slice(gap.length).startsWith(candidate) &&
        boundary(tail, gap.length + candidate.length),
    );
    if (unit && gap)
      collapse(characters, match.index, match.index + match[0].length + gap.length + unit.length);
    else {
      collapse(characters, match.index, match.index + match[0].length);
      if (!paragraph && /^\s+[\p{L}°µμΩ%]/u.test(tail))
        warn(
          "A number followed by an undeclared word can be a measurement or identifier; declare the literal group or measurement unit.",
          match.index,
          match.index + match[0].length + gap.length,
        );
    }
  }
  current = characters.join("");
  if (!paragraph && /\b(?:hundred|thousand|million|billion)\b/i.test(current))
    warn("Multi-word written numbers require a declared number group.");
  if (/\b[\p{L}]+\.(?=[\p{L}]|\s+[a-z])/u.test(current))
    warn("A period can be an abbreviation boundary; declare abbreviations before counting.");
  if (/\.{2,}|[!?]{2,}/.test(current))
    warn("Ellipsis or repeated sentence punctuation requires review.");
  if (/--|\s-\s/.test(current))
    warn("A dash or compound token with repeated hyphens requires contextual counting.");
  if (
    [...current].some(
      (character) => "`*_[]<>\\|{}=+/".includes(character) || character.codePointAt(0) > 127,
    )
  )
    warn("Unsupported markup, formula, or punctuation requires contextual counting.");
  if (/:/.test(current))
    warn(
      "A colon outside a recognized vertical-list introduction requires contextual sentence parsing.",
    );
  if (/\b(?:NOTE|NOTES)\b/.test(current) && context.writingMode === "procedural")
    warn("Notes in procedures use descriptive limits; supply a descriptive local target.");
  const sentences = [];
  let start = 0;
  const flush = (end) => {
    const body = current.slice(start, end);
    const tokens = [...body.matchAll(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)];
    if (tokens.length) {
      for (let index = 0; index < tokens.length; index += 1) {
        if (
          !paragraph &&
          /[A-Z]/.test(tokens[index][0]) &&
          (index !== 0 || /^[A-Z0-9-]+$/.test(tokens[index][0]))
        )
          warn(
            "Capitalized or uppercase text can be an unmarked title, proper noun, label or abbreviation; declare its word group.",
            start + tokens[index].index,
            start + tokens[index].index + tokens[index][0].length,
          );
      }
      sentences.push({ start: start + tokens[0].index, end, wordCount: tokens.length });
    }
    start = end;
  };
  for (const match of current.matchAll(/[.!?]/g)) flush(match.index + 1);
  if (current.slice(start).trim()) {
    const unfinishedStart = start;
    flush(current.length);
    if (!context.fragment)
      warn(
        "Unterminated prose may be a fragment or incomplete sentence.",
        unfinishedStart,
        current.length,
      );
  }
  return {
    sentences: [...sentences, ...extraSentences],
    paragraphSentences: sentences.length,
    warnings,
  };
}
