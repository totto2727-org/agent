#!/usr/bin/env node

// oxlint-disable-next-line rules/no-node-imports -- Write the requested report from the standalone Node.js CLI.
import { writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve output paths from the standalone CLI's working directory.
import { resolve } from "node:path";
import { nounGroupCounts, runMechanical, sourceRange } from "./mechanical.mjs";

import { hasObjectType, matchesNull, matchesUndefined } from "./native-predicates.mjs";

import {
  actionRequest,
  cacheFingerprint,
  endpointFor,
  payloadFor,
  readCredentials,
  TransportFailure,
} from "./evaluation-transport.mjs";
import { EvaluationError } from "./evaluation-validation.mjs";
import { validateResponse } from "./evaluation-response.mjs";

import { loadManifest, parseArguments } from "./evaluation-manifest.mjs";
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

const stateFor = function (item) {
  const state = {
    evidence: {
      document: {
        purpose: item.document.purpose,
        audience: item.document.audience,
        templateConstraints: item.document.templateConstraints,
        sourceLanguage: item.document.sourceLanguage ?? null,
      },
      page: { markdown: item.page },
      local:
        item.scope !== "page"
          ? {
              headingPath: item.section.headingPath,
              markdown: item.section.text,
              sourceRange: item.section.sourceRange,
            }
          : null,
    },
  };
  if (item.dictionaryEvidence) {
    const evidence = state.evidence.local ?? state.evidence.page;
    evidence.dictionaryCandidates = item.dictionaryEvidence;
  }
  if (item.nounEvidence?.length) {
    (state.evidence.local ?? state.evidence.page).nounGroupCounts = item.nounEvidence;
  }
  return state;
};

const pooled = async function (items, concurrency, run) {
  const results = Array.from({ length: items.length });
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await run(items[index]);
      }
    }),
  );
  return results;
};

const reviewFor = function (answer, threshold) {
  return (
    answer.choice === "insufficient_context" ||
    answer.choice === "not_applicable" ||
    (answer.choice === "pass" && (matchesNull(threshold) || answer.confidence < threshold))
  );
};

