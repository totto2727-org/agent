import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { evaluate } from "./oracle.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const temporaryRoot = resolve(root, "../../tmp");

for (const fixture of manifest.cases) {
  test(`${fixture.id}: initial has real behavioral failures, accepted overlay passes`, async (t) => {
    await mkdir(temporaryRoot, { recursive: true });
    const trial = await mkdtemp(join(temporaryRoot, "review-contract-"));
    t.after(() => rm(trial, { recursive: true, force: true }));
    const initial = join(trial, "initial");
    const accepted = join(trial, "accepted");
    await cp(join(root, fixture.publicRoot), initial, { recursive: true });
    await cp(join(root, fixture.publicRoot), accepted, { recursive: true });
    await cp(join(root, fixture.acceptedOverlay), accepted, { recursive: true, force: true });
    const before = await evaluate(fixture.id, initial);
    assert.equal(before.checks.find((check) => check.id === "public-tests").pass, true);
    assert.equal(before.deterministicPass, false);
    const failures = before.checks.filter((check) => !check.pass).map((check) => check.id);
    assert.deepEqual(
      failures.sort(),
      [...fixture.initialFailureChecks].sort(),
      JSON.stringify(before),
    );
    const after = await evaluate(fixture.id, accepted);
    assert.equal(after.deterministicPass, true, JSON.stringify(after));
    const alternate = join(trial, "alternate");
    const mutant = join(trial, "mutant");
    await cp(accepted, alternate, { recursive: true });
    await cp(accepted, mutant, { recursive: true });
    const change = async (directory, file, from, to) => {
      const path = join(directory, file);
      const source = await readFile(path, "utf8");
      assert.ok(source.includes(from), `Missing trial transformation: ${from}`);
      await writeFile(path, source.replace(from, to));
    };
    let rejectedCheck;
    if (fixture.id === "01-defaults") {
      await change(
        alternate,
        "runtime.mjs",
        "const request = { timeout: options.timeout ?? 500, authorization }",
        "const request = Object.assign({ authorization }, { timeout: options.timeout ?? 500 })",
      );
      await change(mutant, "runtime.mjs", "request.concurrency = 2", "void 0");
      rejectedCheck = "permitted-customization-and-auth";
    } else if (fixture.id === "02-domain") {
      await change(
        alternate,
        "ledger.mjs",
        "Object.freeze(this)",
        "Object.defineProperties(this, { id: { writable: false, configurable: false }, owner: { writable: false, configurable: false } })",
      );
      await change(
        alternate,
        "ledger.mjs",
        "return Array.from(owners, ([id, owner]) => ({ id, owner }))",
        "const rows = []\n  for (const [id, owner] of owners) rows.push({ id, owner })\n  return rows",
      );
      await change(
        mutant,
        "ledger.mjs",
        "return Array.from(owners, ([id, owner]) => ({ id, owner }))",
        "return Array.from(owners, ([id, owner]) => ({ id, owner })).sort((a, b) => a.id.localeCompare(b.id))",
      );
      rejectedCheck = "already-correct-order-and-detachment";
    } else if (fixture.id === "03-local-fix") {
      await change(
        alternate,
        "render.mjs",
        String.raw`input.split(/\r?\n/)`,
        String.raw`input.replaceAll('\r\n', '\n').split('\n')`,
      );
      await change(
        mutant,
        "render.mjs",
        String.raw`input.split(/\r?\n/)`,
        String.raw`input.replaceAll('\r', '').split('\n')`,
      );
      rejectedCheck = "crlf-json";
    } else {
      await change(
        alternate,
        "README.md",
        "Lumen Note summarizes a local note for a support handoff. It does not diagnose incidents.",
        "Prepare a support handoff with Lumen Note, a local note summarizer. Incident diagnosis is outside its purpose.",
      );
      await change(
        alternate,
        "README.ja.md",
        "Lumen Note は、サポートの引き継ぎ用にローカルのノートを要約します。インシデントの診断はしません。",
        "サポートの引き継ぎに使う Lumen Note は、ローカルのノートを要約するツールです。インシデントの診断は対象外です。",
      );
      await change(mutant, "README.md", "--local", "--remote");
      rejectedCheck = "english-example";
    }
    const alternativeResult = await evaluate(fixture.id, alternate);
    assert.equal(alternativeResult.deterministicPass, true, JSON.stringify(alternativeResult));
    if (fixture.id === "04-reader-docs") {
      for (const [index, label] of ["bash", "shell", ""].entries()) {
        const shellVariant = join(trial, `shell-${index}`);
        await cp(alternate, shellVariant, { recursive: true });
        for (const file of ["README.md", "README.ja.md"]) {
          await change(shellVariant, file, "```sh", `\`\`\`${label}`);
          await change(
            shellVariant,
            file,
            "node cli.mjs --local note.txt",
            "node ./cli.mjs --local './note.txt'",
          );
        }
        const shellResult = await evaluate(fixture.id, shellVariant);
        assert.equal(shellResult.deterministicPass, true, JSON.stringify(shellResult));
      }
    }
    const mutantResult = await evaluate(fixture.id, mutant);
    assert.equal(
      mutantResult.checks.find((check) => check.id === rejectedCheck).pass,
      false,
      JSON.stringify(mutantResult),
    );
    t.diagnostic(
      JSON.stringify({
        caseId: fixture.id,
        initialFailures: failures,
        acceptedChecks: after.checks.length,
        legalAlternativePass: true,
        rejectedMutant: rejectedCheck,
      }),
    );
  });
}
