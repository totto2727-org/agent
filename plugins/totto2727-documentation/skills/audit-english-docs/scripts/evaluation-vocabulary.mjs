// oxlint-disable-next-line rules/no-node-imports -- The standalone skill reads the user-declared private vocabulary from disk.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the vocabulary path according to the host filesystem.
import nodePath from "node:path";

import { EvaluationError } from "./evaluation-validation.mjs";
import { matchesUndefined } from "./native-predicates.mjs";
import { validateSteVocabulary } from "./ste.mjs";

/** @typedef {import("./ste.mjs").SteContext} SteContext */
/** @typedef {import("./ste.mjs").Vocabulary} Vocabulary */
/** @typedef {SteContext & { vocabulary?: Vocabulary }} LocalSteContext */

const MAXIMUM_VOCABULARY_MIB = 8;
const BYTES_PER_KIBIBYTE = 1024;
const MAXIMUM_VOCABULARY_BYTES = MAXIMUM_VOCABULARY_MIB * BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
const MISSING_VOCABULARY = undefined;

/** @type {(error: unknown) => boolean} */
const isMissingVocabularyFile = (error) =>
  // oxlint-disable-next-line rules/no-instanceof-error -- Recognize only the standard Node file-not-found error so other filesystem faults still fail the run.
  error instanceof Error && "code" in error && error.code === "ENOENT";

/** @type {(path: string) => Promise<Vocabulary | undefined>} */
const loadVocabulary = async (path) => {
  try {
    const source = await readFile(path, "utf8");
    if (Buffer.byteLength(source) > MAXIMUM_VOCABULARY_BYTES) {
      throw new EvaluationError("Private STE vocabulary exceeds 8 MiB");
    }
    return validateSteVocabulary(JSON.parse(source), "STE vocabulary", EvaluationError);
  } catch (error) {
    if (isMissingVocabularyFile(error)) {
      return MISSING_VOCABULARY;
    }
    throw error;
  }
};

/** @type {(base: string) => (context: SteContext) => Promise<LocalSteContext>} */
export const vocabularyLoader = (base) => {
  /** @type {Map<string, Vocabulary>} */
  const vocabularies = new Map();
  return async (context) => {
    const ste = { ...context };
    const filename = ste.vocabularyFile;
    if (matchesUndefined(filename) || !filename.length) {
      return ste;
    }
    const path = nodePath.resolve(base, filename);
    const vocabulary = vocabularies.get(path) ?? (await loadVocabulary(path));
    if (matchesUndefined(vocabulary)) {
      return ste;
    }
    vocabularies.set(path, vocabulary);
    return { ...ste, vocabulary };
  };
};
