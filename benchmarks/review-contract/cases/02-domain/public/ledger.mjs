export class Seat {
  constructor(id, owner) {
    this.id = id;
    this.owner = owner;
  }
}

class OrderedBag {
  rows = [];
  set(id, owner) {
    const row = this.rows.find((row) => row.id === id);
    if (row) row.owner = owner;
    else this.rows.push({ id, owner });
  }
}

export function readSeats(text) {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) throw new Error("Expected array");
  return rows.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      typeof row.owner !== "string"
    )
      throw new Error("Invalid row");
    return new Seat(row.id, row.owner);
  });
}

export function summarize(seats) {
  const bag = new OrderedBag();
  for (const seat of seats) {
    if (!seat.id || !seat.owner) continue;
    bag.set(seat.id, seat.owner);
  }
  return bag.rows.map((row) => ({ ...row }));
}
