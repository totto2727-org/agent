import { plainText } from "./backends/plain-text.ts";
import { readMessages } from "./frontends/messages.ts";
import { readVerdict } from "./frontends/verdict.ts";
import { LEVEL, isNumber, isString, visitItems } from "./ir.ts";
import { CHECK_FAILED, CHECK_PASSED, CHECK_VIOLATION } from "./ir-model.ts";
import type { CheckResult, Output, Part, Stop } from "./ir.ts";
import { CHILD_SUCCESS, outputLines } from "./native-process.ts";
import type { FileResult } from "./native-process.ts";

const SANY_ERRORS = /^\*\*\* ?(?:Errors|Abort messages|Parse Error)/mu;

// TLC's ExitStatus class defines these three model-checking violations.
const TLC_DEADLOCK = 11;
const TLC_SAFETY_VIOLATION = 12;
const TLC_LIVENESS_VIOLATION = 13;
const TLC_VIOLATION_STATUSES = new Set([TLC_DEADLOCK, TLC_SAFETY_VIOLATION, TLC_LIVENESS_VIOLATION]);
export { CHECK_FAILED } from "./ir-model.ts";
export const messagesOf = (output: Output): Iterable<Part> => ({
  [Symbol.iterator]: () => readMessages(outputLines(output)),
});

export const distinctStates = (output: Output): number => readVerdict(messagesOf(output)).distinct;

export const exitClass = (status: number | null): CheckResult["exit"] => {
  if (status === CHILD_SUCCESS) {return CHECK_PASSED;}
  if (isNumber(status) && TLC_VIOLATION_STATUSES.has(status)) {return CHECK_VIOLATION;}
  return CHECK_FAILED;
};

const MAX_TAIL_CHARACTERS = 268_435_456;
const TAIL_LINE_COUNT = 30;
const HEAD_LINE_COUNT = 40;
const SEARCH_MISS = -1;

export const tail = (processResult: FileResult): string => {
  if (processResult.error) {return processResult.error.message;}
  const retained: { chunks: string[]; size: number } = { chunks: [], size: 0 };
  visitItems(plainText(messagesOf(processResult.output)), (chunk) => {
    retained.chunks.push(chunk);
    retained.size += chunk.length;
    while (retained.size - retained.chunks[0].length >= MAX_TAIL_CHARACTERS) {
      retained.size -= retained.chunks[0].length;
      retained.chunks.shift();
    }
  });
  return retained.chunks.join("").trim().split("\n").slice(-TAIL_LINE_COUNT).join("\n");
};

const firstLines = (text: string): string => {
  const lines = text.trim().split("\n");
  if (lines.length > HEAD_LINE_COUNT) {lines.splice(HEAD_LINE_COUNT, Infinity, `... ${lines.length - HEAD_LINE_COUNT} more lines`);}
  return lines.join("\n");
};

export const stopOf = (processResult: FileResult): Stop => {
  const errors: Part[] = [];
  visitItems(processResult.error ? [] : messagesOf(processResult.output), (part) => {
    if (isString(part)) {return;}
    if (part.level === LEVEL.ERROR || part.level === LEVEL.TLCBUG || (Boolean(errors.length) && part.level === LEVEL.STATE)) {
      errors.push(part);
    }
  });
  const message = errors.length ? firstLines([...plainText(errors)].join("")) : tail(processResult);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the reported stop's observable status and message order.
  return { status: processResult.status, message };
};

export const sanyErrors = (processResult: FileResult): string | undefined => {
  if (processResult.error) {return undefined;}
  const text = [...plainText(messagesOf(processResult.output))].join("");
  const at = text.search(SANY_ERRORS);
  return at === SEARCH_MISS ? undefined : firstLines(text.slice(at));
};

export const checkFailure = (specFile: string, processResult: FileResult): Error =>
  // oxlint-disable-next-line rules/require-tagged-error -- Preserve the standalone CLI's native error without loading a runtime package.
  new Error(`TLC could not check ${specFile} (exit ${processResult.status}):\n${stopOf(processResult).message}`);