export async function evaluate({
  manifestPath,
  outputPath,
  concurrency = 4,
  dryRun = false,
  mechanicalOnly = false,
  environment = process.env,
}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new EvaluationError("concurrency must be an integer from 1 through 32");
  }
  const manifest = await loadManifest(manifestPath, { mechanicalOnly });
  const work = await buildWork(manifest, manifestPath);
  const metrics = { requestCount: 0, activeRequests: 0, observedPeakActiveRequests: 0 };
  const credentials =
    dryRun ||
    mechanicalOnly ||
    !work.some((item) => item.engine === "decision" && !item.unavailable)
      ? null
      : readCredentials(environment);
  // Single-flight memo scoped to one evaluate run. Equivalent logical requests
  // (same account/gateway/token route, model, state, criteria, and question
  // Payload) share one pending/resolved/rejected promise, so duplicate work
  // Never submits a second Gateway request. The memo is intentionally per-run:
  // A fresh run re-validates against the Gateway and its cache again.
  const inflight = new Map();
  let fatal = null;
  const evaluated = await pooled(work, concurrency, async (item) => {
    const reportQuestions = Object.entries(item.questions).map(([id, question]) => ({
      id,
      type: item.engine === "mechanical" ? "mechanical" : question.type,
      instructions: question.instructions,
      criteria: question.criteria,
      check: question.check,
      rule: {
        id: question.ruleId,
        scope: item.scope,
        engine: item.engine,
        source: manifest.rules.find((rule) => rule.id === question.ruleId)?.source,
      },
    }));
    const base = {
      documentId: item.document.id,
      path: item.path,
      scope: item.scope,
      engine: item.engine,
      templateConstraints: item.document.templateConstraints,
      sourceLanguage: item.document.sourceLanguage ?? null,
      ...(item.nounEvidence?.length ? { nounGroupCounts: item.nounEvidence } : {}),
      sourceRange: item.section?.sourceRange ?? sourceRange(item.page, 0, item.page.length),
      section: item.section
        ? {
            id: item.section.id,
            headingPath: item.section.headingPath,
            sourceRange: item.section.sourceRange,
          }
        : null,
      questions: reportQuestions,
    };
    if (item.engine === "mechanical" && !dryRun) {
      return {
        ...base,
        status: "complete",
        cache: null,
        answers: Object.entries(item.questions).map(([questionId, question]) => ({
          questionId,
          ...(item.unavailable
            ? {
                type: "choice",
                choice: "not_applicable",
                confidence: 1,
                reviewRequired: false,
                findings: [],
                reason: "No paragraph target is available.",
              }
            : runMechanical(question.check, item.page, base.sourceRange, item.ste)),
        })),
      };
    }
    if ((mechanicalOnly || item.unavailable) && item.engine === "decision") {
      return {
        ...base,
        status: "deferred",
        reason: item.unavailable
          ? (item.unavailableReason ?? "No paragraph target is available.")
          : "Semantic checks are not executed in mechanical-only mode.",
        cache: null,
        answers: reportQuestions.map((question) => ({
          questionId: question.id,
          type: "choice",
          choice: "insufficient_context",
          deferred: true,
          reviewRequired: true,
        })),
      };
    }
    if (dryRun) {
      return { ...base, status: "dry_run", state: stateFor(item), answers: [], cache: null };
    }
    if (fatal) {
      return { ...base, status: "skipped", error: fatal.message, answers: [], cache: null };
    }
    const state = stateFor(item);
    const url = endpointFor(manifest.model, credentials.accountId);
    const body = payloadFor(manifest.model, state, item.requestQuestions);
    const key = cacheFingerprint({
      url,
      gatewayId: credentials.gatewayId,
      apiKey: credentials.apiKey,
      body,
    });
    let entry = inflight.get(key);
    const reused = !matchesUndefined(entry);
    if (!entry) {
      entry = {};
      entry.promise = (async () => {
        const outcome = await actionRequest({
          model: manifest.model,
          state,
          questions: item.requestQuestions,
          credentials,
          cacheKey: key,
          metrics,
        });
        // Validate before treating the outcome as reusable so a malformed or
        // Otherwise invalid payload is shared as a failed outcome, not a pass.
        // A validation failure still carries the observed cache evidence so a
        // Shared malformed response records its real header values.
        try {
          return {
            validated: validateResponse(outcome.response, item.requestQuestions, manifest.model),
            cacheStatus: outcome.cacheStatus,
            ray: outcome.ray,
          };
        } catch (error) {
          if (error && hasObjectType(error)) {
            error.cacheStatus ??= outcome.cacheStatus;
            error.ray ??= outcome.ray;
          }
          throw error;
        }
      })();
      inflight.set(key, entry);
    }
    try {
      const { validated, cacheStatus, ray } = await entry.promise;
      return {
        ...base,
        status: "complete",
        model: validated.model,
        usage: validated.usage,
        answers: validated.answers.map((answer) => {
          const questionId = item.questionMap[answer.questionId];
          const rule = manifest.rules.find(
            (candidate) => candidate.id === item.questions[questionId].ruleId,
          );
          if (
            answer.choice === "pass" &&
            ((rule.requiresDictionaryEntries && !item.dictionaryCoverageComplete) ||
              (rule.requiresNounGroupCounts && !item.nounCoverageComplete))
          ) {
            return {
              type: "choice",
              questionId,
              choice: "insufficient_context",
              confidence: 0,
              reviewRequired: true,
              origin: "evidence-guard",
              providerAnswer: { ...answer, questionId },
              reason:
                rule.requiresNounGroupCounts && !item.nounCoverageComplete
                  ? "A model pass cannot establish noun-group compliance while required local machine counts are unavailable."
                  : "A model pass cannot establish dictionary-dependent compliance while local entries or parsing context are missing.",
            };
          }
          return { ...answer, questionId, reviewRequired: reviewFor(answer, manifest.threshold) };
        }),
        cache: { key, status: cacheStatus, reused, ray },
      };
    } catch (error) {
      const cache = { key, status: error?.cacheStatus ?? null, reused, ray: error?.ray ?? null };
      if (error instanceof TransportFailure) {
        fatal ??= error;
        return { ...base, status: "error", error: error.message, answers: [], cache };
      }
      return {
        ...base,
        status: "error",
        error: error instanceof Error ? error.message : "Evaluation failed",
        answers: [],
        cache,
      };
    }
  });
  const reviewRequired = evaluated.some(
    (entry) =>
      entry.status === "error" ||
      entry.status === "skipped" ||
      entry.status === "deferred" ||
      entry.answers.some((answer) => answer.reviewRequired),
  );
  const failed = evaluated.some((entry) =>
    entry.answers.some((answer) => answer.choice === "fail"),
  );
  const incomplete = evaluated.some((entry) =>
    entry.answers.some(
      (answer) => answer.choice === "not_applicable" || answer.choice === "insufficient_context",
    ),
  );
  const report = {
    version: 1,
    dryRun,
    mechanicalOnly,
    threshold: manifest.threshold,
    model: manifest.model ?? null,
    thresholdStatus: matchesNull(manifest.threshold) ? "uncalibrated" : "supplied",
    rules: manifest.rules,
    templateConstraints: manifest.templateConstraints,
    excludedDocuments: manifest.documents
      .filter((document) => manifest.englishOnly && !/^en(?:-|$)/i.test(document.sourceLanguage))
      .map((document) => ({
        documentId: document.id,
        sourceLanguage: document.sourceLanguage,
        reason: "Non-English source excluded by the explicit englishOnly marker.",
      })),
    concurrency,
    requestCount: metrics.requestCount,
    questionCount: work.reduce((count, item) => count + Object.keys(item.questions).length, 0),
    observedPeakActiveRequests: metrics.observedPeakActiveRequests,
    reviewRequired,
    failed,
    incomplete,
    attentionRequired: reviewRequired || failed || incomplete,
    evaluations: evaluated,
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const main = async function () {
  try {
    const options = parseArguments(process.argv.slice(2));
    const report = await evaluate({
      manifestPath: resolve(options.manifest),
      outputPath: resolve(options.output),
      concurrency: options.concurrency,
      dryRun: options.dryRun,
      mechanicalOnly: options.mechanicalOnly,
    });
    if (report.attentionRequired && !report.dryRun) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Evaluation failed");
    process.exitCode = 2;
  }
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  await main();
}
