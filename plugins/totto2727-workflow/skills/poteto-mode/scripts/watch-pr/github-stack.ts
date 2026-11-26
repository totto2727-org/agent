import { visitItems } from "./native-iteration.ts";
import { matchesUndefined } from "./native-predicates.ts";
import type * as Types from "./types.ts";
import { nonEmpty } from "./types.ts";

type Branches = ReadonlyMap<string, Types.OpenPullRequest>;
type Children = ReadonlyMap<string, Readonly<Types.OpenPullRequest[]>>;

// A base ref belongs to this repository. A fork's head with the same name is a different branch.
const sameRepository = (open: Readonly<Types.OpenPullRequest[]>): Branches =>
  new Map(open.filter((pr) => !pr.isCrossRepository).map((pr) => [pr.headRefName, pr]));

const indexChildren = (open: Readonly<Types.OpenPullRequest[]>): Children => {
  const children = new Map<string, Types.OpenPullRequest[]>();
  visitItems(open, (pr) => {
    if (pr.isCrossRepository) {return;}
    children.set(pr.baseRefName, [...(children.get(pr.baseRefName) ?? []), pr]);
  });
  visitItems(children.values(), (values) => {
    values.sort((left, right) => left.number - right.number);
  });
  return children;
};

const ancestors = (start: Types.OpenPullRequest, branches: Branches): Types.OpenPullRequest[] => {
  const path: Types.OpenPullRequest[] = [];
  const state = { current: start };
  while (branches.has(state.current.baseRefName)) {
    const parent = branches.get(state.current.baseRefName);
    if (matchesUndefined(parent)) {break;}
    path.push(parent);
    state.current = parent;
  }
  return path;
};

const descendants = (
  start: Types.OpenPullRequest,
  parents: Readonly<Types.OpenPullRequest[]>,
  children: Children
): Types.OpenPullRequest[] => {
  const seen = new Set<Types.PrNumber>([...parents.map((pr) => pr.number), start.number]);
  const path: Types.OpenPullRequest[] = [];
  const visit = (parent: Types.OpenPullRequest): void => {
    if (parent.isCrossRepository) {return;}
    visitItems(children.get(parent.headRefName) ?? [], (child) => {
      if (child.isCrossRepository || seen.has(child.number)) {return;}
      seen.add(child.number);
      path.push(child);
      visit(child);
    });
  };
  visit(start);
  return path;
};

const prContext = (context: Types.PrContext, number: Types.PrNumber): Types.PrContext => ({ ...context, number });

export const orderStack = function orderStack(
  context: Types.PrContext,
  open: Readonly<Types.OpenPullRequest[]>
): Types.NonEmpty<Types.PrContext> {
  const byNumber = new Map(open.map((pr) => [pr.number, pr]));
  const branches = sameRepository(open);
  const children = indexChildren(open);
  const start = byNumber.get(context.number);
  if (matchesUndefined(start)) {return [context];}
  const parents = ancestors(start, branches);
  const above = descendants(start, parents, children);
  return nonEmpty([...parents.toReversed(), start, ...above].map((pr) => prContext(context, pr.number))) ?? [context];
};

export const discoverStack = async function discoverStack(
  reader: Types.GitHubReader,
  context: Types.PrContext
): Promise<Types.NonEmpty<Types.PrContext>> {
  return orderStack(context, await reader.openPullRequests(context));
};
