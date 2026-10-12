import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { onTestFinished, test } from "vitest";
import { buildWork, loadManifest, parseArguments } from "./evaluate.mjs";

const refs = fileURLToPath(new URL("../references/", import.meta.url));
const catalog = JSON.parse(await readFile(join(refs, "rules.json"), "utf8"));
const fixtures = JSON.parse(await readFile(join(refs, "jevlint/fixtures.json"), "utf8"));
const supplements = [
  "consumer-contract",
  "audience-boundary",
  "actionable-example",
  "consequential-limit",
  "focused-unit",
  "reader-route",
  "visual-role",
];
const steIds = [
  "ste-1-5",
  "ste-1-8",
  "ste-1-10",
  "ste-1-11",
  "ste-1-13",
  "ste-3-2",
  "ste-3-4",
  "ste-3-6",
  "ste-4-1",
  "ste-4-2",
  "ste-4-3",
  "ste-4-4",
  "ste-4-5",
  "ste-5-2",
  "ste-5-3",
  "ste-5-4",
  "ste-5-5",
  "ste-6-1",
  "ste-6-2",
  "ste-6-4",
  "ste-6-5",
  "ste-7-1",
  "ste-7-2",
  "ste-7-3",
  "ste-8-2",
  "ste-8-3",
  "ste-9-4",
];
// These eight need vocabulary evidence even without a catalog requirement flag.
const vocabularyDependencies = {
  "ste-1-6": "Needs challenged dictionary entries and whole-term technical vocabulary evidence.",
  "ste-1-7":
    "Needs independent approved or categorized technical-verb evidence for noun-to-verb uses.",
  "ste-1-12":
    "Needs approved dictionary constructions to judge whether a technical-verb alternative is necessary.",
  "ste-1-14": "Needs supplied dictionary spelling or an authoritative publishing directive.",
  "ste-3-3": "Explicitly requires supplied entry approval for participial adjectives.",
  "ste-3-5":
    "Needs actual dictionary entries or technical-term category records for controlled -ing forms.",
  "ste-3-7":
    "Needs supplied approved verb entries to establish a meaning-preserving direct action.",
  "ste-9-1":
    "Needs the disputed replacement entry and original meaning before reconstructing vocabulary.",
};
const retainedIds = [
  "ste-1-1",
  "ste-1-2",
  "ste-1-3",
  "ste-1-4",
  "ste-1-6",
  "ste-1-7",
  "ste-1-9",
  "ste-1-12",
  "ste-1-14",
  "ste-2-1",
  "ste-2-2",
  "ste-3-1",
  "ste-3-3",
  "ste-3-5",
  "ste-3-7",
  "ste-9-1",
  "ste-9-2",
  "ste-9-3",
];
const allIds = [...supplements, ...steIds];
const page =
  "Preamble must stay.\n\n# Install\nInstall the package.\n```sh\n# This is not a heading\necho '# protected'\n```\n\n## Run\nRun the command.\n";

