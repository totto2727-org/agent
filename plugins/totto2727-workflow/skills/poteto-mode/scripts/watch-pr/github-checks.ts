import { firstLine } from "./github-command.ts";
import { WatcherQueryError } from "./github-error.ts";
import { matchesNull } from "./native-predicates.ts";
import { nonEmpty } from "./types.ts";
import type { Check, CheckRead, ChecksFastPath, GitHubReader, NonEmpty, PrContext } from "./types.ts";

// oxlint-disable-next-line unicorn/no-null -- GitHub's first pagination request uses a null cursor.
const FIRST_PAGE = null;

// oxlint-disable-next-line unicorn/custom-error-definition -- The watcher exposes the existing ChecksUnavailable class and name.
export class ChecksUnavailable extends WatcherQueryError {
  public constructor(detail: string) {
    // oxlint-disable-next-line eslint/sort-keys -- Retain the serialized query failure field order.
    super({ kind: "checks-unavailable", retryable: true, detail });
    this.name = "ChecksUnavailable";
  }
}

const rollup = async (reader: GitHubReader, context: PrContext): Promise<Check[]> => {
  const checks: Check[] = [];
  const cursor: { after: string | null } = { after: FIRST_PAGE };
  do {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each GraphQL page supplies the cursor for the next page.
    const page = await reader.checkRollupPage(context, cursor.after);
    checks.push(...page.checks);
    cursor.after = page.endCursor;
  } while (!matchesNull(cursor.after));
  return checks;
};

const emptyDetail = (fast: ChecksFastPath): string => {
  if (fast.kind !== "unusable") {return "fast path and GraphQL rollup were empty";}
  const summary = firstLine(fast.stderr);
  const reason = summary ? `; ${summary}` : "";
  return `fast path exit=${fast.exitCode}; GraphQL rollup was empty${reason}`;
};

const collected = (source: CheckRead["source"], checks: NonEmpty<Check>): CheckRead =>
  // oxlint-disable-next-line eslint/sort-keys -- Keep the source and checks fields in their established report order.
  ({ source, checks });

export const resolveChecks = async function resolveChecks(reader: GitHubReader, context: PrContext): Promise<CheckRead> {
  const fast = await reader.checksFastPath(context);
  const direct = fast.kind === "checks" ? nonEmpty(fast.checks) : FIRST_PAGE;
  if (!matchesNull(direct)) {return collected("gh-pr-checks", direct);}
  const fallback = nonEmpty(await rollup(reader, context));
  if (!matchesNull(fallback)) {return collected("graphql-rollup", fallback);}
  throw new ChecksUnavailable(`could not read PR checks: ${emptyDetail(fast)}`);
};
