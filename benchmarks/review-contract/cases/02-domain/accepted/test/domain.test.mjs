import test from "node:test";
import assert from "node:assert/strict";
import { Seat, readSeats, summarize } from "../ledger.mjs";

test("constructor owns invariants, boundary rejects bad rows", () => {
  assert.deepEqual(summarize([new Seat(" a ", " Ada ")]), [{ id: "a", owner: "Ada" }]);
  for (const value of ["", " ", null, 5]) assert.throws(() => new Seat(value, "Ada"));
  const seat = new Seat("a", "Ada");
  try {
    seat.id = "";
  } catch {}
  assert.equal(seat.id, "a");
  assert.throws(() => readSeats('[{"id":"a","owner":false}]'));
  assert.throws(() => readSeats('[{"id":" ","owner":"Ada"}]'));
});
