import { analyzeSteProse, countDeclaredNounGroup } from "./ste.mjs";

// Bounded local criteria only. These checks do not certify full STE compliance.
// No manifest-supplied executable expressions or regular expressions are accepted.
export function validateMechanicalCheck(check, label, ErrorType = Error) {
  const reject = (message) => {
    throw new ErrorType(`${label}: ${message}`);
  };
  if (!check || typeof check !== "object" || Array.isArray(check)) reject("must be an object");
  const kinds = {
    "fenced-code-language": ["kind"],
    "prohibited-terms": ["kind", "terms", "caseSensitive", "protectedTerms"],
    "ste-punctuation": ["kind"],
    "ste-sentence-length": ["kind", "writingMode"],
    "ste-paragraph-length": ["kind"],
    "ste-dictionary-membership": ["kind"],
  };
  if (!Object.hasOwn(kinds, check.kind)) reject("unsupported mechanical kind");
  const allowed = kinds[check.kind];
  if (Object.keys(check).some((key) => !allowed.includes(key))) reject("unexpected parameter");
  if (check.kind === "ste-sentence-length") {
    if (!["procedural", "descriptive"].includes(check.writingMode))
      reject("writingMode must be procedural or descriptive");
    return { kind: check.kind, writingMode: check.writingMode };
  }
  if (check.kind === "prohibited-terms") {
    if (
      !Array.isArray(check.terms) ||
      !check.terms.length ||
      check.terms.length > 1000 ||
      check.terms.some(
        (term) => typeof term !== "string" || term.length > 128 || !/^[\p{L}\p{N}_]+$/u.test(term),
      )
    )
      reject(
        "terms must contain 1 through 1000 literal whole tokens (at most 128 characters each)",
      );
    if (check.caseSensitive !== undefined && typeof check.caseSensitive !== "boolean")
      reject("caseSensitive must be boolean");
    if (
      check.protectedTerms !== undefined &&
      (!Array.isArray(check.protectedTerms) ||
        check.protectedTerms.length > 1000 ||
        check.protectedTerms.some(
          (term) =>
            typeof term !== "string" || term.length > 128 || !/^[\p{L}\p{N}_]+$/u.test(term),
        ))
    )
      reject(
        "protectedTerms must be an array of literal whole tokens (at most 1000 tokens, 128 characters each)",
      );
    return {
      kind: check.kind,
      terms: [...new Set(check.terms)],
      protectedTerms: [...new Set(check.protectedTerms ?? [])],
      caseSensitive: check.caseSensitive ?? false,
    };
  }
  return { kind: check.kind };
}

export function sourceRange(markdown, start, end) {
  return {
    startLine: markdown.slice(0, start).split("\n").length,
    endLine: Math.max(
      1,
      markdown.slice(0, end).split("\n").length - (end > 0 && markdown[end - 1] === "\n" ? 1 : 0),
    ),
    startByte: Buffer.byteLength(markdown.slice(0, start)),
    endByte: Buffer.byteLength(markdown.slice(0, end)),
  };
}

