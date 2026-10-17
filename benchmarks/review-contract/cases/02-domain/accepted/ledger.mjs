function field(value) {
  if (typeof value !== "string" || value.trim() === "") throw new Error("Invalid seat field");
  return value.trim();
}

export class Seat {
  constructor(id, owner) {
    this.id = field(id);
    this.owner = field(owner);
    Object.freeze(this);
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
  const owners = new Map();
  for (const seat of seats) owners.set(seat.id, seat.owner);
  return Array.from(owners, ([id, owner]) => ({ id, owner }));
}
