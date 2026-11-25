// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to preserve the bytes and UTF-8 boundaries in the host's streams.
import { Buffer } from "node:buffer";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { execFile, spawn } from 'node:child_process';
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to type the real subprocess status and streams.
import type { ChildProcess, ExecFileException, SpawnOptions } from 'node:child_process';
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to generate the native run's independent marker using the host's entropy source.
import { randomBytes } from "node:crypto";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- Await the standalone tool's temporary files before starting each native checker.
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { boundRun, chartRun, configText } from "./backends/cfg.ts";
import { plainText } from "./backends/plain-text.ts";
import { readConfig } from "./frontends/config.ts";
import { parseDot, splitLines } from "./frontends/dot.ts";
import { readCounterexample, readMarks } from "./frontends/marks.ts";
import { readMessages } from "./frontends/messages.ts";
import { initialOnlyProperties, readChecks, readSany, readSpec } from "./frontends/spec.ts";
import { readTrace } from "./frontends/trace.ts";
import { readVerdict } from './frontends/verdict.ts';
import type { Break } from './frontends/verdict.ts';
import { CHART_STATES, LEVEL, PART, RERUN_STATES, hasObjectType, hasSection, isNumber, isString, matchesNull, matchesUndefined, must, ruleKey, stateRules, visitItems } from './ir.ts';
import type { Bug, CheckResult, ConfigSection, Lasso, Mark, Outcome, Output, Part, Property, Rule, Stop, Trace, Verdict } from './ir.ts';
import { addPast, deadEnds, finder, lasso, mark } from "./passes/annotate.ts";
import { pathGraph } from "./passes/paths.ts";
import { hostEnvironment } from "#statechart/host-env.ts";

export const fileExists = async (file: string): Promise<boolean> => {
  try {
    // Deno 2.0 never resolves the Node compatibility layer's access promise.
    await stat(file);
    return true;
  } catch {
    return false;
  }
};

const BUFFER_START = 0;
const NEXT_BYTE = 1;
const LINE_FEED_BYTE = 10;
const NO_LINE_FEED = -1;
const BUFFER_GROWTH = 2;
// oxlint-disable-next-line unicorn/no-null -- A null read position advances the native descriptor's cursor.
const CURRENT_POSITION = null;

interface LineBuffer {
  bytes: Buffer;
  kept: number;
}

const readFileBlock = (descriptor: number, buffer: LineBuffer): number => {
  if (buffer.kept === buffer.bytes.length) {
    buffer.bytes = Buffer.concat([buffer.bytes], buffer.bytes.length * BUFFER_GROWTH);
  }
  // oxlint-disable-next-line node/no-sync -- The synchronous line iterator preserves the parser's existing streaming input contract.
  return fs.readSync(descriptor, buffer.bytes, buffer.kept, buffer.bytes.length - buffer.kept, CURRENT_POSITION);
};

const completedLines = function* (buffer: LineBuffer, end: number): Generator<string> {
  const newline = buffer.bytes.lastIndexOf(LINE_FEED_BYTE, end - NEXT_BYTE);
  if (newline === NO_LINE_FEED) {
    buffer.kept = end;
    return;
  }
  yield* splitLines(buffer.bytes.toString("utf8", BUFFER_START, newline));
  buffer.kept = buffer.bytes.copy(buffer.bytes, BUFFER_START, newline + NEXT_BYTE, end);
};

const lineBlocks = function* (descriptor: number): Generator<string> {
  const buffer: LineBuffer = { bytes: Buffer.allocUnsafe(PART), kept: BUFFER_START };
  // oxlint-disable-next-line rules/no-for-loops -- Yield line blocks as the lexer asks for them, stopping when the native read reaches EOF.
  for (;;) {
    const read = readFileBlock(descriptor, buffer);
    if (!read) {break;}
    yield* completedLines(buffer, buffer.kept + read);
  }
  yield* splitLines(buffer.bytes.toString("utf8", BUFFER_START, buffer.kept));
};

export const fileLines = function* (file: string): Generator<string> {
  // oxlint-disable-next-line node/no-sync -- Open the source on the same synchronous iterator used by the native lexer.
  const descriptor = fs.openSync(file, "r");
  try {
    yield* lineBlocks(descriptor);
  } finally {
    // oxlint-disable-next-line node/no-sync -- Close the native descriptor on iterator completion and cancellation.
    fs.closeSync(descriptor);
  }
};

