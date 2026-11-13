# Admiral Adapter Boundaries

- Audience: advanced consumers implementing [Admiral](https://mooncakes.io/docs/totto2727/admiral) callbacks.
- Reuse typed option definitions for registration and extraction, not parallel string names.
- Use the resolved callback contract.
- Async callbacks alone do not require an extra task group.

| Boundary               | Contract                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| Context conversion     | Callback or command-local conversion function only                |
| Required values        | Reject missing or malformed values with exact cardinality         |
| Input modes            | Enum for mutually exclusive modes                                 |
| Downstream operations  | No raw-context reads or credential resolution after conversion    |
| Service requests       | Domain result to request-specific struct to encoding to transport |
| Pass-through responses | Opaque bytes unless a field-dependent decision requires decoding  |

- Resolve option, positional, configuration, and environment precedence during context conversion.
- Distinguish absent from invalid values when optional getters collapse them.
- Typed command input represents validated intent, not a remote request body.
- Keep request and response types distinct.
- JSON omission and explicit `null`: [codec boundaries](json.md).
