#!/usr/bin/env node

// oxlint-disable-next-line rules/no-node-imports -- Resolve output paths from the standalone CLI's working directory.
import nodePath from "node:path";

import { EvaluationError, failureMessage } from "./evaluation-validation.mjs";

import { requestsFor } from "./evaluation-batch.mjs";
import { executeTarget } from "./evaluation-execution.mjs";
import { loadManifest, parseArguments } from "./evaluation-manifest.mjs";
import { reportFor, writeReport } from "./evaluation-report.mjs";
import { pooled } from "./evaluation-scheduler.mjs";
import { buildWork } from "./evaluation-work.mjs";

export {
  CACHE_KEY_PREFIX,
  CACHE_SKIP,
  CACHE_TTL_SECONDS,
  cacheFingerprint,
  canonicalJson,
  endpointFor,
  isNativeModel,
  parseCacheStatus,
  parseTraceId,
  payloadFor,
  readCredentials,
  TransportFailure,
} from "./evaluation-transport.mjs";
export { EvaluationError } from "./evaluation-validation.mjs";
export { loadManifest, MODELS, parseArguments, validateManifest } from "./evaluation-manifest.mjs";
export { buildWork, segmentMarkdown } from "./evaluation-work.mjs";

export { validateResponse } from "./evaluation-response.mjs";

/** @typedef {{ concurrency?: number, dryRun?: boolean, environment?: Record<string, string | undefined>, manifestPath: string, mechanicalOnly?: boolean, outputPath: string }} EvaluationOptions */

const defaultConcurrency = 4;
const minimumConcurrency = 1;
const maximumConcurrency = 32;
const ENTRY_SCRIPT = 1;
const FIRST_CLI_ARGUMENT = 2;
const ATTENTION_EXIT = 1;
const INVALID_INPUT_EXIT = 2;

/** @typedef {import("./evaluation-execution.mjs").ExecutionOutcome} ExecutionOutcome */
/** @typedef {ReturnType<typeof reportFor<ExecutionOutcome>>} EvaluationReport */

/**
 * Runs the audit and writes its public report.
 * @param {EvaluationOptions} options - Inputs and execution settings for one audit run.
 * @returns {Promise<EvaluationReport>} The report written to the output path.
 */
export const evaluate = async ({
  manifestPath,
  outputPath,
  concurrency = defaultConcurrency,
  dryRun = false,
  mechanicalOnly = false,
  // oxlint-disable-next-line node/no-process-env -- The CLI reads user-configured Gateway credentials from the host environment by default.
  environment = process.env,
}) => {
  if (
    !Number.isInteger(concurrency) ||
    concurrency < minimumConcurrency ||
    concurrency > maximumConcurrency
  ) {
    throw new EvaluationError("concurrency must be an integer from 1 through 32");
  }
  const manifest = await loadManifest(manifestPath, { mechanicalOnly });
  const work = await buildWork(manifest, manifestPath);
  const batch = requestsFor(work, {
    dryRun,
    environment,
    mechanicalOnly,
    model: manifest.model,
  });
  const evaluated = await pooled(
    work,
    concurrency,
    executeTarget(manifest, { dryRun, mechanicalOnly }, batch),
  );
  const report = reportFor(
    { evaluated, manifest, metrics: batch.metrics, work },
    { concurrency, dryRun, mechanicalOnly },
  );
  await writeReport(outputPath, report);
  return report;
};

const main = async function () {
  try {
    const options = parseArguments(process.argv.slice(FIRST_CLI_ARGUMENT));
    const report = await evaluate({
      concurrency: options.concurrency,
      dryRun: options.dryRun,
      manifestPath: nodePath.resolve(options.manifest),
      mechanicalOnly: options.mechanicalOnly,
      outputPath: nodePath.resolve(options.output),
    });
    if (report.attentionRequired && !report.dryRun) {
      process.exitCode = ATTENTION_EXIT;
    }
  } catch (error) {
    // oxlint-disable-next-line eslint/no-console -- The standalone CLI reports its actionable diagnostic to stderr.
    console.error(failureMessage(error));
    process.exitCode = INVALID_INPUT_EXIT;
  }
};

if (
  process.argv[ENTRY_SCRIPT] &&
  nodePath.resolve(process.argv[ENTRY_SCRIPT]) ===
    nodePath.resolve(new URL(import.meta.url).pathname)
) {
  await main();
}