const TLC_TOOL =
  "http:tla2tools[url=https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar,checksum=sha256:936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88]@1.7.4";
const JAVA_TOOL = "java@temurin-25";
export const PINNED_FLAGS = ["-workers", "1", "-fp", "0", "-lncheck", "final"];
const CHART_TAG_BYTES = 16;
const SANY_ERRORS = /^\*\*\* ?(?:Errors|Abort messages|Parse Error)/mu;

interface ChildResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error: ExecFileException | undefined;
}

interface ChildOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
  windowsHide?: boolean;
}

const MAX_CAPTURE_BYTES = 1_073_741_824;
const CHILD_SUCCESS = 0;
const TLC_VIOLATION_STATUSES = new Set([11, 12, 13]);
const CHECK_PASSED = 0;
const CHECK_VIOLATION = 1;
const CHECK_FAILED = 2;
// oxlint-disable-next-line unicorn/no-null -- Native subprocess results report a null status for signal or launch failure.
const NO_NATIVE_STATUS = null;

const exitStatus = (error: ExecFileException | null): number | null => {
  if (!error) {return CHILD_SUCCESS;}
  return isNumber(error.code) ? error.code : NO_NATIVE_STATUS;
};

export const runChild = async (file: string, args: string[], options: ChildOptions): Promise<ChildResult> => {
  const { promise, resolve } = Promise.withResolvers<ChildResult>();
  execFile(
    file,
    args,
    { encoding: "utf8", maxBuffer: MAX_CAPTURE_BYTES, windowsHide: true, ...options },
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Capture exit status, stdout, and stderr together through the native execFile callback.
    (error, stdout, stderr) => {
      // oxlint-disable-next-line eslint/sort-keys -- Keep the native subprocess result's established field order.
      resolve({ status: exitStatus(error), stdout, stderr, error: isString(error?.code) ? error : undefined });
    },
  );
  return promise;
};

export const messageOf = (error: unknown): string =>
  hasObjectType(error) &&
  !matchesNull(error) &&
  "message" in error &&
  isString(error.message)
    ? error.message
    : inspect(error);

interface OutputFile {
  descriptor: number;
  size: number;
}

const outputFile = (file: string): OutputFile => {
  // oxlint-disable-next-line node/no-sync -- Keep the descriptor available to repeated synchronous replays after stage cleanup removes its path.
  const descriptor = fs.openSync(file, "r");
  // oxlint-disable-next-line node/no-sync -- Capture the byte length with the descriptor before handing the output to its readers.
  return { descriptor, size: fs.fstatSync(descriptor).size };
};

const outputBytes = function* ({ descriptor, size }: OutputFile): Generator<Uint8Array> {
  const position = { offset: BUFFER_START };
  while (position.offset < size) {
    const bytes = Buffer.allocUnsafe(Math.min(PART, size - position.offset));
    // oxlint-disable-next-line node/no-sync -- Each replay reads from the captured descriptor at its own byte offset.
    const read = fs.readSync(descriptor, bytes, BUFFER_START, bytes.length, position.offset);
    if (!read) {break;}
    position.offset += read;
    yield bytes.subarray(BUFFER_START, read);
  }
};

const joined = (files: string[]): Output => {
  const opened: OutputFile[] = [];
  visitItems(files, (file) => {opened.push(outputFile(file));});
  return {
    *[Symbol.iterator](): Generator<Uint8Array> {
      // oxlint-disable-next-line rules/no-for-loops -- Keep artifact replays ordered and yield bounded file slices without buffering the complete stream.
      for (const artifact of opened) {yield* outputBytes(artifact);}
    },
  };
};

const utf8 = new TextDecoder("utf-8", { ignoreBOM: true });

const outputLines = function* outputLines(output: Output) {
  let rest: Uint8Array = new Uint8Array();
  for (const part of output) {
    const buf = rest.length ? Buffer.concat([rest, part]) : part;
    const cut = buf.lastIndexOf(LINE_FEED_BYTE);
    if (cut === NO_LINE_FEED) {
      rest = buf;
      continue;
    }
    yield* splitLines(utf8.decode(buf.subarray(BUFFER_START, cut)));
    rest = buf.subarray(cut + NEXT_BYTE);
  }
  yield* splitLines(utf8.decode(rest));
};

