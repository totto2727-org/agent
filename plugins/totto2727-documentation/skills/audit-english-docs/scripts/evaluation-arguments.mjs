import { EvaluationError } from "./evaluation-validation.mjs";
import { matchesUndefined } from "./native-predicates.mjs";

/** @typedef {"--concurrency" | "--manifest" | "--output"} ValueFlag */
/** @typedef {{ concurrency: number | string, dryRun: boolean, manifest?: string, mechanicalOnly: boolean, output?: string }} CLIOptions */

/** @typedef {{ pending?: ValueFlag }} ParseState */

const defaultConcurrency = 4;
const minimumConcurrency = 1;
const maximumConcurrency = 32;

/** @type {(options: CLIOptions, flag: ValueFlag, value: string) => void} */
const setArgumentValue = (options, flag, value) => {
  if (!value) {
    throw new EvaluationError(`Missing value for ${flag}`);
  }
  if (flag === "--manifest") {
    options.manifest = value;
  } else if (flag === "--output") {
    options.output = value;
  } else {
    options.concurrency = value;
  }
};

/** @type {(argument: string, options: CLIOptions, state: ParseState) => void} */
const parseFlag = (argument, options, state) => {
  const { pending } = state;
  if (!matchesUndefined(pending)) {
    setArgumentValue(options, pending, argument);
    delete state.pending;
    return;
  }
  if (argument === "--dry-run") {
    options.dryRun = true;
  } else if (argument === "--mechanical-only") {
    options.mechanicalOnly = true;
  } else if (argument === "--manifest" || argument === "--output" || argument === "--concurrency") {
    state.pending = argument;
  } else {
    throw new EvaluationError(`Unknown argument: ${argument}`);
  }
};

/** @type {(value: number | string) => number} */
const parseConcurrency = (value) => {
  const concurrency = Number(value);
  if (
    !Number.isInteger(concurrency) ||
    concurrency < minimumConcurrency ||
    concurrency > maximumConcurrency
  ) {
    throw new EvaluationError("--concurrency must be an integer from 1 through 32");
  }
  return concurrency;
};

/** @type {(argv: string[]) => CLIOptions & { concurrency: number, manifest: string, output: string }} */
export const parseArguments = (argv) => {
  /** @type {CLIOptions} */
  const options = { concurrency: defaultConcurrency, dryRun: false, mechanicalOnly: false };
  /** @type {ParseState} */
  const state = {};
  // oxlint-disable-next-line unicorn/prefer-spread -- Snapshot array-like inputs as well as ordinary CLI argument arrays.
  Array.from(argv).forEach((argument) => {
    parseFlag(argument, options, state);
  });
  if (!matchesUndefined(state.pending)) {
    throw new EvaluationError(`Missing value for ${state.pending}`);
  }
  const manifest = options.manifest ?? "";
  const output = options.output ?? "";
  if (!manifest || !output) {
    throw new EvaluationError("--manifest and --output are required");
  }
  return { ...options, concurrency: parseConcurrency(options.concurrency), manifest, output };
};