export function nounGroupCounts(markdown, targetRange, groups = []) {
  const { visible, uncertainties } = inspectMarkdown(markdown);
  const selected = [];
  for (const group of groups) {
    let at = 0;
    while ((at = visible.indexOf(group.text, at)) !== -1) {
      const end = at + group.text.length;
      const range = sourceRange(markdown, at, end);
      if (
        range.startByte >= targetRange.startByte &&
        range.endByte <= targetRange.endByte &&
        !/[\p{L}\p{N}_'-]/u.test(visible[at - 1] ?? "") &&
        !/[\p{L}\p{N}_'-]/u.test(visible[end] ?? "")
      ) {
        const counts = uncertainties.some((entry) => at < entry.end && end > entry.start)
          ? null
          : countDeclaredNounGroup(group.text);
        selected.push({
          ...group,
          status: counts ? "counted" : "insufficient_context",
          ...(counts ?? { wordCount: null, hyphenComponentCounts: null }),
          sourceRange: range,
        });
      }
      at = end;
    }
  }
  return selected;
}

// Offsets remain UTF-16 source offsets until sourceRange converts them to UTF-8.
// Conservative exclusions intentionally reduce coverage rather than claim that
// code, metadata, link destinations, or HTML meet a prose criterion.
export function inspectMarkdown(markdown) {
  const exclusions = [];
  const uncertainties = [];
  const fences = [];
  const exclude = (start, end, kind) => exclusions.push({ start, end, kind });
  const lines = [...markdown.matchAll(/[^\n]*(?:\n|$)/g)].filter((line) => line[0].length);
  let frontmatter = null;
  if (/^---\s*(?:\r?\n|$)/.test(markdown)) {
    const closing = lines.slice(1).find((line) => /^(?:---|\.\.\.)\s*$/.test(line[0].trimEnd()));
    frontmatter = { start: 0, end: closing ? closing.index + closing[0].length : markdown.length };
    exclude(frontmatter.start, frontmatter.end, "frontmatter");
  }
  let opening = null;
  for (const line of lines) {
    if (frontmatter && line.index < frontmatter.end) continue;
    if (opening) {
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line[0]);
      if (close && close[1][0] === opening.character && close[1].length >= opening.length) {
        const end = line.index + line[0].length;
        fences.push({ ...opening, end, closed: true });
        exclude(opening.start, end, "fenced-code");
        opening = null;
      }
    } else {
      const match = /^ {0,3}(`{3,}|~{3,})([^\n]*)/.exec(line[0]);
      if (match && !(match[1][0] === "`" && match[2].includes("`")))
        opening = {
          start: line.index,
          openingEnd: line.index + line[0].trimEnd().length,
          character: match[1][0],
          length: match[1].length,
          language: match[2].trim(),
        };
    }
  }
  if (opening) {
    fences.push({ ...opening, end: markdown.length, closed: false });
    exclude(opening.start, markdown.length, "fenced-code");
  }
  // Container parsing requires a full Markdown block parser. Do not mistake
  // quote/list fences for checked prose or silently certify a partial scan.
  const containerFence = lines.find(
    (line) =>
      (!frontmatter || line.index >= frontmatter.end) &&
      !fences.some((fence) => line.index >= fence.start && line.index < fence.end) &&
      /^ {0,3}(?:>\s*|(?:[-+*]|\d+[.)])\s+)(?:>\s*)*(?:`{3,}|~{3,})/.test(line[0]),
  );
  if (containerFence) {
    uncertainties.push({
      start: containerFence.index,
      end: markdown.length,
      reason: "Container-nested fences require contextual Markdown parsing.",
    });
    exclude(containerFence.index, markdown.length, "unsupported-container-fence");
  }
  // Indented blocks after a list marker can be continuation prose, nested
  // fences, or actual code depending on the container's indentation rules.
  // Keep uncertainty local to those blocks instead of silently dropping them
  // as indented code or tainting subsequent independent top-level content.
  let listIndent = null;
  for (const line of lines) {
    if (frontmatter && line.index < frontmatter.end) continue;
    if (uncertainties.some((range) => line.index >= range.start && line.index < range.end))
      continue;
    const fence = fences.find(
      (candidate) => line.index >= candidate.start && line.index < candidate.end,
    );
    if (fence && line.index !== fence.start) continue;
    if (/^[ \t\r\n]*$/.test(line[0])) continue;
    const indentation = /^[ \t]*/.exec(line[0])[0].replaceAll("\t", "    ").length;
    const listMarker = /^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/.test(line[0]);
    if (listMarker) {
      listIndent = listIndent === null ? indentation : Math.min(listIndent, indentation);
      continue;
    }
    if (listIndent !== null && indentation > listIndent) {
      const end = fence?.end ?? line.index + line[0].length;
      uncertainties.push({
        start: line.index,
        end,
        reason:
          "Indented list continuation may be prose or a nested code block and requires contextual Markdown parsing.",
      });
      exclude(line.index, end, "unsupported-list-continuation");
    } else listIndent = null;
  }
  const mask = () => {
    const characters = markdown.split("");
    for (const { start, end } of exclusions)
      for (let index = start; index < end; index += 1)
        if (characters[index] !== "\n" && characters[index] !== "\r") characters[index] = " ";
    return characters.join("");
  };
  let visible = mask();
  // Match code spans with exactly the same delimiter length, including newlines.
  const runs = [...visible.matchAll(/`+/g)];
  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    const closing = runs.findIndex(
      (other, otherIndex) => otherIndex > index && other[0].length === run[0].length,
    );
    if (closing !== -1) {
      exclude(run.index, runs[closing].index + runs[closing][0].length, "inline-code");
      index = closing;
    }
  }
  visible = mask();
  for (const match of visible.matchAll(
    /<(script|pre|style|textarea)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
  ))
    exclude(match.index, match.index + match[0].length, "html-block");
  visible = mask();
  for (const match of visible.matchAll(
    /^ {0,3}<\/?(?:address|article|aside|blockquote|details|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|section|table|ul)\b[^\n]*[\s\S]*?(?=\n[ \t]*\r?\n|(?![\s\S]))/gim,
  ))
    exclude(match.index, match.index + match[0].length, "html-block");
  visible = mask();
  // HTML comments and paired HTML elements are excluded in full, not just tags.
  for (const match of visible.matchAll(
    /<!--[\s\S]*?(?:-->|$)|<([A-Za-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>\n]+>/g,
  ))
    exclude(match.index, match.index + match[0].length, "html");
  visible = mask();
  for (const match of visible.matchAll(
    /(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|mailto:|www\.)[^\s<>]+|\]\([^\n]*?\)|^ {0,3}\[[^\]\n]+\]:[^\n]*|\{#[^}\n]+\}\s*$/gm,
  ))
    exclude(match.index, match.index + match[0].length, "url-or-markup");
  visible = mask();
  for (const match of visible.matchAll(/^ {4}[^\n]+|^\t[^\n]+/gm))
    exclude(match.index, match.index + match[0].length, "indented-code");
  return { visible: mask(), exclusions, fences, frontmatter, uncertainties };
}

export function paragraphUnits(markdown, sections) {
  const { fences, frontmatter } = inspectMarkdown(markdown);
  const lines = [...markdown.matchAll(/[^\n]*(?:\n|$)/g)].filter((line) => line[0].length);
  const units = [];
  let start = null;
  let end = 0;
  const flush = () => {
    if (start === null) return;
    const range = sourceRange(markdown, start, end);
    const partial = sections.find(
      (candidate) =>
        candidate.sourceRange.startByte < range.endByte &&
        candidate.sourceRange.endByte > range.startByte &&
        (candidate.sourceRange.startByte > range.startByte ||
          candidate.sourceRange.endByte < range.endByte),
    );
    if (partial)
      throw new Error(
        `Section ${partial.id} selects only part of a paragraph (paragraph lines ${range.startLine}-${range.endLine}). Expand the source range to include the complete paragraph.`,
      );
    const section = sections.find(
      (candidate) =>
        candidate.sourceRange.startByte <= range.startByte &&
        candidate.sourceRange.endByte >= range.endByte,
    );
    if (section)
      units.push({
        id: `paragraph-${units.length + 1}`,
        headingPath: section.headingPath,
        ste: section.ste,
        text: markdown.slice(start, end),
        sourceRange: range,
      });
    start = null;
  };
  for (const line of lines) {
    if (frontmatter && line.index < frontmatter.end) continue;
    const fence = fences.find(
      (candidate) => line.index >= candidate.start && line.index < candidate.end,
    );
    if (fence) {
      if (line.index === fence.start) {
        flush();
        start = fence.start;
        end = fence.end;
        flush();
      }
      continue;
    }
    if (/^\s*$/.test(line[0]) || /^ {0,3}#{1,6}\s/.test(line[0])) {
      flush();
      if (/^\s*$/.test(line[0]) || /^ {0,3}#{1,6}\s/.test(line[0])) continue;
    }
    start ??= line.index;
    end = line.index + line[0].length;
  }
  flush();
  return units;
}

export function runMechanical(check, markdown, targetRange, context = {}) {
  if (check.kind.startsWith("ste-")) return runSteMechanical(check, markdown, targetRange, context);
  const { visible, exclusions, fences, uncertainties } = inspectMarkdown(markdown);
  const within = (start, end) => {
    const range = sourceRange(markdown, start, end);
    return range.startByte >= targetRange.startByte && range.endByte <= targetRange.endByte;
  };
  const findings = [];
  let applicable = false;
  if (check.kind === "fenced-code-language") {
    for (const fence of fences) {
      if (uncertainties.some((range) => fence.start < range.end && fence.end > range.start))
        continue;
      if (!within(fence.start, fence.end)) continue;
      applicable = true;
      if (!fence.closed)
        findings.push({
          defect: "unclosed-fence",
          message: "Fenced code block is unclosed, even if its language info string is present.",
          sourceRange: sourceRange(markdown, fence.start, fence.end),
        });
      else if (!fence.language)
        findings.push({
          defect: "missing-language",
          message: "Fenced code block has no language info string.",
          sourceRange: sourceRange(markdown, fence.start, fence.openingEnd),
        });
    }
  } else {
    const normalize = (term) => (check.caseSensitive ? term : term.toLowerCase());
    const prohibited = new Set(check.terms.map(normalize));
    const protectedTerms = new Set((check.protectedTerms ?? []).map(normalize));
    for (const token of visible.matchAll(/[\p{L}\p{N}_]+/gu)) {
      if (!within(token.index, token.index + token[0].length)) continue;
      applicable = true;
      if (prohibited.has(normalize(token[0])) && !protectedTerms.has(normalize(token[0])))
        findings.push({
          term: token[0],
          basis: "exact-project-restriction",
          message: `Explicitly prohibited project token: ${token[0]}`,
          sourceRange: sourceRange(markdown, token.index, token.index + token[0].length),
        });
    }
  }
  const parserWarnings = uncertainties
    .filter(({ start, end }) => {
      const range = sourceRange(markdown, start, end);
      return range.startByte < targetRange.endByte && range.endByte > targetRange.startByte;
    })
    .map(({ start, end, reason }) => ({ reason, sourceRange: sourceRange(markdown, start, end) }));
  const choice = findings.length
    ? "fail"
    : parserWarnings.length
      ? "insufficient_context"
      : applicable
        ? "pass"
        : "not_applicable";
  return {
    type: "choice",
    choice,
    confidence: 1,
    reviewRequired: parserWarnings.length > 0,
    findings,
    coverage: {
      claim:
        "Only the declared local supplemental criterion, not STE dictionary or full STE compliance.",
      parserWarnings,
      excluded: exclusions
        .filter(({ start, end }) => {
          const range = sourceRange(markdown, start, end);
          return range.startByte < targetRange.endByte && range.endByte > targetRange.startByte;
        })
        .map(({ start, end, kind }) => ({ kind, sourceRange: sourceRange(markdown, start, end) })),
    },
  };
}

function runSteMechanical(check, markdown, targetRange, context) {
  const inspection = inspectMarkdown(markdown);
  const findings = [];
  const counts = [];
  const lexicalCandidates = [];
  const parserWarnings = [];
  const overlaps = (range) =>
    range.startByte < targetRange.endByte && range.endByte > targetRange.startByte;
  const contains = (range) =>
    range.startByte >= targetRange.startByte && range.endByte <= targetRange.endByte;
  const warning = (reason, range = targetRange) =>
    parserWarnings.push({ reason, sourceRange: range });
  for (const entry of inspection.uncertainties) {
    const range = sourceRange(markdown, entry.start, entry.end);
    if (overlaps(range)) warning(entry.reason, range);
  }
  const result = (choice) => ({
    type: "choice",
    choice,
    confidence: 1,
    reviewRequired: parserWarnings.length > 0 || check.kind === "ste-dictionary-membership",
    findings,
    counts,
    lexicalCandidates,
    coverage: {
      claim:
        "Only the declared ASD-STE100 Issue 9 local criterion, not full STE compliance. Counts require declared writing mode and unambiguous section 8 word groups.",
      writingMode: context.writingMode ?? null,
      declaredWordGroups: context.wordGroups ?? [],
      parserWarnings,
      excluded: inspection.exclusions
        .map(({ start, end, kind }) => ({ kind, sourceRange: sourceRange(markdown, start, end) }))
        .filter((entry) => overlaps(entry.sourceRange)),
    },
  });
  if (["ste-sentence-length", "ste-paragraph-length"].includes(check.kind)) {
    if (!context.writingMode) {
      warning(
        "Declare document.ste.writingMode or an explicit section.ste.writingMode. Procedures, descriptions, notes and safety instructions have different applicability.",
      );
      return result("insufficient_context");
    }
    const mode = check.kind === "ste-paragraph-length" ? "descriptive" : check.writingMode;
    if (context.writingMode !== mode) return result("not_applicable");
  }
  let applicable = false;
  const paragraphs = paragraphUnits(markdown, [
    { sourceRange: sourceRange(markdown, 0, markdown.length), headingPath: [] },
  ]);
  for (const unit of paragraphs) {
    if (!overlaps(unit.sourceRange)) continue;
    if (!contains(unit.sourceRange)) {
      warning(
        "The local source range selects only part of a paragraph or sentence. Select the complete paragraph.",
        unit.sourceRange,
      );
      continue;
    }
    const start = Buffer.from(markdown).subarray(0, unit.sourceRange.startByte).toString().length;
    const end = start + unit.text.length;
    const exclusions = inspection.exclusions.filter(
      (entry) => entry.start < end && entry.end > start,
    );
    if (exclusions.some((entry) => entry.start <= start && entry.end >= end)) continue;
    const text = inspection.visible.slice(start, end);
    if (!text.trim()) continue;
    applicable = true;
    const structural = /^(?: {0,3}>| {0,3}\|| {0,3}\[| {0,3}(?:=+|-+)\s*$)/m.test(text);
    if (structural)
      warning(
        "Unsupported block quote, table, reference, or setext/container structure requires contextual parsing.",
        unit.sourceRange,
      );
    if (check.kind === "ste-punctuation") {
      // Unchangeable quoted text can be non-STE (8.6). Do not flag its punctuation.
      let prose = text.replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’/g, (match) =>
        " ".repeat(match.length),
      );
      if (/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(prose)) {
        warning(
          "HTML entities require decoding before deciding prose punctuation.",
          unit.sourceRange,
        );
        prose = prose.replace(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match) =>
          " ".repeat(match.length),
        );
      }
      for (const group of context.wordGroups ?? []) {
        if (!["quoted", "title", "proper-noun", "formula"].includes(group.category)) continue;
        prose = prose.replaceAll(group.text, " ".repeat(group.text.length));
      }
      if (/["“”‘’]/.test(prose))
        warning(
          "Unbalanced quotation marks make punctuation ownership uncertain.",
          unit.sourceRange,
        );
      for (const match of prose.matchAll(/;/g))
        findings.push({
          defect: "semicolon",
          basis: "ASD-STE100 Issue 9 rule 8.1",
          message: "STE prose does not permit a semicolon.",
          sourceRange: sourceRange(markdown, start + match.index, start + match.index + 1),
        });
      continue;
    }
    if (check.kind === "ste-dictionary-membership") {
      if (!context.vocabulary) {
        warning(
          "No trustworthy private Issue 9 vocabulary data was supplied. Dictionary membership is unavailable, not a compliance pass.",
          unit.sourceRange,
        );
        continue;
      }
      const entries = new Map();
      for (const entry of context.vocabulary.entries)
        for (const form of [entry.word, ...(entry.forms ?? [])]) {
          const key = form.toLowerCase();
          entries.set(key, [...(entries.get(key) ?? []), entry]);
        }
      const technical = context.vocabulary.technicalTerms ?? [];
      const forms = [
        ...new Set([
          ...entries.keys(),
          ...technical.map((term) => (typeof term === "string" ? term : term.text).toLowerCase()),
        ]),
      ].sort((a, b) => b.length - a.length);
      let consumed = 0;
      for (const match of text.matchAll(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu)) {
        if (match.index < consumed) continue;
        if (/^[0-9]+$/.test(match[0])) continue;
        const form = forms.find(
          (candidate) =>
            text.slice(match.index, match.index + candidate.length).toLowerCase() === candidate &&
            !/[\p{L}\p{N}_'-]/u.test(text[match.index + candidate.length] ?? ""),
        );
        const term = form ? text.slice(match.index, match.index + form.length) : match[0];
        consumed = match.index + term.length;
        const records = (form ? entries.get(form) : []) ?? [];
        const matchedTechnical = technical.filter(
          (candidate) =>
            (typeof candidate === "string" ? candidate : candidate.text).toLowerCase() ===
            term.toLowerCase(),
        );
        const technicalRecords = matchedTechnical.filter(
          (candidate) => typeof candidate === "object",
        );
        lexicalCandidates.push({
          term,
          membership: records.some((entry) => entry.approved)
            ? "approved-form"
            : records.length
              ? "not-approved-entry"
              : "unlisted",
          technicalTermCandidate: matchedTechnical.length > 0,
          technicalRecords,
          records: records.map((entry) => ({
            word: entry.word,
            approved: entry.approved,
            partOfSpeech: entry.partOfSpeech,
            meaning: entry.meaning,
            listedForms: [entry.word, ...(entry.forms ?? [])].filter(
              (listed) => listed.toLowerCase() === term.toLowerCase(),
            ),
          })),
          sourceRange: sourceRange(
            markdown,
            start + match.index,
            start + match.index + term.length,
          ),
        });
      }
      warning(
        "Literal dictionary/inflection membership candidates do not establish contextual meaning, part of speech, or permitted technical noun/verb use (rules 1.1 through 1.4).",
        unit.sourceRange,
      );
      continue;
    }
    const localWarnings = [];
    if (exclusions.length)
      localWarnings.push({
        reason:
          "Inline code, links, HTML or excluded syntax intersects a prose unit; do not count a partially masked sentence.",
        start: 0,
        end: text.length,
      });
    if (structural)
      localWarnings.push({ reason: "Unsupported prose structure.", start: 0, end: text.length });
    if (context.writingMode === "descriptive" && /^\s*(?:WARNING|CAUTION|DANGER)\s*:/m.test(text))
      localWarnings.push({
        reason:
          "Safety instructions obey the procedural 20-word limit even in descriptive material. Supply a procedural local target.",
        start: 0,
        end: text.length,
      });
    const listLines = [...text.matchAll(/^ {0,3}(?:[-+*]|\d+[.)])\s+[^\n]*(?:\n|$)/gm)];
    let analyses;
    if (listLines.length) {
      if (check.kind === "ste-paragraph-length") {
        localWarnings.push({
          reason:
            "Vertical-list word-count units are not necessarily paragraph sentences (rules 6.6 and 8.4). Paragraph parsing requires review.",
          start: 0,
          end: text.length,
        });
        analyses = [];
      } else {
        const prefix = text.slice(0, listLines[0].index);
        const validList =
          /:\s*$/.test(prefix) &&
          listLines.every(
            (line, index) =>
              !text
                .slice(line.index + line[0].length, listLines[index + 1]?.index ?? text.length)
                .trim(),
          );
        if (validList) {
          analyses = [
            { text: prefix.replace(/:(\s*)$/, ".$1"), offset: 0, fragment: false },
            ...listLines.map((line) => {
              const marker = /^ {0,3}(?:[-+*]|\d+[.)])\s+/.exec(line[0])[0];
              return {
                text: line[0].slice(marker.length),
                offset: line.index + marker.length,
                fragment: true,
              };
            }),
          ];
        } else {
          // Simple numbered work steps are separate units. Other lists need the 8.4 introduction.
          const steps =
            !prefix.trim() &&
            listLines.every((line) => /^ {0,3}\d+[.)]\s+/.test(line[0])) &&
            listLines.every(
              (line, index) =>
                !text
                  .slice(line.index + line[0].length, listLines[index + 1]?.index ?? text.length)
                  .trim(),
            );
          if (steps)
            analyses = listLines.map((line) => {
              const marker = /^ {0,3}\d+[.)]\s+/.exec(line[0])[0];
              return {
                text: line[0].slice(marker.length),
                offset: line.index + marker.length,
                fragment: false,
              };
            });
          else {
            analyses = [];
            localWarnings.push({
              reason:
                "A list without a supported colon introduction or complete numbered steps needs contextual parsing.",
              start: 0,
              end: text.length,
            });
          }
        }
      }
    } else analyses = [{ text, offset: 0, fragment: false }];
    for (const part of analyses) {
      const analysis = analyzeSteProse(
        part.text,
        { ...context, fragment: part.fragment },
        { paragraph: check.kind === "ste-paragraph-length" },
      );
      const warnings = [
        ...localWarnings,
        ...analysis.warnings.map((entry) => ({
          ...entry,
          start: entry.start + part.offset,
          end: entry.end + part.offset,
        })),
      ];
      for (const entry of warnings)
        warning(entry.reason, sourceRange(markdown, start + entry.start, start + entry.end));
      if (warnings.length) continue;
      if (check.kind === "ste-paragraph-length") {
        counts.push({
          sentenceCount: analysis.paragraphSentences,
          limit: 6,
          sourceRange: unit.sourceRange,
        });
        if (analysis.paragraphSentences > 6)
          findings.push({
            defect: "paragraph-length",
            sentenceCount: analysis.paragraphSentences,
            limit: 6,
            message: "The descriptive paragraph has more than six sentences (rule 6.6).",
            sourceRange: unit.sourceRange,
          });
      } else
        for (const sentence of analysis.sentences) {
          const limit = context.writingMode === "procedural" ? 20 : 25;
          const counted = {
            wordCount: sentence.wordCount,
            limit,
            parenthetical: sentence.parenthetical ?? false,
            sourceRange: sourceRange(
              markdown,
              start + part.offset + sentence.start,
              start + part.offset + sentence.end,
            ),
          };
          counts.push(counted);
          if (sentence.wordCount > limit)
            findings.push({
              ...counted,
              defect: "sentence-length",
              message: `The ${context.writingMode} word-count unit has more than ${limit} words (section 8 counting).`,
            });
        }
    }
    if (!analyses.length)
      for (const entry of localWarnings) warning(entry.reason, unit.sourceRange);
  }
  return result(
    findings.length
      ? "fail"
      : parserWarnings.length
        ? "insufficient_context"
        : applicable
          ? "pass"
          : "not_applicable",
  );
}
