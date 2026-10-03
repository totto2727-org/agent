#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const markerName = ".open-connector-managed";
const markerContents = "open-connector-monid native profile v1\n";

function inspect(path, directory = false) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile())) {
    throw new Error("Managed profile targets must not be symlinks or unexpected file types.");
  }
  return true;
}

function inspectOwnedDirectory(path) {
  if (!inspect(path, true)) return false;
  const marker = join(path, markerName);
  if (!inspect(marker)) throw new Error("Refusing an unmanaged existing profile.");
  const fd = openSync(marker, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (readFileSync(fd, "utf8") !== markerContents)
      throw new Error("Refusing an unmanaged existing profile.");
  } finally {
    closeSync(fd);
  }
  return true;
}

function replacePrivate(path, contents) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let fd;
  let created = false;
  try {
    fd = openSync(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    created = true;
    fchmodSync(fd, 0o600);
    writeFileSync(fd, contents);
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (created) rmSync(temporary, { force: true });
  }
}

export function configureGateway({ env = process.env, home = homedir(), now = new Date() } = {}) {
  const base = env.OPENCONNECTOR_BASE_URL;
  let origin;
  try {
    const url = new URL(base);
    if (
      !/^https:\/\/[^/?#\\\s@]+\/?$/iu.test(base) ||
      url.username ||
      url.password ||
      url.protocol !== "https:"
    ) {
      throw new Error();
    }
    origin = url.origin;
  } catch {
    throw new Error(
      "OPENCONNECTOR_BASE_URL must be a complete HTTPS origin without credentials, query, fragment, or path.",
    );
  }
  const token = env.OPENCONNECTOR_TOKEN;
  if (typeof token !== "string" || !token || /[\s\p{Cc}\p{Cf}]/u.test(token)) {
    throw new Error(
      "OPENCONNECTOR_TOKEN must be nonempty and contain no whitespace or control characters.",
    );
  }
  const baseHome = env.XDG_CONFIG_HOME || join(home, ".config");
  if (!isAbsolute(baseHome)) throw new Error("XDG_CONFIG_HOME must be absolute.");
  const root = join(baseHome, "open-connector-monid");
  const configHome = join(root, createHash("sha256").update(origin).digest("hex"));
  const directory = join(configHome, "monid");
  const config = join(directory, "config.yaml");
  const credentials = join(directory, "credentials.yaml");
  const timestamp = now.toISOString();
  const managedDirectories = [root, configHome];
  const existing = managedDirectories.map(inspectOwnedDirectory);
  inspect(directory, true);
  inspect(config);
  inspect(credentials);
  mkdirSync(baseHome, { recursive: true, mode: 0o700 });
  for (const [index, path] of managedDirectories.entries()) {
    if (!existing[index]) mkdirSync(path, { mode: 0o700 });
    chmodSync(path, 0o700);
    replacePrivate(join(path, markerName), markerContents);
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  replacePrivate(
    config,
    `${JSON.stringify({ version: "0.1.7", active_key: "gateway", last_update_check: timestamp })}\n`,
  );
  replacePrivate(
    credentials,
    `${JSON.stringify({ keys: { gateway: { key: token, prefix: "gateway", added_at: timestamp } } })}\n`,
  );
  return { apiBaseUrl: `${origin}/v1/passthrough/monid`, configHome };
}

export function main(options, output = process.stdout) {
  output.write(`${JSON.stringify(configureGateway(options))}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch {
    console.error("Unable to configure the managed Monid gateway profile.");
    process.exitCode = 1;
  }
}
