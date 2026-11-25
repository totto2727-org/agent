// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to generate the native run's independent marker using the host's entropy source.
import { randomBytes } from "node:crypto";
// oxlint-disable-next-line rules/no-node-imports -- Await the standalone tool's temporary files before starting each native checker.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
import { boundRun, chartRun, configText } from "./backends/cfg.ts";
import { plainText } from "./backends/plain-text.ts";
import { readConfig } from "./frontends/config.ts";
import { parseDot } from "./frontends/dot.ts";
import { readCounterexample, readMarks } from "./frontends/marks.ts";
import { readMessages } from "./frontends/messages.ts";
import { initialOnlyProperties, readChecks, readSany, readSpec } from "./frontends/spec.ts";
import { readTrace } from "./frontends/trace.ts";
import { readVerdict } from './frontends/verdict.ts';
import type { Break } from './frontends/verdict.ts';
import { CHART_STATES, LEVEL, RERUN_STATES, hasSection, isNumber, isString, matchesUndefined, must, ruleKey, stateRules, visitItems } from './ir.ts';
import type { Bug, CheckResult, ConfigSection, Lasso, Mark, Outcome, Output, Part, Property, Rule, Stop, Trace, Verdict } from './ir.ts';
import { addPast, deadEnds, finder, lasso, mark } from "./passes/annotate.ts";
import { pathGraph } from "./passes/paths.ts";
import { hostEnvironment } from "#statechart/host-env.ts";

import { CHILD_SUCCESS, fileExists, fileLines, outputLines, runChild, runToFiles } from "./native-process.ts";
import type { FileResult } from "./native-process.ts";

export { fileExists, fileLines, messageOf, runChild } from "./native-process.ts";

const TLC_TOOL =
  "http:tla2tools[url=https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar,checksum=sha256:936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88]@1.7.4";
const JAVA_TOOL = "java@temurin-25";
export const PINNED_FLAGS = ["-workers", "1", "-fp", "0", "-lncheck", "final"];
const CHART_TAG_BYTES = 16;
const SANY_ERRORS = /^\*\*\* ?(?:Errors|Abort messages|Parse Error)/mu;

// TLC's ExitStatus class defines these three model-checking violations.
const TLC_DEADLOCK = 11;
const TLC_SAFETY_VIOLATION = 12;
const TLC_LIVENESS_VIOLATION = 13;
const TLC_VIOLATION_STATUSES = new Set([TLC_DEADLOCK, TLC_SAFETY_VIOLATION, TLC_LIVENESS_VIOLATION]);
const CHECK_PASSED = 0;
const CHECK_VIOLATION = 1;
const CHECK_FAILED = 2;
const messagesOf = (output: Output): Iterable<Part> => ({
  [Symbol.iterator]: () => readMessages(outputLines(output)),
});

const findTlc = async function (cwd: string) {
  const { TLA2TOOLS, JAVA } = hostEnvironment();
  if (TLA2TOOLS) {return { jar: TLA2TOOLS, java: JAVA || "java" };}
  const mise = (...args: string[]) =>
    runChild("mise", args, { cwd, env: { ...hostEnvironment(), MISE_CEILING_PATHS: cwd } });
  const where = () =>
    Promise.all([mise("where", TLC_TOOL), mise("which", "java", "--tool", JAVA_TOOL)]);
  let found = await where();
  if (found.some((candidate) => candidate.status !== CHILD_SUCCESS)) {
    const installation = await mise("install", JAVA_TOOL, TLC_TOOL);
    if (installation.status !== CHILD_SUCCESS)
      {throw new Error(
        `Cannot find TLC: mise install failed: ${installation.error?.message ?? installation.stderr.trim()}\nOr set TLA2TOOLS to the path of tla2tools.jar, and JAVA to a java binary (Java 11 or later).`,
      );}
    found = await where();
  }
  return {
    jar: path.join(found[0].stdout.trim(), "tla2tools.jar"),
    java: JAVA || found[1].stdout.trim(),
  };
};

