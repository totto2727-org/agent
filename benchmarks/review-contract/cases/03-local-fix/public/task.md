# Fix CRLF records locally

Dock Queue turns newline-separated job names into text or JSON.
CRLF input currently leaks a carriage return into a job name. Fix line-ending handling for both outputs at the shared record boundary.
The contract accepts LF and CRLF delimiters, omits empty records, preserves spaces in names, preserves a bare CR inside a name, and does not trim data generally.
Keep output order, output format selection, and exact bearer-token authorization unchanged. Unauthorized calls must still fail for empty input.
Add a regression test covering both formats and a bare-CR counterexample.
Update both README.md and docs/output.md to explain the same semantics for text and JSON.
Keep the fix local. Do not refactor authentication, change the release-check contract, or introduce dependencies.
