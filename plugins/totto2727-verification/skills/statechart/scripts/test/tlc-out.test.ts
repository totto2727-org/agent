// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to launch the real programs whose stdout, stderr and status are consumed.
import { spawn } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to await the actual child and stream events.
import { once } from "node:events";
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
import { plainText } from "#statechart/backends/plain-text.ts";
import { readMessages } from "#statechart/frontends/messages.ts";
import { visitItems } from "#statechart/ir.ts";
import { hostEnvironment } from "#statechart/host-env.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const corpus = path.join(here, "corpus");
const skip = !hostEnvironment().TLA2TOOLS && "set TLA2TOOLS to the path of tla2tools.jar to run TLC";
const read = (file: string): string => fs.readFileSync(file, "utf8");
const maybe = (file: string): string => (fs.existsSync(file) ? read(file) : "");
const plain = (text: string): string => [...plainText(readMessages(text))].join("");

const steady = (text: string): string =>
  text
    .replaceAll(/"chart-[0-9a-f]{32}"/gu, '"chart"')
    .replaceAll(/\bfp \d+ and seed -?\d+/gu, "fp _ and seed _")
    .replaceAll(/\[pid: \d+\]/gu, "[pid: _]")
    .replaceAll(/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/gu, "_")
    .replaceAll(/ \([\d,]+ d?s\/min\)/gu, "")
    .replaceAll(/ in (?:\d+d \d\dh|\d\dh \d\dmin|\d\dmin \d\ds|\d\ds) at /gu, " in _ at ");

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test(
  "each corpus spec's TLC output reads as plain TLC prints it at -workers 1",
  { concurrency: 4, skip },
  async (testContext) => {
    await Promise.all(
      (await fs.promises.readdir(corpus)).map((name) =>
        testContext.test(name, async () => {
          const dir = path.join(corpus, name);
          const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "statechart-plain-"));
          const [tool, twin, out] = ["tool", "plain", "out"].map((f) => path.join(tmp, f));
          await fs.promises.mkdir(tool);
          await fs.promises.mkdir(twin);
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
                ...hostEnvironment(),
                JAVA: path.join(here, "java.ts"),
                STATECHART_JAVA: hostEnvironment().JAVA ?? "java",
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
          const runs = (await fs.promises.readdir(twin)).filter((fileName) => fileName.endsWith(".out"));
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
          visitItems(await fs.promises.readdir(out), (fileName) => {if (/^tlc-\w+\.out$/u.test(fileName))
              {assert.ok(verdicts.has(steady(read(path.join(out, fileName)))), fileName);}});
        }),
      ),
    );
  },
);
