// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports, vitest/no-import-node-test -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { plainText } from "../backends/plain-text.ts";
import { readMessages } from "../frontends/messages.ts";
import { visitItems } from "../ir.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const corpus = path.join(here, "corpus");
const skip = !process.env.TLA2TOOLS && "set TLA2TOOLS to the path of tla2tools.jar to run TLC";
const read = (file: string): string => fs.readFileSync(file, "utf8");
const maybe = (file: string): string => (fs.existsSync(file) ? read(file) : "");
const plain = (text: string): string => [...plainText(readMessages(text))].join("");

const steady = (text: string): string =>
  text
    .replaceAll(/"chart-[0-9a-f]{32}"/gu, '"chart"')
    .replaceAll(/\bfp \d+ and seed -?\d+/g, "fp _ and seed _")
    .replaceAll(/\[pid: \d+\]/gu, "[pid: _]")
    .replaceAll(/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/gu, "_")
    .replaceAll(/ \([\d,]+ d?s\/min\)/g, "")
    .replaceAll(/ in (?:\d+d \d\dh|\d\dh \d\dmin|\d\dmin \d\ds|\d\ds) at /g, " in _ at ");

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "each corpus spec's TLC output reads as plain TLC prints it at -workers 1",
  { concurrency: 4, skip },
  async (testContext) => {
    await Promise.all(
      fs.readdirSync(corpus).map((name) =>
        testContext.test(name, async () => {
          const dir = path.join(corpus, name);
          const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "statechart-plain-"));
          const [tool, twin, out] = ["tool", "plain", "out"].map((f) => path.join(tmp, f));
          fs.mkdirSync(tool);
          fs.mkdirSync(twin);
          const view = path.join(dir, "view.mjs");
          const child = spawn(
            process.execPath,
            [
              path.join(here, "../statechart.ts"),
              path.join(dir, `${name}.tla`),
              ...(fs.existsSync(view) ? ["--view", view] : []),
              "--out",
              out,
            ],
            {
              env: {
                ...process.env,
                JAVA: path.join(here, "java.ts"),
                STATECHART_JAVA: process.env.JAVA ?? "java",
                STATECHART_RECORD: tool,
                STATECHART_PLAIN: twin,
              },
              stdio: ["ignore", "ignore", "pipe"],
            },
          );
          let stderr = "";
          child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
          await once(child, "close");
          assert.equal(stderr, "");
          const runs = fs.readdirSync(twin).filter((fileName) => fileName.endsWith(".out"));
          assert.ok(runs.includes("ChartRun.out"), "the drawing run has a plain twin");
          visitItems(runs, (run) => {
            const exit = run.replace(/\.out$/u, ".exit");
            assert.equal(maybe(path.join(tool, exit)), maybe(path.join(twin, exit)), exit);
            assert.equal(
              steady(plain(read(path.join(tool, run)))),
              steady(read(path.join(twin, run))),
              run,
            );
          });
          assert.equal(
            steady(read(path.join(out, "tlc.out"))),
            steady(`${read(path.join(twin, "verdict-1.out"))}\n`),
          );
          const verdicts = new Set<string>();
          visitItems(runs, (run) => {if (run.startsWith("verdict-")) {verdicts.add(steady(`${read(path.join(twin, run))}\n`));}});
          visitItems(fs.readdirSync(out), (fileName) => {if (/^tlc-\w+\.out$/u.test(fileName))
              {assert.ok(verdicts.has(steady(read(path.join(out, fileName)))), fileName);}});
        }),
      ),
    );
  },
);