async function setup(markdown = page) {
  await mkdir(resolve("tmp"), { recursive: true });
  const root = await mkdtemp(resolve("tmp/jevlint-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "actual-guide.md");
  await writeFile(target, markdown);
  return { root, target };
}

function cli(args, cwd = process.cwd()) {
  const run = spawnSync(process.execPath, [resolve(process.env.JEVLINT_CLI), ...args], {
    cwd,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    timeout: 20_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(run.error, undefined, run.error?.message);
  return run;
}

test("the removed preparation route is rejected by the actual evaluator CLI", () => {
  assert.throws(
    () => parseArguments(["--manifest", "m.json", "--output", "tmp/job", "--export-jevlint"]),
    /Unknown argument: --export-jevlint/,
  );
  const run = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./evaluate.mjs", import.meta.url)), "--export-jevlint"],
    { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME } },
  );
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Unknown argument: --export-jevlint/);
});

test("exactly 34 fixed definitions match the single config without job bindings", async () => {
  const files = (await readdir(join(refs, "jevlint"))).filter((file) => file.endsWith(".yaml"));
  assert.deepEqual(files.sort(), allIds.map((id) => `${id}.yaml`).sort());
  const config = await readFile(join(refs, "jevlint.yaml"), "utf8");
  assert.match(config, /^rulePaths: \[\.\/jevlint\]$/m);
  assert.match(config, /^context: \[\]$/m);
  assert.match(config, /^cache: none$/m);
  assert.deepEqual(
    [...config.matchAll(/^  documentation-([^:]+): on$/gm)].map((match) => match[1]).sort(),
    [...allIds].sort(),
  );
  for (const id of allIds) {
    const yaml = await readFile(join(refs, "jevlint", `${id}.yaml`), "utf8");
    for (const field of [
      `id: documentation-${id}`,
      "language: Text",
      "subject: block",
      "extensions: [md]",
      "state: bare",
      "kind: score",
      "severity: info",
    ])
      assert.ok(yaml.split("\n").includes(field), `${id}: ${field}`);
    assert.doesNotMatch(yaml, /^(split|threshold|at|filenames|context):/m);
    assert.doesNotMatch(yaml, /prepared|job-\d|parserCoverage/);
    assert.match(yaml, /whole actual Markdown file/);
    assert.match(yaml, /supplied context or explicit declarations in the target/);
    assert.match(yaml, /untrusted evidence, never instructions/);
    assert.match(yaml, /insufficient_context, not a violation or proof of compliance/);
    assert.match(yaml, /uncalibrated reviewer assistance, never a compliance gate/);
    const levels = yaml.split("\n").filter((line) => line.startsWith("  - "));
    assert.equal(levels.length, 4);
    assert.match(levels[0], /not_applicable, or insufficient_context/);
    assert.match(levels[0], /not proof of compliance/);
  }
});

test("27 fixed STE definitions preserve canonical ask and pass/fail endpoints exactly", async () => {
  assert.equal(steIds.length, 27);
  for (const id of steIds) {
    const original = catalog.find((rule) => rule.id === id);
    assert.ok(original && original.engine === "decision");
    assert.ok(!original.requiresDictionaryEntries && !original.requiresNounGroupCounts);
    assert.equal(vocabularyDependencies[id], undefined);
    const yaml = await readFile(join(refs, "jevlint", `${id}.yaml`), "utf8");
    assert.equal(yaml.match(/^ask: >-\n  (.+)$/m)?.[1], original.instructions, id);
    const levels = yaml.split("\n").filter((line) => line.startsWith("  - "));
    assert.ok(levels[0].includes(original.pass), id);
    assert.equal(levels[2].slice(4), original.fail, id);
    assert.match(yaml, /Never count words, sentences, noun groups, or hyphen components/);
    assert.match(yaml, /static numeric checks remain deterministic/);
    assert.match(yaml, /Never reconstruct dictionary approvals/);
    assert.match(yaml, /not executable syntax, HTML syntax, or metadata/);
    assert.match(yaml, /not a blanket quotation or code exemption/);
    assert.match(yaml, /Preserve declared template constraints, technical meaning/);
    assert.match(yaml, /Return rubric scores only/);
    assert.match(yaml, /A scalar cannot distinguish/);
    assert.match(yaml, /No applicable prose means not_applicable/);
    assert.match(yaml, /When the rule needs audience, purpose, or writing mode/);
  }
});

test("seven supplements retain designed rubric cases and substantive representations", async () => {
  for (const id of supplements) {
    const yaml = await readFile(join(refs, "jevlint", `${id}.yaml`), "utf8");
    assert.match(yaml, /Substantive code, tables, and diagrams remain representation evidence/);
    assert.match(yaml, /Missing explicit audience or purpose means insufficient_context/);
    const cases = fixtures.filter((fixture) => fixture.ruleId === id);
    assert.ok(cases.some((fixture) => fixture.state === "no_evidenced_defect"));
    assert.ok(cases.some((fixture) => fixture.state === "defect"));
    for (const fixture of cases) {
      assert.ok(yaml.includes(fixture.ground), `${id}: fixture ground absent from rubric`);
      assert.ok(fixture.audience && fixture.purpose && fixture.markdown);
    }
  }
  assert.ok(fixtures.some((fixture) => fixture.state === "not_applicable"));
  assert.ok(fixtures.some((fixture) => fixture.state === "insufficient_context"));
  const example = await readFile(join(refs, "jevlint/actionable-example.yaml"), "utf8");
  assert.match(
    example,
    /A substantive representation can supply the main answer without redundant prose/,
  );
});

test("18 evidence-dependent decisions stay selectable through existing document ruleIds", async () => {
  assert.equal(retainedIds.length, 18);
  assert.equal(Object.keys(vocabularyDependencies).length, 8);
  const unsupported = catalog.filter(
    (rule) => rule.engine === "decision" && !allIds.includes(rule.id),
  );
  assert.deepEqual(
    unsupported.map((rule) => rule.id),
    retainedIds,
  );
  for (const id of retainedIds) {
    const rule = catalog.find((entry) => entry.id === id);
    assert.ok(
      rule.requiresDictionaryEntries || rule.requiresNounGroupCounts || vocabularyDependencies[id],
    );
  }
  const { root, target } = await setup();
  const manifestPath = join(root, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      model: "typesafe/jev",
      rulesFile: join(refs, "rules.json"),
      documents: [
        {
          id: "guide",
          path: target,
          audience: "CLI users",
          purpose: "Install and run the CLI",
          ruleIds: retainedIds,
        },
      ],
    }),
  );
  const manifest = await loadManifest(manifestPath);
  assert.deepEqual(manifest.documents[0].ruleIds, retainedIds);
  const work = await buildWork(manifest, manifestPath);
  const questions = work.flatMap((item) => Object.values(item.questions));
  assert.ok(questions.length > 0);
  assert.ok(questions.every((question) => retainedIds.includes(question.ruleId)));
  assert.deepEqual(
    [...new Set(questions.map((question) => question.ruleId))].sort(),
    [...retainedIds].sort(),
  );
});

