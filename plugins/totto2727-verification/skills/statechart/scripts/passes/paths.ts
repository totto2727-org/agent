import { hasRule, matchesUndefined, must, stateKey, visitItems } from "#statechart/ir.ts";
import type { Bug, Graph, Lasso, PathStep, Rule, Step, Trace, TraceState, Vars } from "#statechart/ir.ts";

const INITIAL_STATE = 0;
const FIRST_MOVE = 1;
const FINAL_MOVE = -1;
const STATE_OFFSET = 1;

interface Route {
  path: PathStep[];
  start: string;
}

// oxlint-disable-next-line typescript/consistent-type-definitions -- Preserve the inferred result's structural Record assignability.
type PathGraph = {
  bug: (rule: Rule, trace: TraceState[]) => Bug;
  graph: Graph;
  lasso: (trace: Trace) => Lasso | undefined;
};

class PathGraphBuilder {
  public graph: Graph = { states: new Map(), steps: [] };
  #names: string[];
  #ids = new Map<string, string>();
  #taken = new Map<string, Step>();

  public constructor(names: string[]) {
    this.#names = names;
  }

  #idOf(vars: Vars | undefined, start: boolean): string {
    if (!vars) {
      // oxlint-disable-next-line rules/require-tagged-error -- The standalone converter reports missing TLC values through its synchronous error boundary.
      throw new Error("TLC's trace has a state with no values.");
    }
    const key = stateKey(this.#names.map((name) => vars[name]));
    const existing = this.#ids.get(key);
    if (matchesUndefined(existing)) {return this.#addState(key, vars, start);}
    if (start) {must(this.graph.states, existing).start = true;}
    return existing;
  }

  #addState(key: string, vars: Vars, start: boolean): string {
    const id = String(this.#ids.size);
    this.#ids.set(key, id);
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the Statechart graph state's serialized field order.
    this.graph.states.set(id, { vars, start, breaks: [] });
    return id;
  }

  #step(from: string, to: string, action: string): Step {
    const key = `${from} ${to} ${action}`;
    const existing = this.#taken.get(key);
    if (!matchesUndefined(existing)) {return existing;}
    // oxlint-disable-next-line eslint/sort-keys -- Preserve the serialized TLC graph step order.
    const step = { from, to, action };
    this.#taken.set(key, step);
    this.graph.steps.push(step);
    return step;
  }

  #route(seq: Trace["seq"]): Route {
    const start = this.#idOf(seq[INITIAL_STATE].vars, true);
    const path: PathStep[] = [];
    const cursor = { from: start };
    visitItems(seq.keys(), (index) => {
      if (index < FIRST_MOVE) {return;}
      const { action, vars } = seq[index];
      const to = this.#idOf(vars, false);
      path.push({ action, state: to, step: this.#step(cursor.from, to, action) });
      cursor.from = to;
    });
    // oxlint-disable-next-line eslint/sort-keys -- Retain the route's established serialized key order in bugs and lassos.
    return { start, path };
  }

  public bug(rule: Rule, trace: TraceState[]): Bug {
    if (!trace.length) {
      // oxlint-disable-next-line rules/require-tagged-error -- Keep the native validation error for malformed TLC failure traces.
      throw new Error(`TLC's trace for ${rule.name} has no states.`);
    }
    const bug = { rule, ...this.#route(trace) };
    const end = must(this.graph.states, bug.path.at(FINAL_MOVE)?.state ?? bug.start);
    if (!hasRule(end.breaks, rule)) {end.breaks.push(rule);}
    return bug;
  }

  public lasso({ seq, loop }: Trace): Lasso | undefined {
    if (seq.length) {return { ...this.#route(seq), loop, stutters: loop === seq.length - STATE_OFFSET };}
    return undefined;
  }
}

export const pathGraph = function pathGraph(names: string[]): PathGraph {
  const builder = new PathGraphBuilder(names);
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the established result keys for Statechart path graph callers.
  return { graph: builder.graph, bug: (rule, trace) => builder.bug(rule, trace), lasso: (trace) => builder.lasso(trace) };
};
