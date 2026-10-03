import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { configureGateway, main } from "./configure-gateway.mjs";

const timestamp = "2026-10-03T02:18:11.000Z";
const marker = ".open-connector-managed";

function fixture(t, overrides = {}) {
  // Keep temporary artifacts inside the repository and remove only this fixture.
  const parent = join(import.meta.dirname, "../../../../../tmp");
  mkdirSync(parent, { recursive: true });
  const home = mkdtempSync(join(parent, "monid-profile-test-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const env = {
    OPENCONNECTOR_BASE_URL: "https://gateway.example.test/",
    OPENCONNECTOR_TOKEN: "fake-runtime-token-not-a-monid-key",
    XDG_CONFIG_HOME: join(home, "xdg"),
    ...overrides,
  };
  const root = join(env.XDG_CONFIG_HOME || join(home, ".config"), "open-connector-monid");
  const profile = join(
    root,
    createHash("sha256").update("https://gateway.example.test").digest("hex"),
  );
  return { home, env, root, profile, options: { home, env, now: new Date(timestamp) } };
}

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function mode(path) {
  return statSync(path).mode & 0o777;
}

test("writes exact native files and prints only the safe launch configuration", (t) => {
  const { options, env, root, profile } = fixture(t);
  let output = "";
  main(options, {
    write: (chunk) => {
      output += chunk;
    },
  });
  assert.deepEqual(JSON.parse(output), {
    apiBaseUrl: "https://gateway.example.test/v1/passthrough/monid",
    configHome: profile,
  });
  assert.equal(output.includes(env.OPENCONNECTOR_TOKEN), false);
  assert.equal(output.includes('"prefix"'), false);
  assert.equal(output.includes('"credentials"'), false);
  assert.deepEqual(json(join(profile, "monid/config.yaml")), {
    version: "0.1.7",
    active_key: "gateway",
    last_update_check: timestamp,
  });
  assert.deepEqual(json(join(profile, "monid/credentials.yaml")), {
    keys: { gateway: { key: env.OPENCONNECTOR_TOKEN, prefix: "gateway", added_at: timestamp } },
  });
  assert.deepEqual(readdirSync(profile).sort(), [marker, "monid"]);
  assert.deepEqual(readdirSync(join(profile, "monid")).sort(), ["config.yaml", "credentials.yaml"]);
  assert.equal(mode(profile), 0o700);
  assert.equal(mode(root), 0o700);
  assert.equal(mode(join(root, marker)), 0o600);
  assert.equal(mode(join(profile, "monid")), 0o700);
  for (const path of [marker, "monid/config.yaml", "monid/credentials.yaml"]) {
    assert.equal(mode(join(profile, path)), 0o600);
  }
});

test("preserves normal profiles and unrelated parent permissions", (t) => {
  const { options, env, home, profile } = fixture(t);
  for (const normal of [join(home, ".config/monid"), join(env.XDG_CONFIG_HOME, "monid")]) {
    mkdirSync(normal, { recursive: true });
    writeFileSync(join(normal, "config.yaml"), "user: existing YAML\n", { mode: 0o640 });
    writeFileSync(join(normal, "credentials.yaml"), "user: fake-existing-key\n", { mode: 0o640 });
  }
  chmodSync(env.XDG_CONFIG_HOME, 0o755);
  assert.equal(configureGateway(options).configHome, profile);
  assert.equal(mode(env.XDG_CONFIG_HOME), 0o755);
  for (const normal of [join(home, ".config/monid"), join(env.XDG_CONFIG_HOME, "monid")]) {
    assert.equal(readFileSync(join(normal, "config.yaml"), "utf8"), "user: existing YAML\n");
    assert.equal(
      readFileSync(join(normal, "credentials.yaml"), "utf8"),
      "user: fake-existing-key\n",
    );
    assert.equal(mode(join(normal, "credentials.yaml")), 0o640);
  }
});

test("uses the dedicated home config profile when XDG_CONFIG_HOME is absent", (t) => {
  const { options, profile } = fixture(t, { XDG_CONFIG_HOME: undefined });
  assert.equal(configureGateway(options).configHome, profile);
  assert.ok(existsSync(join(profile, "monid/credentials.yaml")));
});

const invalidOrigins = [
  undefined,
  "",
  "gateway.example.test",
  "http://gateway.example.test",
  "https:gateway.example.test",
  "https://user:password@gateway.example.test",
  "https://@gateway.example.test",
  "https://gateway.example.test/path",
  "https://gateway.example.test/../",
  "https://gateway.example.test//",
  "https://gateway.example.test?query=1",
  "https://gateway.example.test?",
  "https://gateway.example.test#",
  "https://gateway.example.test/#fragment",
  "https://gateway.example.test\\path",
  " https://gateway.example.test",
  "https://gateway.example.test\n",
];
for (const origin of invalidOrigins) {
  test(`rejects invalid origin ${JSON.stringify(origin)} before writing`, (t) => {
    const { options, home } = fixture(t, { OPENCONNECTOR_BASE_URL: origin });
    assert.throws(() => configureGateway(options), /complete HTTPS origin/u);
    assert.deepEqual(readdirSync(home), []);
  });
}

for (const token of [
  undefined,
  "",
  " ",
  "fake token",
  "fake\n",
  "fake\t",
  "fake\u0000",
  "fake\u007f",
  "fake\u0085",
  "fake\u200b",
]) {
  test(`rejects invalid token ${JSON.stringify(token)} before writing`, (t) => {
    const { options, home } = fixture(t, { OPENCONNECTOR_TOKEN: token });
    let output = "";
    assert.throws(
      () =>
        main(options, {
          write: (chunk) => {
            output += chunk;
          },
        }),
      /nonempty/u,
    );
    assert.equal(output, "");
    assert.deepEqual(readdirSync(home), []);
  });
}

test("rejects relative XDG_CONFIG_HOME before writing", (t) => {
  const { options, home } = fixture(t, { XDG_CONFIG_HOME: "relative" });
  assert.throws(() => configureGateway(options), /must be absolute/u);
  assert.deepEqual(readdirSync(home), []);
});

test("rejects existing unmarked and incorrectly marked profiles without altering them", (t) => {
  const { options, profile } = fixture(t);
  configureGateway(options);
  rmSync(profile, { recursive: true });
  mkdirSync(join(profile, "monid"), { recursive: true, mode: 0o755 });
  writeFileSync(join(profile, "monid/config.yaml"), "user: original\n");
  assert.throws(() => configureGateway(options), /unmanaged/u);
  assert.equal(existsSync(join(profile, marker)), false);
  writeFileSync(join(profile, marker), "not ours\n");
  assert.throws(() => configureGateway(options), /unmanaged/u);
  assert.equal(readFileSync(join(profile, marker), "utf8"), "not ours\n");
  assert.equal(readFileSync(join(profile, "monid/config.yaml"), "utf8"), "user: original\n");
  assert.equal(mode(profile), 0o755);
  assert.equal(existsSync(join(profile, "monid/credentials.yaml")), false);
});

test("rejects a symlinked managed root without touching its destination", (t) => {
  const { options, env, home, root } = fixture(t);
  const destination = join(home, "untouched");
  mkdirSync(destination);
  mkdirSync(env.XDG_CONFIG_HOME);
  symlinkSync(destination, root);
  assert.throws(() => configureGateway(options), /symlinks/u);
  assert.deepEqual(readdirSync(destination), []);
});

test("rejects an unmanaged intermediate root before writing", (t) => {
  const { options, root, profile } = fixture(t);
  mkdirSync(root, { recursive: true, mode: 0o755 });
  assert.throws(() => configureGateway(options), /unmanaged/u);
  assert.equal(mode(root), 0o755);
  assert.deepEqual(readdirSync(root), []);
  assert.equal(existsSync(profile), false);
});

for (const target of ["root-marker", "origin-profile"]) {
  test(`rejects symlinked ${target} without following it`, (t) => {
    const { options, root, profile, home } = fixture(t);
    configureGateway(options);
    const destination = join(home, "untouched");
    const path = target === "root-marker" ? join(root, marker) : profile;
    if (target === "root-marker") writeFileSync(destination, "outside sentinel\n");
    else mkdirSync(destination);
    rmSync(path, { recursive: true });
    symlinkSync(destination, path);
    assert.throws(() => configureGateway(options), /symlinks/u);
    if (target === "root-marker")
      assert.equal(readFileSync(destination, "utf8"), "outside sentinel\n");
    else assert.deepEqual(readdirSync(destination), []);
  });
}

for (const target of ["monid", marker, "monid/config.yaml", "monid/credentials.yaml"]) {
  test(`rejects symlink target ${target} before changing the owned profile`, (t) => {
    const { options, profile, home } = fixture(t);
    configureGateway(options);
    const destination = join(home, "untouched");
    if (target === "monid") mkdirSync(destination);
    else writeFileSync(destination, "outside sentinel\n", { mode: 0o644 });
    const path = join(profile, target);
    rmSync(path, { recursive: true });
    symlinkSync(destination, path);
    assert.throws(() => configureGateway(options), /symlinks/u);
    if (target === "monid") assert.deepEqual(readdirSync(destination), []);
    else {
      assert.equal(readFileSync(destination, "utf8"), "outside sentinel\n");
      assert.equal(mode(destination), 0o644);
    }
  });
}

test("rejects non-file targets without partial updates", (t) => {
  const { options, profile } = fixture(t);
  configureGateway(options);
  const path = join(profile, "monid/credentials.yaml");
  unlinkSync(path);
  mkdirSync(path);
  const original = readFileSync(join(profile, "monid/config.yaml"), "utf8");
  assert.throws(() => configureGateway(options), /unexpected file types/u);
  assert.equal(readFileSync(join(profile, "monid/config.yaml"), "utf8"), original);
});

test("updates owned profiles even after the CLI rewrites JSON as YAML", (t) => {
  const { options, env, profile } = fixture(t);
  configureGateway(options);
  const config = join(profile, "monid/config.yaml");
  const credentials = join(profile, "monid/credentials.yaml");
  writeFileSync(config, "version: 0.1.7\nactive_key: gateway\n");
  writeFileSync(credentials, "keys:\n  gateway:\n    key: fake-old-key\n");
  chmodSync(profile, 0o755);
  chmodSync(join(profile, "monid"), 0o755);
  chmodSync(credentials, 0o644);
  const oldInode = statSync(credentials).ino;
  env.OPENCONNECTOR_TOKEN = "fake-updated-runtime-token";
  env.OPENCONNECTOR_BASE_URL = "https://GATEWAY.EXAMPLE.TEST:443/";
  options.now = new Date("2026-10-04T00:00:00.000Z");
  assert.deepEqual(configureGateway(options), {
    apiBaseUrl: "https://gateway.example.test/v1/passthrough/monid",
    configHome: profile,
  });
  assert.equal(json(credentials).keys.gateway.key, env.OPENCONNECTOR_TOKEN);
  assert.equal(json(credentials).keys.gateway.added_at, options.now.toISOString());
  assert.equal(json(config).last_update_check, options.now.toISOString());
  assert.notEqual(statSync(credentials).ino, oldInode);
  assert.equal(mode(profile), 0o700);
  assert.equal(mode(join(profile, "monid")), 0o700);
  assert.equal(mode(credentials), 0o600);
  assert.deepEqual(readdirSync(join(profile, "monid")).sort(), ["config.yaml", "credentials.yaml"]);
});

for (const origin of ["https://gateway-b.example.test", "https://gateway.example.test:8443"]) {
  test(`isolates credentials for distinct origin ${origin}`, (t) => {
    const { options, env, root } = fixture(t);
    const launcherA = configureGateway(options);
    const filesA = ["config.yaml", "credentials.yaml"].map((name) =>
      join(launcherA.configHome, "monid", name),
    );
    const beforeA = filesA.map((path) => readFileSync(path, "utf8"));
    const launcherB = configureGateway({
      ...options,
      env: { ...env, OPENCONNECTOR_BASE_URL: origin, OPENCONNECTOR_TOKEN: "fake-gateway-b-token" },
    });
    assert.notEqual(launcherB.configHome, launcherA.configHome);
    assert.equal(
      launcherB.configHome,
      join(root, createHash("sha256").update(origin).digest("hex")),
    );
    assert.equal(launcherB.apiBaseUrl, `${origin}/v1/passthrough/monid`);
    assert.deepEqual(
      filesA.map((path) => readFileSync(path, "utf8")),
      beforeA,
    );
    assert.equal(json(filesA[1]).keys.gateway.key, env.OPENCONNECTOR_TOKEN);
    assert.equal(
      json(join(launcherB.configHome, "monid/credentials.yaml")).keys.gateway.key,
      "fake-gateway-b-token",
    );
    configureGateway({
      ...options,
      env: { ...env, OPENCONNECTOR_TOKEN: "fake-rotated-gateway-a-token" },
    });
    assert.equal(
      json(join(launcherB.configHome, "monid/credentials.yaml")).keys.gateway.key,
      "fake-gateway-b-token",
    );
    assert.equal(mode(root), 0o700);
    assert.equal(mode(launcherA.configHome), 0o700);
    assert.equal(mode(launcherB.configHome), 0o700);
  });
}

for (const invalid of [
  { OPENCONNECTOR_BASE_URL: "http://invalid-gateway.example.test" },
  { OPENCONNECTOR_TOKEN: "fake invalid runtime token" },
]) {
  test(`published bash launcher fails closed for invalid ${Object.keys(invalid)[0]}`, (t) => {
    const { home, env, root } = fixture(t, invalid);
    const skill = join(import.meta.dirname, "..");
    const markdown = readFileSync(join(skill, "SKILL.md"), "utf8");
    const block = [...markdown.matchAll(/```bash\n([\s\S]*?)\n```/gu)]
      .map((match) => match[1])
      .find((bash) => bash.includes("scripts/configure-gateway.mjs"));
    assert.ok(block, "The published native CLI launcher bash block must exist.");
    const bin = join(home, "bin");
    const task = join(home, "task");
    const called = join(home, "vpx-called");
    mkdirSync(bin);
    mkdirSync(task);
    writeFileSync(join(bin, "vpx"), '#!/bin/sh\nprintf invoked > "$STUB_CALLED"\n', {
      mode: 0o700,
    });
    const normalFiles = [];
    for (const normal of [join(home, ".config/monid"), join(env.XDG_CONFIG_HOME, "monid")]) {
      mkdirSync(normal, { recursive: true });
      for (const name of ["config.yaml", "credentials.yaml"]) {
        const path = join(normal, name);
        writeFileSync(path, "untouched: fake-user-profile\n", { mode: 0o600 });
        normalFiles.push(path);
      }
    }
    const result = spawnSync("bash", ["--noprofile", "--norc", "-c", block], {
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        HOME: home,
        ...env,
        MONID_SKILL_DIR: skill,
        TASK_TMP: task,
        STUB_CALLED: called,
      },
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unable to configure the managed Monid gateway profile/u);
    assert.equal(`${result.stdout}${result.stderr}`.includes(env.OPENCONNECTOR_TOKEN), false);
    assert.equal(existsSync(called), false, "Invalid setup must never invoke even the stub CLI.");
    assert.equal(existsSync(root), false);
    for (const path of normalFiles) {
      assert.equal(readFileSync(path, "utf8"), "untouched: fake-user-profile\n");
      assert.equal(mode(path), 0o600);
    }
  });
}
