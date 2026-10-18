# MoonBit CLI Addition

| Selected technology                                    | Role                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [MoonBit baseline](share.md)                           | Compiler, dependencies, targets, codecs                             |
| [Admiral](https://mooncakes.io/docs/totto2727/admiral) | New CLI command definitions, dispatch, and documented help fallback |

## Input conversion

- Reuse typed option definitions for registration and extraction.
- Convert Admiral context into typed command input at the callback boundary, with explicit fallback precedence.
- Keep payload reads, domain parsing, request encoding, and transport outside option conversion.
- Keep maintained command compatibility contracts.
- No universal HTTP client selected.

- Audience: advanced MoonBit CLI consumers.
- JSON contracts: [codec boundaries](../knowledge/json.md).
- Admiral adapter contracts: [input and request boundaries](../knowledge/cli.md).
- Output and exit contracts: [mbt-test](../../../mbt-test/SKILL.md).
