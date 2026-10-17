# Seat Ledger maintenance

This fixture uses Node 24 ESM without dependencies.
Run `node --test test/*.test.mjs` from this repository.
Keep `Seat`, `readSeats`, and `summarize` exports stable.
Use standard collections when they provide the required ordering and lookup behavior.
Validate untrusted JSON separately from domain construction.
