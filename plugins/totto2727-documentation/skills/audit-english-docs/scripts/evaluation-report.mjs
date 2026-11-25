// oxlint-disable-next-line rules/no-node-imports -- The standalone workflow writes its public JSON report with Node.
import { writeFile } from "node:fs/promises";

import { matchesNull } from "./native-predicates.mjs";

/** @typedef {import("./evaluation-manifest.mjs").Manifest} Manifest */
/** @typedef {import("./evaluation-work.mjs").PreparedWork} PreparedWork */
/** @typedef {import("./evaluation-transport.mjs").RequestMetrics} RequestMetrics */
/** @typedef {{ answers: { choice?: string, reviewRequired?: boolean }[], status: string }} SummaryEntry */
/** @typedef {{ concurrency: number, dryRun: boolean, mechanicalOnly: boolean }} ReportOptions */

const REPORT_VERSION = 1;
const REPORT_INDENT = 2;
const FIRST_COUNT = 0;
// oxlint-disable-next-line unicorn/no-null -- JSON reports use null for an absent model and the default replacer.
const NO_VALUE = null;

/** @type {(evaluated: SummaryEntry[]) => { failed: boolean, incomplete: boolean, reviewRequired: boolean }} */
const summarize = (evaluated) => {
  const blocked = new Set(["error", "skipped", "deferred"]);
  const reviewRequired = evaluated.some(
    (entry) =>
      blocked.has(entry.status) || entry.answers.some((answer) => answer.reviewRequired ?? false),
  );
  const failed = evaluated.some((entry) =>
    entry.answers.some((answer) => answer.choice === "fail"),
  );
  const incomplete = evaluated.some((entry) =>
    entry.answers.some(
      (answer) => answer.choice === "not_applicable" || answer.choice === "insufficient_context",
    ),
  );
  return { failed, incomplete, reviewRequired };
};

/** @type {(manifest: Manifest) => { documentId: string, reason: string, sourceLanguage: string | undefined }[]} */
const excludedDocuments = (manifest) =>
  manifest.documents
    .filter(
      (document) => manifest.englishOnly && !/^en(?:-|$)/iu.test(document.sourceLanguage ?? ""),
    )
    .map((document) =>
      // oxlint-disable-next-line eslint/sort-keys -- Keep the existing exclusion record layout in the public report.
      ({
        documentId: document.id,
        sourceLanguage: document.sourceLanguage,
        reason: "Non-English source excluded by the explicit englishOnly marker.",
      }),
    );

/**
 * Prepares the public report after all evaluations resolve.
 * @template {SummaryEntry} Entry
 * @param {{ evaluated: Entry[], manifest: Manifest, metrics: RequestMetrics, work: PreparedWork[] }} run - The results and the run's input.
 * @param {ReportOptions} options - The declared run mode and concurrency.
 * @returns {{ attentionRequired: boolean, concurrency: number, dryRun: boolean, evaluations: Entry[], excludedDocuments: ReturnType<typeof excludedDocuments>, failed: boolean, incomplete: boolean, mechanicalOnly: boolean, model: string | null, observedPeakActiveRequests: number, questionCount: number, requestCount: number, reviewRequired: boolean, rules: Manifest["rules"], templateConstraints: string[], threshold: Manifest["threshold"], thresholdStatus: "supplied" | "uncalibrated", version: number }} The serializable report.
 */
export const reportFor = (
  { evaluated, manifest, metrics, work },
  { concurrency, dryRun, mechanicalOnly },
) => {
  const { reviewRequired, failed, incomplete } = summarize(evaluated);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the public report's existing serialized key order.
  return {
    version: REPORT_VERSION,
    dryRun,
    mechanicalOnly,
    threshold: manifest.threshold,
    model: manifest.model ?? NO_VALUE,
    thresholdStatus: matchesNull(manifest.threshold) ? "uncalibrated" : "supplied",
    rules: manifest.rules,
    templateConstraints: manifest.templateConstraints,
    excludedDocuments: excludedDocuments(manifest),
    concurrency,
    requestCount: metrics.requestCount,
    questionCount: work.reduce(
      (count, item) => count + Object.keys(item.questions).length,
      FIRST_COUNT,
    ),
    observedPeakActiveRequests: metrics.observedPeakActiveRequests,
    reviewRequired,
    failed,
    incomplete,
    attentionRequired: reviewRequired || failed || incomplete,
    evaluations: evaluated,
  };
};

/** @type {(path: string, report: unknown) => Promise<void>} */
export const writeReport = async (path, report) => {
  await writeFile(path, `${JSON.stringify(report, NO_VALUE, REPORT_INDENT)}\n`);
};
