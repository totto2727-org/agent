import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../cli.mjs";
import { peek } from "../runtime.mjs";

test("existing explicit timeout and managed quota", async () => {
  assert.equal(parseArgs(["--timeout", "900"]).timeout, 900);
  let request;
  assert.equal(
    await peek(
      async (value) => {
        request = value;
        return { label: "箱" };
      },
      { profile: "managed", timeout: 900 },
      "Bearer fixture",
    ),
    '{"label":"箱"}',
  );
  assert.equal(request.concurrency, 2);
  assert.equal(request.authorization, "Bearer fixture");
});
