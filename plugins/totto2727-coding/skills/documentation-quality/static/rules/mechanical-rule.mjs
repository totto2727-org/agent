import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { runMechanical, sourceRange, validateMechanicalCheck } from "../../scripts/mechanical.mjs";
import { validateSteContext, validateSteVocabulary } from "../../scripts/ste.mjs";

function validateOptions(options, check) {
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw new Error("Mechanical textlint options must be an object.");
  if (Object.keys(options).some((key) => !["check", "ste", "sections"].includes(key)))
    throw new Error("Unknown mechanical textlint option.");
  const selectedCheck = validateMechanicalCheck(options.check ?? check, "textlint check");
  if (selectedCheck.kind !== check.kind || selectedCheck.writingMode !== check.writingMode)
    throw new Error("A catalog rule cannot change its mechanical kind or writing mode.");
  const ste = validateSteContext(options.ste, "textlint ste") ?? {};
  const sections = options.sections ?? [];
  if (!Array.isArray(sections)) throw new Error("sections must be an array.");
  let previousEnd = 0;
  for (const section of sections) {
    if (
      !section ||
      typeof section !== "object" ||
      Array.isArray(section) ||
      Object.keys(section).some((key) => !["startLine", "endLine", "ste"].includes(key)) ||
      !Number.isSafeInteger(section.startLine) ||
      !Number.isSafeInteger(section.endLine) ||
      section.startLine <= previousEnd ||
      section.endLine < section.startLine
    )
      throw new Error("sections must be ordered, non-overlapping inclusive positive line ranges.");
    validateSteContext(section.ste, "textlint section ste");
    previousEnd = section.endLine;
  }
  for (const context of [ste, ...sections.map((section) => section.ste ?? {})])
    if (context.vocabularyFile && !isAbsolute(context.vocabularyFile))
      throw new Error("ste.vocabularyFile must be an absolute local path.");
  return { check: selectedCheck, ste, sections };
}

function targets(source, options) {
  const starts = [0, ...[...source.matchAll(/\n/g)].map((match) => match.index + 1)];
  const result = [];
  let at = 0;
  const add = (start, end, ste) => {
    if (end > start) result.push({ range: sourceRange(source, start, end), ste });
  };
  for (const section of options.sections) {
    if (section.endLine > starts.length) throw new Error("A section exceeds the Markdown source.");
    const start = starts[section.startLine - 1];
    const end = starts[section.endLine] ?? source.length;
    add(at, start, options.ste);
    add(start, end, { ...options.ste, ...section.ste });
    at = end;
  }
  add(at, source.length, options.ste);
  return result;
}

// The Markdown processor supplies the original document. Keep source bytes,
// not flattened Str nodes: STE counting and exclusions belong to mechanical.mjs.
export function createMechanicalRule(check) {
  const validatedCheck = validateMechanicalCheck(check, "mechanical rule");
  return function mechanicalRule(context, options = {}) {
    const selected = validateOptions(options, validatedCheck);
    return {
      [context.Syntax.Document](node) {
        const source = context.getSource(node);
        const reported = new Set();
        const report = (message, range, reviewRequired = false) => {
          const key = JSON.stringify([message, range, reviewRequired]);
          if (reported.has(key)) return;
          reported.add(key);
          // Mechanical ranges use UTF-8 bytes. textlint locators use UTF-16.
          const index = Buffer.from(source).subarray(0, range.startByte).toString("utf8").length;
          context.report(
            node,
            new context.RuleError(`${reviewRequired ? "review-required: " : ""}${message}`, {
              index,
            }),
          );
        };
        const vocabularies = new Map();
        // Fence language is page-scoped and has no STE context. A contextual
        // section boundary must not split a fence out of both selected ranges.
        const selectedTargets =
          selected.check.kind === "fenced-code-language"
            ? [{ range: sourceRange(source, 0, source.length), ste: {} }]
            : targets(source, selected);
        for (const target of selectedTargets) {
          const ste = { ...target.ste };
          if (selected.check.kind === "ste-dictionary-membership" && ste.vocabularyFile) {
            if (!vocabularies.has(ste.vocabularyFile)) {
              let vocabulary;
              try {
                vocabulary = validateSteVocabulary(
                  JSON.parse(readFileSync(ste.vocabularyFile, "utf8")),
                  "textlint vocabulary",
                );
              } catch (error) {
                if (error.code !== "ENOENT") throw error;
                report("The declared private vocabulary file is unavailable.", target.range, true);
              }
              vocabularies.set(ste.vocabularyFile, vocabulary);
            }
            ste.vocabulary = vocabularies.get(ste.vocabularyFile);
          }
          const result = runMechanical(selected.check, source, target.range, ste);
          for (const finding of result.findings) report(finding.message, finding.sourceRange);
          for (const warning of result.coverage.parserWarnings)
            report(warning.reason, warning.sourceRange, true);
          // Future evidence adapters must not silently convert unresolved states
          // to a zero-diagnostic textlint result merely by omitting warnings.
          if (
            (result.reviewRequired || result.choice === "insufficient_context") &&
            result.coverage.parserWarnings.length === 0
          )
            report(
              "Mechanical evidence is incomplete and needs contextual review.",
              target.range,
              true,
            );
        }
      },
    };
  };
}