const exitClass = (status: number | null): CheckResult["exit"] => {
  if (status === CHILD_SUCCESS) {return CHECK_PASSED;}
  if (isNumber(status) && TLC_VIOLATION_STATUSES.has(status)) {return CHECK_VIOLATION;}
  return CHECK_FAILED;
};

const MAX_TAIL_CHARACTERS = 268_435_456;
const TAIL_LINE_COUNT = 30;
const HEAD_LINE_COUNT = 40;
const SEARCH_MISS = -1;

const tail = (processResult: FileResult): string => {
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

const stopOf = (processResult: FileResult): Stop => {
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

const sanyErrors = (processResult: FileResult): string | undefined => {
  if (processResult.error) {return undefined;}
  const text = [...plainText(messagesOf(processResult.output))].join("");
  const at = text.search(SANY_ERRORS);
  return at === SEARCH_MISS ? undefined : firstLines(text.slice(at));
};

const names = (rules: Rule[], kind: Rule["kind"]): string[] => {
  const found: string[] = [];
  visitItems(rules, (rule) => {if (rule.kind === kind) {found.push(rule.name);}});
  return found;
};

const brokenRule = (rules: Rule[], broke: Break): Rule | undefined => {
  const exact = broke.kind === "temporal" ? undefined :
    rules.find((rule) => rule.kind === broke.kind && (broke.kind === "deadlock" || rule.name === broke.name));
  return broke.kind === "invariant" && matchesUndefined(exact)
    ? rules.find((rule) => rule.kind === "property" && rule.name === broke.name)
    : exact;
};

const only = function* (marks: Iterable<Mark>, rules: Set<string>): Generator<Mark> {
  // oxlint-disable-next-line rules/no-for-loops -- Keep mark selection lazy while reading TLC's output stream.
  for (const { values, broken } of marks) {
    const kept: string[] = [];
    visitItems(broken, (name) => {if (rules.has(name)) {kept.push(name);}});
    // oxlint-disable-next-line eslint/sort-keys -- Keep the emitted mark's field order.
    if (kept.length) {yield { values, broken: kept };}
  }
};

export const check = async function check(specFile: string, configFile: string): Promise<CheckResult> {
  const cfg = readConfig({ file: configFile, text: await readFile(configFile, "utf8") });
  const checks = readChecks({ configFile, config: cfg });
  const folder = path.dirname(path.resolve(specFile));
  const dir = await mkdtemp(path.join(os.tmpdir(), "statechart-"));
  try {
    const tlc = await findTlc(dir);
    const config = async (name: string, sections: ConfigSection[], extra: string[]): Promise<string[]> => {
      const file = path.join(dir, `${name}.cfg`);
      await writeFile(file, configText(sections, extra));
      return [`-metadir`, path.join(dir, `meta-${name}`), "-config", file];
    };
    const runJava = async (name: string, main: string, args: string[], jvm: string[] = []): Promise<FileResult> => {
      const tmp = path.join(dir, `tmp-${name}`);
      await mkdir(tmp);
      return runToFiles(
        tlc.java,
        [
          `-Djava.io.tmpdir=${tmp}`,
          `-DTLA-Library=${folder}`,
          "-Dstdout.encoding=UTF-8",
          "-Dstderr.encoding=UTF-8",
          ...jvm,
          "-cp",
          tlc.jar,
          main,
          ...args,
        ],
        {
          cwd: dir,
          out: path.join(dir, name),
          env: process.platform === "darwin" ? hostEnvironment() : { ...hostEnvironment(), LC_ALL: "C.UTF-8" },
        },
      );
    };
    const xml = await runJava(
      "sany",
      "tla2sany.xml.XMLExporter",
      ["-o", "-I", folder, path.resolve(specFile)],
      ["-XX:TieredStopAtLevel=1"],
    );
    if (xml.status !== CHILD_SUCCESS) {
      const errors = xml.error
        ? undefined
        : sanyErrors(
            await runJava(
              "sany-errors",
              "tla2sany.SANY",
              [path.resolve(specFile)],
              ["-XX:TieredStopAtLevel=1"],
            ),
          );
      throw new Error(
        `SANY could not read ${specFile} (exit ${xml.status}):\n${errors ?? tail(xml)}`,
      );
    }
    const sany = readSany(await readFile(xml.stdout, "utf8"));
    const module = path.basename(specFile, ".tla");
    const spec = { ...readSpec({ module, sany, checks }), folder };
    const rules = stateRules(spec);
    const all = [...rules];
    visitItems(spec.properties, (name) => {all.push({ kind: "property", name });});
    const verdicts = new Map<string, Verdict>();
    const decide = (rule: Rule, outcome: Outcome, processResult?: FileResult) =>
      verdicts.set(ruleKey(rule), { rule, outcome, messages: processResult && messagesOf(processResult.output) });
    const judge = async () => {
      const groups = [all];
      let first: FileResult | undefined;
      let stop: Stop | undefined;
      const states = { distinct: 0, initial: 0, complete: false, cut: false };
      for (let checkNumber = 1; groups.length;) {
        const group: Rule[] = [];
        visitItems(groups[0], (rule) => {if (!verdicts.has(ruleKey(rule))) {group.push(rule);}});
        if (first && !group.length) {
          groups.shift();
          continue;
        }
        const name = `verdict-${checkNumber++}`;
        const extra: string[] = [];
        const invariants = names(group, "invariant");
        const properties = names(group, "property");
        if (invariants.length) {extra.push(`INVARIANT ${invariants.join(" ")}`);}
        if (properties.length) {extra.push(`PROPERTY ${properties.join(" ")}`);}
        const bounded = !matchesUndefined(first) && !states.complete;
        if (bounded) {extra.push("CONSTRAINT ChartBound");}
        // oxlint-disable-next-line eslint/no-await-in-loop -- Each verdict determines which pending group the next TLC invocation checks.
        const checkOutput = await runJava(name, "tlc2.TLC", [
          "-tool",
          ...PINNED_FLAGS,
          ...(names(group, "deadlock").length ? [] : ["-deadlock"]),
          // oxlint-disable-next-line eslint/no-await-in-loop -- Write this group's configuration before starting its checker.
          ...(await config(name, spec.written, extra)),
          bounded ? "ChartBound" : spec.module,
        ]);
        first ??= checkOutput;
        const { broke, distinct, initial } = readVerdict(messagesOf(checkOutput.output));
        states.distinct = Math.max(states.distinct, distinct);
        states.initial = Math.max(states.initial, initial);
        const rule = broke && brokenRule(group, broke);
        const cut = bounded && distinct >= RERUN_STATES;
        if (exitClass(checkOutput.status) === CHECK_FAILED) {
          stop = stopOf(checkOutput);
          break;
        } else if (rule) {decide(rule, "broken", checkOutput);}
        else if (cut && (checkOutput.status === CHILD_SUCCESS || broke?.kind === "temporal")) {
          states.cut = true;
          visitItems(group, (rule) => {decide(rule, "not checked");});
        } else if (checkOutput.status === CHILD_SUCCESS) {
          states.complete = true;
          visitItems(group, (rule) => {decide(rule, "holds");});
        } else if (broke && properties.length) {
          if (broke.kind === "temporal") {
            states.complete = true;
            visitItems(group, (rule) => {if (rule.kind !== "property") {decide(rule, "holds");}});
          }
          const pending: Rule[][] = [];
          const rest: Rule[] = [];
          visitItems(group, (rule) => {if (rule.kind === "property") {pending.push([rule]);}
            else if (!verdicts.has(ruleKey(rule))) {rest.push(rule);}});
          if (pending.length === 1) {decide(pending[0][0], "broken", checkOutput);}
          else {groups.splice(0, 1, rest, ...pending);}
        } else
          {throw new Error(
            `TLC exited ${checkOutput.status} on ${specFile}, but its output names no rule that broke:\n${tail(checkOutput)}`,
          );}
      }
      visitItems(all, (rule) => {if (!verdicts.has(ruleKey(rule))) {decide(rule, "not checked");}});
      return { first: first!, stop, states };
    };
    await writeFile(path.join(dir, "ChartBound.tla"), boundRun(spec.module));
    const judged = await judge();
    const exit = exitClass(judged.first.status);
    const failed = (processResult: FileResult) =>
      new Error(`TLC could not check ${specFile} (exit ${processResult.status}):\n${stopOf(processResult).message}`);
    const initialOnly = initialOnlyProperties(sany, spec);
    const propertiesWith = (bugOf: (trace: Trace) => Lasso | undefined) => {
      const properties: Property[] = [];
      visitItems(all, (rule) => {
        if (rule.kind !== "property") {return;}
        const verdict = must(verdicts, ruleKey(rule));
        properties.push({
          ...verdict,
          bug: verdict.outcome === "broken" && verdict.messages ? bugOf(readTrace(verdict.messages)) : undefined,
          initialOnly: initialOnly.has(rule.name),
        });
      });
      return properties;
    };
    if (exit === CHECK_FAILED) {throw failed(judged.first);}
    const checked: Verdict[] = [];
    visitItems(rules, (rule) => {checked.push(must(verdicts, ruleKey(rule)));});
    const common = {
      spec,
      exit,
      stop: judged.stop,
      states: judged.states,
      messages: messagesOf(judged.first.output),
      rules: checked,
    };
    if (judged.states.distinct <= CHART_STATES) {
      const tag = `chart-${randomBytes(CHART_TAG_BYTES).toString("hex")}`;
      await writeFile(path.join(dir, "ChartRun.tla"), chartRun(spec, tag));
      const drawn = await runJava("ChartRun", "tlc2.TLC", [
        "-tool",
        ...PINNED_FLAGS,
        "-deadlock",
        ...(await config("ChartRun", spec.written, ["INVARIANT ChartMark", "CONSTRAINT ChartBudget"])),
        "-dump",
        "dot,actionlabels",
        path.join(dir, "graph"),
        "ChartRun",
      ]);
      const file = path.join(dir, "graph.dot");
      if (!(await fileExists(file))) {throw failed(drawn);}
      if (readVerdict(messagesOf(drawn.output)).distinct <= CHART_STATES) {
        const graph = parseDot(fileLines(file));
        const find = finder(graph, spec.variables);
        const drawing = drawn.status === CHILD_SUCCESS ? undefined : { status: drawn.status };
        const broken = new Set<string>();
        visitItems(verdicts.values(), ({ rule, outcome }) => {if (rule.kind === "invariant" && outcome === "broken") {broken.add(rule.name);}});
        const marks = only(readMarks(readMessages(fileLines(drawn.stdout)), tag), broken);
        const past = mark(graph, marks, { find, names: spec.variables, rules });
        const excludes = hasSection(spec, "ACTION_CONSTRAINT");
        visitItems(rules, (rule) => {
          const { outcome, messages } = must(verdicts, ruleKey(rule));
          if (
            rule.kind === "deadlock" &&
            outcome === "broken" &&
            !drawing &&
            !hasSection(spec, "CONSTRAINT", "ACTION_CONSTRAINT")
          )
            {deadEnds(graph, rule);}
          if (outcome !== "broken" || !messages) {return;}
          const counterexample = readCounterexample(messages);
          if (
            !drawing ||
            lasso(graph, { seq: counterexample, loop: undefined }, { find, names: spec.variables })
          )
            {addPast(graph, counterexample, { excludes, find, names: spec.variables, past, rule });}
        });
        const properties = propertiesWith((trace) => lasso(graph, trace, { find, names: spec.variables }));
        return {
          ...common,
          graph,
          paths: undefined,
          properties,
          drawing,
        };
      }
    }
    const drawn = pathGraph(spec.variables);
    const paths: Bug[] = [];
    visitItems(rules, (rule) => {
      const { outcome, messages } = must(verdicts, ruleKey(rule));
      if (outcome === "broken" && messages)
        {paths.push(drawn.bug(rule, readCounterexample(messages)));}
    });
    return {
      ...common,
      graph: drawn.graph,
      paths,
      properties: propertiesWith(drawn.lasso),
      drawing: undefined,
    };
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
};
