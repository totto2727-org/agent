// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { spawnSync } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to select the host's real temporary directory.
import os from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to convert local module URLs with the host platform's path rules.
import { fileURLToPath } from "node:url";
import { configText } from "#statechart/backends/cfg.ts";
import { readConfig } from "#statechart/frontends/config.ts";
import { readChecks } from '#statechart/frontends/spec.ts';
import type { Checks } from '#statechart/frontends/spec.ts';
import { isRecord, visitItems } from "#statechart/ir.ts";
import { hostEnvironment } from "#statechart/host-env.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const skip = !hostEnvironment().TLA2TOOLS && "set TLA2TOOLS to the path of tla2tools.jar to run TLC";
const SEED = 1;
const CONFIGS = 4000;
const KEYWORDS =
  "CONSTANT CONSTANTS CONSTRAINT CONSTRAINTS ACTION_CONSTRAINT ACTION_CONSTRAINTS INVARIANT INVARIANTS PROPERTY PROPERTIES INIT NEXT SPECIFICATION VIEW SYMMETRY TYPE TYPE_CONSTRAINT CHECK_DEADLOCK".split(
    " ",
  );
const ONE_NAME = ["INIT", "NEXT", "SPECIFICATION", "VIEW", "SYMMETRY", "TYPE", "TYPE_CONSTRAINT"];
const NAMES = [
  "Init",
  "Next",
  "Spec",
  "Inv",
  "TypeOK",
  "Live",
  "V",
  "x1",
  "_a",
  "INIT2",
  "Next_INIT",
];
const VALUES = [
  "0",
  "7",
  "TRUE",
  "m1",
  '"a b"',
  '"INVARIANT (* x"',
  String.raw`"\\* y *)"`,
  String.raw`"\""`,
  "{}",
  "{1, 2}",
  '{"p", "q"}',
  "{m1, m2}",
];
const SPACES = [" ", " ", "\t", "  "];
const BREAKS = ["\n", "\n", "\r\n", "\r", "\n\n"];
const GAPS = [...SPACES, ...BREAKS, ""];
const ODD_SPACES = ["", "\u00A0", "\u2028", "\u2029", "\u0085"];
const COMMENTS = [
  "\\* CHECK_DEADLOCK FALSE\n",
  "\\* CHECK_DEADLOCK FALSE\r",
  "\\* CHECK_DEADLOCK FALSE\r\n",
  "(* CHECK_DEADLOCK FALSE *)",
  "(* (* INVARIANT Hidden *) CHECK_DEADLOCK FALSE *)",
  "(**)",
  '(* " *)',
];
const INSERTS = [
  "(* CHECK_DEADLOCK FALSE",
  "*)",
  '"open',
  ",",
  "=",
  "<-",
  "{",
  "1",
  "foo",
  "invariant",
  "ALIAS",
  "POSTCONDITION",
  "\\",
  String.raw`"a\qb"`,
];
const NAME = /^\w*[A-Za-z]\w*$/u;
const MODEL = [
  "CONSTANT",
  "CONSTRAINT",
  "ACTION_CONSTRAINT",
  "INIT",
  "NEXT",
  "SPECIFICATION",
  "VIEW",
  "SYMMETRY",
  "TYPE",
  "TYPE_CONSTRAINT",
];

type Reading = Record<string, unknown>;

const tableOf = (reading: Reading) => {
  if (!isRecord(reading.table)) {throw new Error(`TLC printed no table: ${JSON.stringify(reading)}`);}
  return reading.table;
};

