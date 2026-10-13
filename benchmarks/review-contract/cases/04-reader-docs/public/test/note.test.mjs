import test from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../cli.mjs";

test("unique tags preserve order", () => {
  assert.deepEqual(summarize("#b\n\n#a\n#b\n"), { lines: 3, tags: ["b", "a"] });
});
