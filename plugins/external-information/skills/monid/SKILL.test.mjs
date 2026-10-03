import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import test from "node:test";

const markdown = readFileSync(join(import.meta.dirname, "SKILL.md"), "utf8");
const commands = [...markdown.matchAll(/```bash\n([\s\S]*?)\n```/gu)]
  .map((match) => match[1])
  .join("\n");

function fixture(t, overrides = {}) {
  const parent = join(import.meta.dirname, "../../../../tmp");
  mkdirSync(parent, { recursive: true });
  const home = mkdtempSync(join(parent, "monid-usage-test-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const bin = join(home, "bin");
  const task = join(home, "task");
  const normal = join(home, ".config/monid");
  const log = join(home, "calls.jsonl");
  for (const path of [bin, task, normal]) mkdirSync(path, { recursive: true });
  for (const name of ["config.yaml", "credentials.yaml"])
    writeFileSync(join(normal, name), "untouched: user-profile\n", { mode: 0o600 });
  writeFileSync(
    join(bin, "monid"),
    `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify({
  args: process.argv.slice(2),
  baseUrl: process.env.MONID_API_BASE_URL,
  configHome: process.env.XDG_CONFIG_HOME
}) + "\\n");
console.log(JSON.stringify({ok: true}));
`,
    { mode: 0o700 },
  );
  return {
    home,
    task,
    normal,
    log,
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:${process.env.PATH}`,
      XDG_CONFIG_HOME: join(home, ".config"),
      OPENCONNECTOR_BASE_URL: "https://gateway.example.test/",
      OPENCONNECTOR_TOKEN: 'fake-runtime-token"with\\escaping',
      TASK_TMP: task,
      CALL_LOG: log,
      ...overrides,
    },
  };
}

function run(env) {
  return spawnSync("bash", ["--noprofile", "--norc", "-c", commands], {
    env,
    encoding: "utf8",
    timeout: 10_000,
  });
}

function assertNormalProfileUnchanged(normal) {
  for (const name of ["config.yaml", "credentials.yaml"])
    assert.equal(readFileSync(join(normal, name), "utf8"), "untouched: user-profile\n");
}

test("configures once and passes the proxy URL to each normal installed CLI invocation", (t) => {
  const { env, task, normal, log } = fixture(t);
  const result = run(env);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(commands, /vpx|configure-gateway|monid\s*\(\s*\)/u);
  const calls = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(
    calls.map((call) => call.args),
    [
      ["whoami", "--json"],
      ["inspect", "--provider", "tinyfish", "--endpoint", "/search", "--json"],
    ],
  );
  assert.ok(
    calls.every((call) => call.baseUrl === "https://gateway.example.test/v1/passthrough/monid"),
  );
  assert.equal(calls[0].configHome, calls[1].configHome);
  const profile = calls[0].configHome;
  assert.ok(profile.startsWith(`${task}/monid.`));
  const configPath = join(profile, "monid/config.yaml");
  const credentialsPath = join(profile, "monid/credentials.yaml");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8"));
  assert.equal(config.active_key, "gateway");
  assert.equal(config.version, "0.1.7");
  assert.ok(Number.isFinite(Date.parse(config.last_update_check)));
  assert.equal(credentials.keys.gateway.key, env.OPENCONNECTOR_TOKEN);
  assert.equal(credentials.keys.gateway.prefix, "gateway");
  assert.ok(Number.isFinite(Date.parse(credentials.keys.gateway.added_at)));
  for (const path of [profile, join(profile, "monid")])
    assert.equal(statSync(path).mode & 0o777, 0o700);
  for (const path of [configPath, credentialsPath])
    assert.equal(statSync(path).mode & 0o777, 0o600);
  for (const name of ["monid-whoami.json", "search-schema.json"])
    assert.deepEqual(JSON.parse(readFileSync(join(task, name), "utf8")), { ok: true });
  assert.equal(`${result.stdout}${result.stderr}`.includes(env.OPENCONNECTOR_TOKEN), false);
  assertNormalProfileUnchanged(normal);
});

for (const overrides of [
  { OPENCONNECTOR_BASE_URL: "" },
  { OPENCONNECTOR_TOKEN: "" },
  { TASK_TMP: "" },
  { OPENCONNECTOR_BASE_URL: "http://gateway.example.test" },
]) {
  test(`stops before CLI execution with ${JSON.stringify(overrides)}`, (t) => {
    const { env, normal, log } = fixture(t, overrides);
    const result = run(env);
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(log), false);
    if (env.OPENCONNECTOR_TOKEN)
      assert.equal(`${result.stdout}${result.stderr}`.includes(env.OPENCONNECTOR_TOKEN), false);
    assertNormalProfileUnchanged(normal);
  });
}

test("failed temporary-profile creation never uses the normal profile", (t) => {
  const { env, home, normal, log } = fixture(t);
  env.TASK_TMP = join(home, "missing/task");
  const result = run(env);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(log), false);
  assertNormalProfileUnchanged(normal);
});
