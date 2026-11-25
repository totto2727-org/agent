import { runLocalMechanical } from "./mechanical-local.mjs";
import { paragraphUnits } from "./mechanical-paragraphs.mjs";
import { inspectMarkdown } from "./mechanical-source.mjs";
import { sourceRange } from "./mechanical-source-range.mjs";
import { analyzeSteProse } from "./ste.mjs";
import { hasObjectType, matchesNull, matchesString } from "./native-predicates.mjs";

export { validateMechanicalCheck } from "./mechanical-criteria.mjs";
export { sourceRange } from "./mechanical-source-range.mjs";
export { inspectMarkdown } from "./mechanical-source.mjs";
export { nounGroupCounts } from "./mechanical-nouns.mjs";
export { paragraphUnits } from "./mechanical-paragraphs.mjs";

/** @typedef {import("./mechanical-source-range.mjs").SourceRange} SourceRange */
/** @typedef {import("./mechanical-source.mjs").TextRange} TextRange */
/** @typedef {import("./mechanical-source.mjs").FenceOpening} FenceOpening */
/** @typedef {import("./mechanical-source.mjs").Fence} Fence */
/** @typedef {import("./mechanical-source.mjs").Exclusion} Exclusion */
/** @typedef {import("./mechanical-source.mjs").Uncertainty} Uncertainty */
/** @typedef {import("./mechanical-source.mjs").RecordExclusion} RecordExclusion */
/** @typedef {import("./mechanical-nouns.mjs").NounGroupEvidence} NounGroupEvidence */
/** @typedef {import("./mechanical-criteria.mjs").SteCheck} SteCheck */
/** @typedef {import("./mechanical-criteria.mjs").MechanicalCheck} MechanicalCheck */
/** @typedef {import("./ste.mjs").VocabularyEntry} VocabularyEntry */
/** @typedef {import("./ste.mjs").TechnicalTerm} TechnicalTerm */
/** @typedef {Pick<import("./ste.mjs").Vocabulary, "entries" | "technicalTerms">} Vocabulary */
/** @typedef {import("./ste.mjs").ProseContext & { vocabulary?: Vocabulary }} MechanicalContext */
/** @typedef {"fail" | "insufficient_context" | "not_applicable" | "pass"} Choice */
/** @typedef {{ reason: string, sourceRange: SourceRange }} ParserWarning */
/** @typedef {{ claim: string, excluded: Array<{ kind: string, sourceRange: SourceRange }>, parserWarnings: ParserWarning[] }} Coverage */
/** @typedef {{ limit: number, parenthetical?: boolean, sentenceCount?: number, sourceRange: SourceRange, wordCount?: number }} ProseCount */
/** @typedef {{ basis?: string, defect?: string, limit?: number, message: string, parenthetical?: boolean, sentenceCount?: number, sourceRange: SourceRange, term?: string, wordCount?: number }} Finding */
/** @typedef {{ membership: "approved-form" | "not-approved-entry" | "unlisted", records: Array<Omit<VocabularyEntry, "forms"> & { listedForms: string[] }>, sourceRange: SourceRange, technicalRecords: TechnicalTerm[], technicalTermCandidate: boolean, term: string }} LexicalCandidate */
/** @typedef {{ choice: Choice, confidence: number, coverage: Coverage, findings: Finding[], reviewRequired: boolean, type: "choice" }} MechanicalResult */
/** @typedef {MechanicalResult & { counts: ProseCount[], coverage: Coverage & { declaredWordGroups: import("./ste.mjs").DeclaredWordGroup[], writingMode: MechanicalContext["writingMode"] | null }, lexicalCandidates: LexicalCandidate[] }} SteResult */
/**
 * @template Context
 * @typedef {import("./mechanical-paragraphs.mjs").Paragraph<Context>} Paragraph
 */

/**
 * @param {SteCheck} check - The selected mechanical criterion.
 * @param {string} markdown - The source document.
 * @param {SourceRange} targetRange - The complete range to check.
 * @param {MechanicalContext} context - The declared language context.
 * @returns {SteResult} The result and evidence for one STE criterion.
 */