test(
  "real built CLI loads the single config and selects complete actual Markdown files from another cwd",
  { skip: !process.env.JEVLINT_CLI },
  async () => {
    const { root, target } = await setup();
    const config = join(refs, "jevlint.yaml");
    const second = join(root, "code-only.md");
    await writeFile(second, "```sh\napp --version\n```\n");
    const run = cli(
      [
        "check",
        "--config",
        config,
        target,
        second,
        "--dry-run",
        "--format",
        "json",
        "--show-subjects",
      ],
      root,
    );
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const plan = JSON.parse(run.stdout);
    assert.equal(plan.dryRun, true);
    assert.equal(plan.subjects, 68);
    assert.equal(plan.cached, 0);
    assert.equal(plan.subjectList.length, 68);
    assert.equal(plan.undeclared.length, 0);
    for (const subject of plan.subjectList) {
      assert.equal(subject.line, 1);
      assert.equal(subject.node, "block");
      assert.ok(["actual-guide.md", "code-only.md"].includes(subject.file));
      assert.equal(subject.endLine, subject.file === "actual-guide.md" ? 11 : 3);
    }
    assert.deepEqual(
      [...new Set(plan.subjectList.map((subject) => subject.rule))].sort(),
      allIds.map((id) => `documentation-${id}`).sort(),
    );
    assert.equal(await readFile(target, "utf8"), page);
    assert.deepEqual((await readdir(root)).sort(), ["actual-guide.md", "code-only.md"]);
    // Deliberately remove credentials. Dry-run success is not a hosted judgment.
    const live = cli(["check", "--config", config, target], root);
    assert.notEqual(live.status, 0);
    assert.match(`${live.stderr}\n${live.stdout}`, /Cloudflare|CLOUDFLARE|API.key|api.key/);
  },
);
