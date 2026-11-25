import {
  deferredOutcome,
  dryOutcome,
  mechanicalOutcome,
  skippedOutcome,
} from "./evaluation-outcome.mjs";
import { providerOutcome } from "./evaluation-provider-result.mjs";
import { reportBaseFor } from "./evaluation-state.mjs";
import { failureMessage } from "./evaluation-validation.mjs";

/** @typedef {import("./evaluation-manifest.mjs").Manifest} Manifest */
/** @typedef {import("./evaluation-batch.mjs").RequestBatch} RequestBatch */
/** @typedef {import("./evaluation-report.mjs").ReportOptions} ReportOptions */
/** @typedef {import("./evaluation-work.mjs").PreparedWork} PreparedWork */
/** @typedef {ReturnType<typeof deferredOutcome> | ReturnType<typeof dryOutcome> | ReturnType<typeof mechanicalOutcome> | ReturnType<typeof skippedOutcome> | Awaited<ReturnType<typeof providerOutcome>>} ExecutionOutcome */

/** @type {(manifest: Manifest, options: Pick<ReportOptions,"dryRun" | "mechanicalOnly">, batch: RequestBatch) => (item: PreparedWork) => Promise<ExecutionOutcome>} */
export const executeTarget =
  (manifest, { dryRun, mechanicalOnly }, { failures, submit }) =>
  async (item) => {
    const base = reportBaseFor(item, manifest.rules);
    if (item.engine === "mechanical") {
      return dryRun ? dryOutcome(base, item) : mechanicalOutcome(base, item);
    }
    if (mechanicalOnly || item.unavailable) {
      return deferredOutcome(base, item);
    }
    if (dryRun) {
      return dryOutcome(base, item);
    }
    if (failures.fatal) {
      return skippedOutcome(base, failureMessage(failures.fatal));
    }
    return providerOutcome({ base, item, manifest }, submit(item), failures);
  };
