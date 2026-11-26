import { record, string, WIRE_NULL } from "./github-json.ts";
import { isString } from "./native-predicates.ts";
import type { Check } from "./types.ts";

type Details = Pick<Check, "name" | "description" | "link" | "workflow">;
type CheckKind = Exclude<Check["kind"], "code-review-gate">;

const GRAPHQL_TYPE_FIELD = "__typename";

const optionalText = (value: unknown): string | undefined => isString(value) ? value : undefined;
const stateWord = (value: unknown): string => optionalText(value)?.toUpperCase() ?? "";

const detailsOf = (value: Record<string, unknown>, nameKey: string): Details =>
  // oxlint-disable-next-line eslint/sort-keys -- Retain the check metadata's established serialized field order.
  ({ name: string(value[nameKey], nameKey), description: optionalText(value.description) ?? "", link: optionalText(value.link) ?? optionalText(value.detailsUrl) ?? "", workflow: optionalText(value.workflow) ?? "" });

const result = (kind: CheckKind, details: Details, reportedState: string): Check => ({
  ...details, kind, reportedState,
});

// The owner-approval gate becomes its own result only for pending and action-required states.
const gateOr = (kind: "pending" | "failed", details: Details, reportedState: string): Check =>
  details.name === "Code Review Gate"
    ? { ...details, kind: "code-review-gate", name: "Code Review Gate", reportedState }
    : result(kind, details, reportedState);

const settledFastCheck = (bucket: string, state: string): CheckKind => {
  if (bucket === "fail" || state === "FAILURE" || state === "ERROR") {return "failed";}
  if (bucket === "pass") {return "passed";}
  return bucket === "skipping" ? "skipped" : "failed";
};

export const parseFastCheck = function parseFastCheck(value: unknown): Check {
  const object = record(value, "check");
  const details = detailsOf(object, "name");
  const state = string(object.state, "check.state").toUpperCase();
  const bucket = string(object.bucket, "check.bucket");
  if (state === "ACTION_REQUIRED") {return gateOr("failed", details, state);}
  if (bucket === "pending" && state !== "FAILURE" && state !== "ERROR") {return gateOr("pending", details, state);}
  return result(settledFastCheck(bucket, state), details, state);
};

const checkRun = (object: Record<string, unknown>, details: Details): Check => {
  const status = stateWord(object.status);
  const conclusion = stateWord(object.conclusion);
  if (status !== "COMPLETED") {return gateOr("pending", details, "PENDING");}
  if (conclusion === "SUCCESS") {return result("passed", details, "SUCCESS");}
  if (conclusion === "NEUTRAL" || conclusion === "SKIPPED") {return result("skipped", details, conclusion);}
  return conclusion === "ACTION_REQUIRED" ? gateOr("failed", details, conclusion) : result("failed", details, "FAILURE");
};

const statusContext = (object: Record<string, unknown>, details: Details): Check => {
  const state = stateWord(object.state);
  if (state === "PENDING" || state === "EXPECTED") {return gateOr("pending", details, "PENDING");}
  return state === "SUCCESS" ? result("passed", details, state) : result("failed", details, state || "FAILURE");
};

export const mapRollupNode = function mapRollupNode(value: unknown): Check | null {
  const object = record(value, "rollup node");
  const typename = object[GRAPHQL_TYPE_FIELD];
  if (typename !== "CheckRun" && typename !== "StatusContext") {return WIRE_NULL;}
  const details = detailsOf(object, typename === "CheckRun" ? "name" : "context");
  const linked = { ...details, link: optionalText(object.targetUrl) ?? details.link };
  return typename === "CheckRun" ? checkRun(object, linked) : statusContext(object, linked);
};
