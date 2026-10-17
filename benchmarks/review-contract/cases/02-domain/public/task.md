# Establish domain guarantees

Seat Ledger summarizes ordered seat assignments.
Make every constructed Seat have a nonempty trimmed string id and a nonempty trimmed string owner. Invalid arguments must throw, and later assignment must not invalidate these guarantees.
Remove redundant checks inside `summarize` once construction guarantees them, and replace the custom OrderedBag with a standard collection.
Accept an iterable of valid Seat objects. The last owner for a duplicate id wins, while that id keeps its first insertion position. Return detached plain `{ id, owner }` rows.
Keep external JSON validation: the payload must be an array of objects with string id and owner fields. Ignore extra fields, but reject invalid rows rather than filtering them out.
Preserve the already-correct order semantics and add constructor, boundary, and duplicate tests.
