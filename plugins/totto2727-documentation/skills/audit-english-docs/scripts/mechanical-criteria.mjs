import { isRecord, matchesBoolean, matchesString, matchesUndefined } from "./native-predicates.mjs";

/** @typedef {"ste-dictionary-membership" | "ste-paragraph-length" | "ste-punctuation"} StaticSteKind */
/** @typedef {{ kind: StaticSteKind } | { kind: "ste-sentence-length", writingMode: "procedural" | "descriptive" }} SteCheck */
/** @typedef {{ caseSensitive?: boolean, kind: "prohibited-terms", protectedTerms?: string[], terms: string[] }} ProhibitedTerms */
/** @typedef {SteCheck | { kind: "fenced-code-language" } | ProhibitedTerms} MechanicalCheck */
/** @typedef {(message: string) => never} Reject */

const MAX_TERMS = 1000;
const MAX_TERM_LENGTH = 128;
const LITERAL_TERM = /^[\p{L}\p{N}_]+$/u;
const INVALID_TERMS = undefined;

/** @type {Record<string, string[]>} */
const allowedParameters = {
  "fenced-code-language": ["kind"],
  "prohibited-terms": ["kind", "terms", "caseSensitive", "protectedTerms"],
  "ste-dictionary-membership": ["kind"],
  "ste-paragraph-length": ["kind"],
  "ste-punctuation": ["kind"],
  "ste-sentence-length": ["kind", "writingMode"],
};

/** @type {(value: unknown, allowEmpty: boolean) => string[] | undefined} */
const literalTerms = (value, allowEmpty) => {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.length > MAX_TERMS) {
    return INVALID_TERMS;
  }
  /** @type {unknown[]} */
  const terms = value;
  if (
    !terms.every((term) => matchesString(term)) ||
    terms.some((term) => term.length > MAX_TERM_LENGTH || !LITERAL_TERM.test(term))
  ) {
    return INVALID_TERMS;
  }
  return terms;
};

/** @type {(check: Record<string, unknown>, key: string) => unknown} */
const parameter = (check, key) => (key in check ? check[key] : undefined);

/** @type {(check: Record<string, unknown>, reject: Reject) => "procedural" | "descriptive"} */
const writingModeFor = (check, reject) => {
  const writingMode = parameter(check, "writingMode");
  if (writingMode !== "procedural" && writingMode !== "descriptive") {
    return reject("writingMode must be procedural or descriptive");
  }
  return writingMode;
};

/** @type {(check: Record<string, unknown>, reject: Reject) => string[]} */
const protectedTermsFor = (check, reject) => {
  const protectedInput = parameter(check, "protectedTerms");
  const protectedTerms = matchesUndefined(protectedInput) ? [] : literalTerms(protectedInput, true);
  if (matchesUndefined(protectedTerms)) {
    return reject(
      "protectedTerms must be an array of literal whole tokens (at most 1000 tokens, 128 characters each)",
    );
  }
  return protectedTerms;
};

/** @type {(check: Record<string, unknown>, reject: Reject) => ProhibitedTerms} */
const prohibitedTermsFor = (check, reject) => {
  const terms = literalTerms(parameter(check, "terms"), false);
  if (matchesUndefined(terms)) {
    return reject(
      "terms must contain 1 through 1000 literal whole tokens (at most 128 characters each)",
    );
  }
  const caseSensitive = parameter(check, "caseSensitive");
  if (!matchesUndefined(caseSensitive) && !matchesBoolean(caseSensitive)) {
    return reject("caseSensitive must be boolean");
  }
  const protectedTerms = protectedTermsFor(check, reject);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the established serialized mechanical check property order.
  return {
    kind: "prohibited-terms",
    terms: [...new Set(terms)],
    protectedTerms: [...new Set(protectedTerms)],
    caseSensitive: caseSensitive ?? false,
  };
};

/** @type {(check: Record<string, unknown>, reject: Reject) => string} */
const checkedKind = (check, reject) => {
  const kind = parameter(check, "kind");
  if (!matchesString(kind) || !Object.hasOwn(allowedParameters, kind)) {
    return reject("unsupported mechanical kind");
  }
  const allowed = allowedParameters[kind];
  if (Object.keys(check).some((key) => !allowed.includes(key))) {
    return reject("unexpected parameter");
  }
  return kind;
};

/** @type {(check: Record<string, unknown>, reject: Reject) => MechanicalCheck} */
const parseCheck = (check, reject) => {
  const kind = checkedKind(check, reject);
  switch (kind) {
    case "ste-sentence-length": {
      return { kind, writingMode: writingModeFor(check, reject) };
    }
    case "prohibited-terms": {
      return prohibitedTermsFor(check, reject);
    }
    case "fenced-code-language":
    case "ste-dictionary-membership":
    case "ste-paragraph-length":
    case "ste-punctuation": {
      return { kind };
    }
    default: {
      return reject("unsupported mechanical kind");
    }
  }
};

// Keep the criteria local and bounded. The manifest accepts literal restrictions only.
/**
 * Checks that a mechanical criterion has exactly the supported parameters.
 * @param {unknown} check - The manifest's mechanical criterion.
 * @param {string} label - Its location in the manifest.
 * @param {new (message: string) => Error} [ErrorType] - The caller's validation error constructor.
 * @returns {MechanicalCheck} A check restricted to the supported parameters.
 */
export const validateMechanicalCheck = function validateMechanicalCheck(
  check,
  label,
  ErrorType = Error,
) {
  /** @type {Reject} */
  const reject = (message) => {
    throw new ErrorType(`${label}: ${message}`);
  };
  if (!isRecord(check)) {
    return reject("must be an object");
  }
  return parseCheck(check, reject);
};
