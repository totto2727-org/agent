import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../render.mjs";

test("CRLF is a delimiter in both formats, bare CR is data", () => {
  const input = " two \r\n\r\none\ninside\rname\n";
  assert.deepEqual(JSON.parse(render(input, "json", "Bearer fixture", "fixture")), [
    " two ",
    "one",
    "inside\rname",
  ]);
  assert.equal(render(input, "text", "Bearer fixture", "fixture"), " two \none\ninside\rname");
});
