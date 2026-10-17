import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const manifest = JSON.parse(await readFile(new URL("./manifest.json", import.meta.url), "utf8"));

// The coordinator must call this in a disposable sandbox: importing candidate code is execution.
// A fresh process per score prevents module caches and candidate state from crossing trials.
export async function evaluate(caseId, workspace) {
  const fixture = manifest.cases.find((fixture) => fixture.id === caseId);
  if (!fixture) throw new Error(`Unknown case: ${caseId}`);
  if (!isAbsolute(workspace)) throw new Error("Workspace must be absolute");
  const checks = [];
  const check = async (id, operation) => {
    try {
      await operation();
      checks.push({ id, pass: true });
    } catch (error) {
      checks.push({ id, pass: false, detail: String(error.message) });
    }
  };
  const load = (file) =>
    import(`${pathToFileURL(join(workspace, file)).href}?trial=${randomUUID()}`);
  const unchanged = async (file) => {
    const original = await readFile(new URL(`${fixture.publicRoot}/${file}`, import.meta.url));
    assert.deepEqual(await readFile(join(workspace, file)), original);
  };

  await check("public-tests", () => {
    const result = spawnSync(process.execPath, ["--test", "test/*.test.mjs"], {
      cwd: workspace,
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr + result.stdout);
  });

  await check("module-contract", async () => {
    if (caseId === "01-defaults") {
      const { parseArgs } = await load("cli.mjs");
      const { peek } = await load("runtime.mjs");
      await check("removed-cli-options", () => {
        for (const [key, value] of [
          ["encoding", "utf8"],
          ["retries", "0"],
          ["format", "json"],
        ]) {
          assert.throws(() => parseArgs([`--${key}`, value]));
        }
        assert.throws(() => parseArgs(["--other", "x"]));
      });
      await check("timeout-contract", async () => {
        assert.equal(parseArgs([]).timeout, 500);
        assert.equal(parseArgs(["--timeout", "901"]).timeout, 901);
        for (const value of ["0", "-1", "1.5", "NaN", ""])
          assert.throws(() => parseArgs(["--timeout", value]));
        assert.throws(() => parseArgs(["--timeout"]));
        for (const timeout of [0, -1, 1.5, "500", NaN]) {
          await assert.rejects(async () => peek(async () => ({}), { timeout }));
        }
      });
      await check("transport-default-inheritance", async () => {
        let request;
        const output = await peek(async (value) => {
          request = value;
          return { label: "箱", count: 2 };
        });
        assert.deepEqual(JSON.parse(output), { label: "箱", count: 2 });
        assert.equal(request.timeout, 500);
        for (const key of ["encoding", "retries", "format", "concurrency"])
          assert.equal(Object.hasOwn(request, key), false, `Unneeded transport override: ${key}`);
      });
      await check("permitted-customization-and-auth", async () => {
        let request;
        await peek(
          async (value) => {
            request = value;
            return {};
          },
          { profile: "managed", timeout: 901 },
          "Bearer example",
        );
        assert.equal(request.concurrency, 2);
        assert.equal(request.timeout, 901);
        assert.equal(request.authorization, "Bearer example");
        await assert.rejects(
          () =>
            peek(async () => {
              throw new Error("Transport failed");
            }),
          /Transport failed/,
        );
      });
    } else if (caseId === "02-domain") {
      const { Seat, readSeats, summarize } = await load("ledger.mjs");
      await check("constructor-normalization", () => {
        const seat = new Seat(" a ", " Ada ");
        assert.equal(seat.id, "a");
        assert.equal(seat.owner, "Ada");
      });
      await check("constructor-rejection", () => {
        for (const invalid of ["", " \t ", null, undefined, 0, {}, []]) {
          assert.throws(() => new Seat(invalid, "Ada"));
          assert.throws(() => new Seat("a", invalid));
        }
      });
      await check("assignment-invariants", () => {
        for (const key of ["id", "owner"]) {
          const seat = new Seat("a", "Ada");
          for (const value of ["", " ", null, 0]) {
            try {
              seat[key] = value;
            } catch {}
            assert.equal(typeof seat[key], "string");
            assert.notEqual(seat[key].trim(), "");
            assert.equal(seat[key], seat[key].trim());
          }
          try {
            seat[key] = " trimmed ";
          } catch {}
          assert.equal(seat[key], seat[key].trim());
        }
      });
      await check("external-domain-rejection", () => {
        for (const input of [
          "null",
          "{}",
          "[null]",
          "[1]",
          '[{"id":"a"}]',
          '[{"id":"a","owner":5}]',
          '[{"id":" ","owner":"Ada"}]',
          "not json",
        ])
          assert.throws(() => readSeats(input));
        const seats = readSeats('[{"id":" a ","owner":" Ada ","extra":true}]');
        assert.equal(seats[0].id, "a");
        assert.equal(seats[0].owner, "Ada");
      });
      await check("already-correct-order-and-detachment", () => {
        const seats = [
          new Seat("b", "one"),
          new Seat("a", "two"),
          new Seat("b", "three"),
          new Seat("__proto__", "safe"),
        ];
        function* iterable() {
          yield* seats;
        }
        const rows = summarize(iterable());
        assert.deepEqual(rows, [
          { id: "b", owner: "three" },
          { id: "a", owner: "two" },
          { id: "__proto__", owner: "safe" },
        ]);
        assert.equal(Object.getPrototypeOf(rows[0]), Object.prototype);
        rows[0].owner = "changed";
        assert.equal(summarize(seats)[0].owner, "three");
        assert.deepEqual(summarize([]), []);
      });
    } else if (caseId === "03-local-fix") {
      const { render } = await load("render.mjs");
      const input = " two \r\n\r\none\ninside\rname\n";
      await check("crlf-json", () =>
        assert.deepEqual(JSON.parse(render(input, "json", "Bearer fixture", "fixture")), [
          " two ",
          "one",
          "inside\rname",
        ]),
      );
      await check("crlf-text", () =>
        assert.equal(
          render(input, "text", "Bearer fixture", "fixture"),
          " two \none\ninside\rname",
        ),
      );
      await check("already-correct-output-contract", () => {
        for (const [source, rows] of [
          ["b\n\na\n", ["b", "a"]],
          ["", []],
          ["\r", ["\r"]],
          [" \n", [" "]],
        ]) {
          assert.deepEqual(JSON.parse(render(source, "json", "Bearer fixture", "fixture")), rows);
          assert.equal(render(source, "text", "Bearer fixture", "fixture"), rows.join("\n"));
        }
        assert.throws(() => render("a", "yaml", "Bearer fixture", "fixture"));
      });
      await check("security-counterexamples", async () => {
        const { authorize } = await load("auth.mjs");
        for (const token of [
          "",
          "fixture",
          "bearer fixture",
          "Bearer fixture ",
          "Bearer other",
          undefined,
        ]) {
          assert.throws(() => authorize(token, "fixture"));
          for (const format of ["text", "json"])
            assert.throws(() => render("", format, token, "fixture"));
        }
        for (const expected of ["", undefined, null, 3])
          assert.throws(() => authorize("Bearer ", expected));
        assert.doesNotThrow(() => authorize("Bearer fixture", "fixture"));
      });
      await check("release-check-contract", async () => {
        const { releaseCheck } = await load("ci-contract.mjs");
        assert.deepEqual(releaseCheck, {
          nodeMajor: 24,
          command: ["node", "--test", "test/*.test.mjs"],
          install: false,
        });
      });
    } else {
      await check("docs-only-boundary", async () => {
        await unchanged("cli.mjs");
        await unchanged("note.txt");
      });
      const { summarize } = await load("cli.mjs");
      await check("already-correct-summary", () =>
        assert.deepEqual(summarize("#b\r\n\n#a\n#b\n text \n"), { lines: 4, tags: ["b", "a"] }),
      );
      for (const [file, id] of [
        ["README.md", "english-example"],
        ["README.ja.md", "japanese-example"],
      ]) {
        await check(id, async () => {
          const doc = await readFile(join(workspace, file), "utf8");
          const commands = [
            ...doc.matchAll(/```(?:sh|bash|shell)?[ \t]*\r?\n([^]*?)\r?\n```/g),
          ].map((match) => match[1].trim());
          assert.ok(commands.length > 0, "Missing runnable shell example");
          for (const command of commands) {
            // Do not execute arbitrary shell prose. Only the declared local CLI boundary is allowed.
            const tokens = command
              .split(/\s+/)
              .map((token) => token.replace(/^(["'])(.*)\1$/, "$2"));
            assert.equal(tokens[0], "node");
            assert.match(tokens[1], /^(?:\.\/)?cli\.mjs$/);
            assert.equal(tokens.length, 4);
            assert.match(tokens[3], /^(?:\.\/)?note\.txt$/);
            const result = spawnSync(process.execPath, tokens.slice(1), {
              cwd: workspace,
              encoding: "utf8",
              timeout: 3000,
            });
            assert.equal(result.status, 0, result.stderr);
            const actual = JSON.parse(result.stdout);
            assert.deepEqual(actual, { lines: 4, tags: ["handoff", "urgent"] });
            const outputs = [...doc.matchAll(/```json\s*\n([^]*?)\n```/g)].map((match) =>
              JSON.parse(match[1]),
            );
            assert.ok(outputs.length > 0, "Missing documented JSON output");
            assert.ok(
              outputs.some((output) => {
                try {
                  assert.deepEqual(output, actual);
                  return true;
                } catch {
                  return false;
                }
              }),
              "Documented output does not match actual CLI result",
            );
          }
        });
      }
    }
  });
  return {
    caseId,
    deterministicPass: checks.every((check) => check.pass),
    checks,
    reviewRequired: fixture.reviewCriteria,
  };
}
