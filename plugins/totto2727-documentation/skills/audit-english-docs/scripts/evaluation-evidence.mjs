import { MAX_EVIDENCE_BYTES } from "./evaluation-validation.mjs";
import { nounGroupCounts, runMechanical } from "./mechanical.mjs";

/** @typedef {import("./evaluation-vocabulary.mjs").LocalSteContext} LocalSteContext */
/** @typedef {import("./mechanical.mjs").SourceRange} SourceRange */
/** @typedef {import("./mechanical.mjs").LexicalCandidate} LexicalCandidate */
/** @typedef {import("./mechanical.mjs").SteResult} SteResult */
/** @typedef {{ candidates: LexicalCandidate[], completeness: string, issue: number, source: string }} LocalDictionaryEvidence */
/** @typedef {LocalDictionaryEvidence | { issue: number, unavailable: string } | null} DictionaryEvidence */
/** @typedef {ReturnType<typeof nounGroupCounts<import("./ste.mjs").DeclaredNounGroup>> | Array<{ reason: string, status: "insufficient_context" }>} NounEvidence */
/** @typedef {{ complete: boolean, evidence: DictionaryEvidence, hasMatches: boolean }} DictionaryState */
/** @typedef {{ complete: boolean, evidence: NounEvidence, hasMatches: boolean }} NounState */

const STE_ISSUE = 9;
const EMPTY_LENGTH = 0;
// oxlint-disable-next-line unicorn/no-null -- Reports use JSON null when no private vocabulary was available.
const NO_DICTIONARY_EVIDENCE = null;

/** @type {(candidate: LexicalCandidate) => boolean} */
const hasListedRecord = (candidate) =>
  candidate.records.length > EMPTY_LENGTH || candidate.technicalRecords.length > EMPTY_LENGTH;

/** @type {(result: SteResult, source: string) => DictionaryState} */
const dictionaryState = (result, source) => {
  const { lexicalCandidates, coverage } = result;
  // oxlint-disable-next-line eslint/sort-keys -- Keep the selected evidence in the established cache and report key order.
  const evidence = {
    issue: STE_ISSUE,
    source,
    completeness:
      "Selected literal matches only, not a closed dictionary or a contextual compliance decision.",
    candidates: lexicalCandidates,
  };
  if (Buffer.byteLength(JSON.stringify(evidence)) > MAX_EVIDENCE_BYTES) {
    return {
      complete: false,
      evidence: {
        issue: STE_ISSUE,
        unavailable:
          "Selected local dictionary evidence exceeds the bounded evidence limit. Abstain on dictionary-dependent judgments.",
      },
      hasMatches: false,
    };
  }
  const hasMatches = lexicalCandidates.some((candidate) => hasListedRecord(candidate));
  const complete =
    lexicalCandidates.length > EMPTY_LENGTH &&
    lexicalCandidates.every((candidate) => hasListedRecord(candidate)) &&
    coverage.parserWarnings.every((warning) =>
      warning.reason.startsWith("Literal dictionary/inflection membership"),
    );
  return { complete, evidence, hasMatches };
};

/** @type {(page: string, target: SourceRange, ste: LocalSteContext) => DictionaryState} */
export const dictionaryEvidenceFor = (page, target, ste) => {
  if (!ste.vocabulary) {
    return { complete: false, evidence: NO_DICTIONARY_EVIDENCE, hasMatches: false };
  }
  /** @type {SteResult} */
  const result = runMechanical({ kind: "ste-dictionary-membership" }, page, target, ste);
  return dictionaryState(result, ste.vocabulary.source);
};

/** @type {(page: string, target: SourceRange, ste: LocalSteContext) => NounState} */
export const nounEvidenceFor = (page, target, ste) => {
  const evidence = nounGroupCounts(page, target, ste.nounGroups);
  if (Buffer.byteLength(JSON.stringify(evidence)) > MAX_EVIDENCE_BYTES) {
    return {
      complete: false,
      evidence: [
        // oxlint-disable-next-line eslint/sort-keys -- Keep existing noun evidence field order in reports.
        {
          status: "insufficient_context",
          reason: "Selected noun-group counts exceed the evidence limit.",
        },
      ],
      hasMatches: false,
    };
  }
  const hasMatches = evidence.some((entry) => entry.status === "counted");
  return {
    complete: hasMatches && evidence.every((entry) => entry.status === "counted"),
    evidence,
    hasMatches,
  };
};
