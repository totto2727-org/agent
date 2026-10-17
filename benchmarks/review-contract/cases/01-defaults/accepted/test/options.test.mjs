import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../cli.mjs";
import { peek } from "../runtime.mjs";

test("removed options are rejected and transport defaults are inherited", async () => {
  for (const [key, value] of [
    ["encoding", "utf8"],
    ["retries", "0"],
    ["format", "json"],
  ]) {
    assert.throws(() => parseArgs([`--${key}`, value]));
  }
  assert.deepEqual(parseArgs([]), { timeout: 500 });
  let request;
  await peek(async (value) => {
    request = value;
    return {};
  });
  assert.equal(Object.hasOwn(request, "encoding"), false);
  assert.equal(Object.hasOwn(request, "retries"), false);
  assert.throws(() => parseArgs(["--timeout", "0"]));
});