const messagesOf = (output: Output): Iterable<Part> => ({
  [Symbol.iterator]: () => readMessages(outputLines(output)),
});

interface FileResult {
  status: number | null;
  stdout: string;
  output: Output;
  error: Error | undefined;
}

type ArtifactPaths = [stdout: string, stderr: string];

const launchWithArtifacts = (
  command: { args: string[]; file: string },
  files: ArtifactPaths,
  options: SpawnOptions,
): ChildProcess => {
  const descriptors: number[] = [];
  try {
    visitItems(files, (artifact) => {
      // oxlint-disable-next-line node/no-sync -- Open these descriptors on the same turn as the native spawn that inherits them.
      descriptors.push(fs.openSync(artifact, "w"));
    });
    return spawn(command.file, command.args, { ...options, stdio: ["ignore", ...descriptors], windowsHide: true });
  } finally {
    visitItems(descriptors, (descriptor) => {
      // oxlint-disable-next-line node/no-sync -- Release the parent's copies before attaching the native child's event handlers.
      fs.closeSync(descriptor);
    });
  }
};

const runToFiles = async (
  file: string,
  args: string[],
  { out, ...options }: { out: string; cwd: string; env: NodeJS.ProcessEnv },
): Promise<FileResult> => {
  const files: ArtifactPaths = [`${out}.stdout`, `${out}.stderr`];
  const child = launchWithArtifacts({ args, file }, files, options);
  const { promise, resolve } = Promise.withResolvers<FileResult>();
  const [stdout] = files;
  const observed: { error?: Error } = {};
  const settle = (code: number | null): void => {
    const { error } = observed;
    // oxlint-disable-next-line eslint/sort-keys -- Keep the native file result's field order.
    resolve({ status: error ? NO_NATIVE_STATUS : code, stdout, output: joined(files), error });
  };
  child.on("error", (error) => {
    observed.error = error;
    if (matchesUndefined(child.pid)) {settle(NO_NATIVE_STATUS);}
  });
  child.on("close", (code) => {
    if (!matchesUndefined(child.pid)) {settle(code);}
  });
  return promise;
};

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
  const kept: string[] = [];
  let size = 0;
  visitItems(plainText(messagesOf(processResult.output)), (chunk) => {
    kept.push(chunk);
    size += chunk.length;
    while (size - kept[0].length >= MAX_TAIL_CHARACTERS) {size -= kept.shift()!.length;}
  });
  return kept.join("").trim().split("\n").slice(-TAIL_LINE_COUNT).join("\n");
};

const firstLines = (text: string): string => {
  const lines = text.trim().split("\n");
  if (lines.length > HEAD_LINE_COUNT) {lines.splice(HEAD_LINE_COUNT, Infinity, `... ${lines.length - HEAD_LINE_COUNT} more lines`);}
  return lines.join("\n");
};

const stopOf = (processResult: FileResult): Stop => {
  const errors: Part[] = [];
  visitItems(processResult.error ? [] : messagesOf(processResult.output), (part) => {if (
      !isString(part) &&
      (part.level === LEVEL.ERROR ||
        part.level === LEVEL.TLCBUG ||
        (errors.length && part.level === LEVEL.STATE))
    )
      {errors.push(part);}});
  if (!errors.length) {return { status: processResult.status, message: tail(processResult) };}
  return { status: processResult.status, message: firstLines([...plainText(errors)].join("")) };
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

const brokenRule = (rules: Rule[], broke: Break) => {
  if (broke.kind === "temporal") {return undefined;}
  for (const rule of rules)
    {if (rule.kind === broke.kind && (broke.kind === "deadlock" || rule.name === broke.name))
      {return rule;}}
  if (broke.kind === "invariant")
    {for (const rule of rules) {if (rule.kind === "property" && rule.name === broke.name) {return rule;}}}
  return undefined;
};

const only = function* only(marks: Iterable<Mark>, rules: Set<string>) {
  for (const { values, broken } of marks) {
    const kept: string[] = [];
    visitItems(broken, (name) => {if (rules.has(name)) {kept.push(name);}});
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
