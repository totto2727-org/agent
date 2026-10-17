import test from "node:test";
import assert from "node:assert/strict";
import { Seat, readSeats, summarize } from "../ledger.mjs";

test("last value wins without reordering", () => {
  assert.deepEqual(
    summarize([new Seat("b", "one"), new Seat("a", "two"), new Seat("b", "three")]),
    [
      { id: "b", owner: "three" },
      { id: "a", owner: "two" },
    ],
  );
  assert.throws(() => readSeats('{"id":"a","owner":"one"}'));
});
