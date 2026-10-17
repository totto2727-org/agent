import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../render.mjs";

test("LF order and authorization", () => {
  assert.equal(render("two\n\none\n", "json", "Bearer fixture", "fixture"), '["two","one"]');
  assert.throws(() => render("", "text", "", "fixture"));
  assert.throws(() => render("one", "yaml", "Bearer fixture", "fixture"));
});