const mulberry32 = function (seed: number) {
  return () => {
    seed = (seed + 0x6D_2B_79_F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const generate = function (random: () => number) {
  const int = (n: number): number => Math.floor(random() * n);
  const pick = <T>(list: T[]) => list[int(list.length)];
  const section = (key: string) => {
    const out = [{ gap: pick(BREAKS), text: key }];
    const add = (text: string): number => out.push({ gap: pick(SPACES), text });
    if (key === "CHECK_DEADLOCK") {add(pick(["TRUE", "FALSE"]));}
    else if (ONE_NAME.includes(key)) {add(pick(NAMES));}
    else if (key.startsWith("CONSTANT")) {for (let n = 1 + int(2); n--;) {
        const form = pick(["=", "<-", "<-[M]"]);
        add(pick(["N", "K", "S"]));
        add(form.slice(0, 2));
        if (form === "<-[M]") {add("[M]");}
        add(form === "=" ? pick(VALUES) : pick(NAMES));
      }}
    else
      {for (let n = 1 + int(3); n--;) {add(pick(NAMES));}}
    return out;
  };
  const tokens = pick([["SPECIFICATION"], ["INIT", "NEXT"]]).flatMap((key) => section(key));
  for (let n = int(4); n--;) {tokens.splice(pick([0, tokens.length]), 0, ...section(pick(KEYWORDS)));}
  for (let n = int(3); n--;)
    {tokens.splice(int(tokens.length + 1), 0, { gap: pick(GAPS), text: pick(COMMENTS) });}
  const mutations = int(4);
  for (let n = mutations; n--;) {
    const kind = pick(["typo", "case", "space", "insert", "drop", "section"]);
    const t = tokens[int(tokens.length)];
    const at = int(tokens.length + 1);
    if (kind === "typo") {
      const k = int(t.text.length);
      t.text =
        t.text.slice(0, k) +
        pick(["", "E", "_", "0", ",", t.text[k] + t.text[k]]) +
        t.text.slice(k + 1);
    } else if (kind === "case")
      {t.text = pick([t.text.toLowerCase(), t.text[0] + t.text.slice(1).toLowerCase()]);}
    else if (kind === "space") {t.gap = pick(ODD_SPACES);}
    else if (kind === "insert")
      {tokens.splice(at, 0, { gap: pick(GAPS), text: pick(pick([INSERTS, KEYWORDS])) });}
    else if (kind === "drop" && tokens.length > 1) {tokens.splice(at % tokens.length, 1);}
    else if (kind === "section") {tokens.splice(at, 0, ...section(pick(KEYWORDS)));}
  }
  let text = "";
  visitItems(tokens, (token) => {text += token.gap + token.text;});
  return { text: `${text}\n`, mutated: mutations > 0 };
};

const readInTlc = function (files: string[], jar: string) {
  const commandResult = spawnSync(
    hostEnvironment().JAVA || "java",
    ["-cp", jar, path.join(here, "ConfigOracle.java")],
    { input: `${files.join("\n")}\n`, encoding: "utf8", maxBuffer: 1 << 30 },
  );
  assert.equal(commandResult.status, 0, commandResult.error?.message ?? commandResult.stderr);
  const lines = commandResult.stdout.split("\n");
  const readings = new Map<string, Reading>();
  for (let i = 0; i < files.length; i++) {
    const reading: unknown = JSON.parse(lines[i]);
    if (!isRecord(reading)) {throw new Error(`TLC printed ${lines[i]}`);}
    readings.set(files[i], reading);
  }
  return readings;
};

const passesTlcStartChecks = function (reading: Reading): boolean {
  if (reading.error) {return false;}
  const table = tableOf(reading);
  for (const key of ["INVARIANT", "PROPERTY", "CONSTRAINT", "ACTION_CONSTRAINT"]) {
    const names: unknown = table[key];
    if (!Array.isArray(names)) {throw new Error(`TLC printed no list for ${key}.`);}
    for (const name of names) {if (!NAME.test(String(name))) {return false;}}
  }
  for (const key of ["INIT", "NEXT", "SPECIFICATION", "VIEW", "SYMMETRY"])
    {if (table[key] && !NAME.test(String(table[key]))) {return false;}}
  return table.SPECIFICATION ? !table.INIT && !table.NEXT : Boolean(table.INIT);
};

const model = function (reading: Reading | undefined) {
  if (!reading || reading.error) {return reading;}
  const { overrides, modConstants, modOverrides } = reading;
  const table = tableOf(reading);
  const out: Reading = { overrides, modConstants, modOverrides };
  visitItems(MODEL, (key) => {out[key] = table[key];});
  return out;
};

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  `${CONFIGS} configs from seed ${SEED} read in the skill as in TLC, or stop before TLC runs`,
  { skip },
  async (testContext) => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-config-fuzz-"));
    testContext.after(async () => {await fs.promises.rm(dir, { recursive: true });});
    const random = mulberry32(SEED);
    const cases: {
      i: number;
      text: string;
      mutated: boolean;
      skill: Checks | Error;
      file: string;
      written: string;
    }[] = [];
    const files: string[] = [];
    for (let i = 0; i < CONFIGS; i++) {
      const { text, mutated } = generate(random);
      const file = path.join(dir, `${i}.cfg`);
      fs.writeFileSync(file, text);
      files.push(file);
      const written = path.join(dir, `${i}-written.cfg`);
      let skill: Checks | Error;
      try {
        skill = readChecks({ configFile: file, config: readConfig({ file, text }) });
        fs.writeFileSync(written, configText(skill.written, []));
        files.push(written);
      } catch (error) {
        if (!(error instanceof Error)) {throw error;}
        skill = error;
      }
      cases.push({ i, text, mutated, skill, file, written });
    }
    const tlc = readInTlc(files, String(hostEnvironment().TLA2TOOLS));
    visitItems(cases, ({ i, text, mutated, skill, file, written }) => {
      const want = tlc.get(file);
      assert.ok(want, `TLC printed nothing for config ${i}`);
      const where = `config ${i} of seed ${SEED}: ${JSON.stringify(text)}\nTLC reads ${JSON.stringify(want)}`;
      if (skill instanceof Error) {
        if (skill.message.startsWith("TLC refuses"))
          {assert.ok(!passesTlcStartChecks(want), `The skill says TLC refuses ${where}`);}
        else
          {assert.ok(
            mutated && skill.message.startsWith("The command cannot read"),
            `${skill.message}\n${where}`,
          );}
        return;
      }
      assert.ok(passesTlcStartChecks(want), `The skill reads ${where}`);
      assert.deepEqual(
        {
          invariants: skill.invariants,
          properties: skill.properties,
          deadlock: skill.deadlock,
          model: model(tlc.get(written)),
        },
        {
          invariants: tableOf(want).INVARIANT,
          properties: tableOf(want).PROPERTY,
          deadlock: want.deadlock,
          model: model(want),
        },
        where,
      );
    });
  },
);