const runSteMechanical = function runSteMechanical(check, markdown, targetRange, context) {
  const inspection = inspectMarkdown(markdown);
  /** @type {Finding[]} */
  const findings = [];
  /** @type {ProseCount[]} */
  const counts = [];
  /** @type {LexicalCandidate[]} */
  const lexicalCandidates = [];
  /** @type {ParserWarning[]} */
  const parserWarnings = [];
  /** @type {(range: SourceRange) => boolean} */
  const overlaps = (range) =>
    range.startByte < targetRange.endByte && range.endByte > targetRange.startByte;
  /** @type {(range: SourceRange) => boolean} */
  const contains = (range) =>
    range.startByte >= targetRange.startByte && range.endByte <= targetRange.endByte;
  /** @type {(reason: string, range?: SourceRange) => void} */
  const warning = (reason, range = targetRange) => {
    parserWarnings.push({ reason, sourceRange: range });
  };
  Iterator.from(inspection.uncertainties).forEach((entry) => {
    const range = sourceRange(markdown, entry.start, entry.end);
    if (overlaps(range)) {
      warning(entry.reason, range);
    }
  });
  /** @type {(choice: Choice) => SteResult} */
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
  if (check.kind === "ste-sentence-length" || check.kind === "ste-paragraph-length") {
    if (!context.writingMode) {
      warning(
        "Declare document.ste.writingMode or an explicit section.ste.writingMode. Procedures, descriptions, notes and safety instructions have different applicability.",
      );
      return result("insufficient_context");
    }
    const mode = check.kind === "ste-sentence-length" ? check.writingMode : "descriptive";
    if (context.writingMode !== mode) {
      return result("not_applicable");
    }
  }
  let applicable = false;
  const paragraphs = paragraphUnits(markdown, [
    { sourceRange: sourceRange(markdown, 0, markdown.length), headingPath: [] },
  ]);
  for (const unit of paragraphs) {
    if (!overlaps(unit.sourceRange)) {
      continue;
    }
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
    if (exclusions.some((entry) => entry.start <= start && entry.end >= end)) {
      continue;
    }
    const text = inspection.visible.slice(start, end);
    if (!text.trim()) {
      continue;
    }
    applicable = true;
    const structural = /^(?: {0,3}>| {0,3}\|| {0,3}\[| {0,3}(?:=+|-+)\s*$)/mu.test(text);
    if (structural) {
      warning(
        "Unsupported block quote, table, reference, or setext/container structure requires contextual parsing.",
        unit.sourceRange,
      );
    }
    if (check.kind === "ste-punctuation") {
      // Unchangeable quoted text can be non-STE (8.6). Do not flag its punctuation.
      let prose = text.replaceAll(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’/g, (match) =>
        " ".repeat(match.length),
      );
      if (/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(prose)) {
        warning(
          "HTML entities require decoding before deciding prose punctuation.",
          unit.sourceRange,
        );
        prose = prose.replaceAll(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match) =>
          " ".repeat(match.length),
        );
      }
      Iterator.from(context.wordGroups ?? []).forEach((group) => {
        if (!["quoted", "title", "proper-noun", "formula"].includes(group.category)) {
          return;
        }
        prose = prose.replaceAll(group.text, " ".repeat(group.text.length));
      });
      if (/["“”‘’]/.test(prose)) {
        warning(
          "Unbalanced quotation marks make punctuation ownership uncertain.",
          unit.sourceRange,
        );
      }
      Iterator.from(prose.matchAll(/;/gu)).forEach((match) => {
        findings.push({
          defect: "semicolon",
          basis: "ASD-STE100 Issue 9 rule 8.1",
          message: "STE prose does not permit a semicolon.",
          sourceRange: sourceRange(markdown, start + match.index, start + match.index + 1),
        });
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
      /** @type {Map<string, VocabularyEntry[]>} */
      const entries = new Map();
      Iterator.from(context.vocabulary.entries).forEach((entry) => {
        for (const form of [entry.word, ...(entry.forms ?? [])]) {
          const key = form.toLowerCase();
          entries.set(key, [...(entries.get(key) ?? []), entry]);
        }
      });
      const technical = context.vocabulary.technicalTerms ?? [];
      const forms = [
        ...new Set([
          ...entries.keys(),
          ...technical.map((term) => (matchesString(term) ? term : term.text).toLowerCase()),
        ]),
      ].sort((left, right) => right.length - left.length);
      let consumed = 0;
      Iterator.from(text.matchAll(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu)).forEach((match) => {
        if (match.index < consumed) {
          return;
        }
        if (/^[0-9]+$/u.test(match[0])) {
          return;
        }
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
            (matchesString(candidate) ? candidate : candidate.text).toLowerCase() ===
            term.toLowerCase(),
        );
        const technicalRecords = matchedTechnical.filter((candidate) => hasObjectType(candidate));
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
      });
      warning(
        "Literal dictionary/inflection membership candidates do not establish contextual meaning, part of speech, or permitted technical noun/verb use (rules 1.1 through 1.4).",
        unit.sourceRange,
      );
      continue;
    }
    const localWarnings = [];
    if (exclusions.length) {
      localWarnings.push({
        reason:
          "Inline code, links, HTML or excluded syntax intersects a prose unit; do not count a partially masked sentence.",
        start: 0,
        end: text.length,
      });
    }
    if (structural) {
      localWarnings.push({ reason: "Unsupported prose structure.", start: 0, end: text.length });
    }
    if (
      context.writingMode === "descriptive" &&
      /^\s*(?:WARNING|CAUTION|DANGER)\s*:/mu.test(text)
    ) {
      localWarnings.push({
        reason:
          "Safety instructions obey the procedural 20-word limit even in descriptive material. Supply a procedural local target.",
        start: 0,
        end: text.length,
      });
    }
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
          /:\s*$/u.test(prefix) &&
          listLines.every(
            (line, index) =>
              !text
                .slice(line.index + line[0].length, listLines[index + 1]?.index ?? text.length)
                .trim(),
          );
        if (validList) {
          analyses = [
            { text: prefix.replace(/:(\s*)$/u, ".$1"), offset: 0, fragment: false },
            ...listLines.map((line) => {
              const marker = /^ {0,3}(?:[-+*]|\d+[.)])\s+/u.exec(line[0])[0];
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
            listLines.every((line) => /^ {0,3}\d+[.)]\s+/u.test(line[0])) &&
            listLines.every(
              (line, index) =>
                !text
                  .slice(line.index + line[0].length, listLines[index + 1]?.index ?? text.length)
                  .trim(),
            );
          if (steps) {
            analyses = listLines.map((line) => {
              const marker = /^ {0,3}\d+[.)]\s+/u.exec(line[0])[0];
              return {
                text: line[0].slice(marker.length),
                offset: line.index + marker.length,
                fragment: false,
              };
            });
          } else {
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
    } else {
      analyses = [{ text, offset: 0, fragment: false }];
    }
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
      Iterator.from(warnings).forEach((entry) => {
        warning(entry.reason, sourceRange(markdown, start + entry.start, start + entry.end));
      });
      if (warnings.length) {
        continue;
      }
      if (check.kind === "ste-paragraph-length") {
        counts.push({
          sentenceCount: analysis.paragraphSentences,
          limit: 6,
          sourceRange: unit.sourceRange,
        });
        if (analysis.paragraphSentences > 6) {
          findings.push({
            defect: "paragraph-length",
            sentenceCount: analysis.paragraphSentences,
            limit: 6,
            message: "The descriptive paragraph has more than six sentences (rule 6.6).",
            sourceRange: unit.sourceRange,
          });
        }
      } else {
        Iterator.from(analysis.sentences).forEach((sentence) => {
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
          if (sentence.wordCount > limit) {
            findings.push({
              ...counted,
              defect: "sentence-length",
              message: `The ${context.writingMode} word-count unit has more than ${limit} words (section 8 counting).`,
            });
          }
        });
      }
    }
    if (!analyses.length) {
      Iterator.from(localWarnings).forEach((entry) => {
        warning(entry.reason, unit.sourceRange);
      });
    }
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
};

/**
 * @overload
 * @param {SteCheck} check - The selected STE criterion.
 * @param {string} markdown - The source document.
 * @param {SourceRange} targetRange - The complete range to check.
 * @param {MechanicalContext} [context] - The declared language context.
 * @returns {SteResult} The result and STE evidence.
 */
/**
 * @overload
 * @param {MechanicalCheck} check - The selected mechanical criterion.
 * @param {string} markdown - The source document.
 * @param {SourceRange} targetRange - The complete range to check.
 * @param {MechanicalContext} [context] - The declared language context.
 * @returns {MechanicalResult | SteResult} The result and collected evidence.
 */
/**
 * @param {MechanicalCheck} check - The selected mechanical criterion.
 * @param {string} markdown - The source document.
 * @param {SourceRange} targetRange - The complete range to check.
 * @param {MechanicalContext} [context] - The declared language context.
 * @returns {MechanicalResult | SteResult} The result and collected evidence.
 */
export const runMechanical = function runMechanical(check, markdown, targetRange, context = {}) {
  if (check.kind !== "fenced-code-language" && check.kind !== "prohibited-terms") {
    return runSteMechanical(check, markdown, targetRange, context);
  }
  return runLocalMechanical(check, markdown, targetRange);
};
