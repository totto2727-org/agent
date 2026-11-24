# MoonBit CLI Addition

| Selected technology                                    | Role                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [MoonBit baseline](share.md)                           | Compiler, dependencies, targets, codecs                             |
| [Admiral](https://mooncakes.io/docs/totto2727/admiral) | New CLI command definitions, dispatch, and documented help fallback |

## Input conversion

- Use the installed [Admiral skill](https://github.com/totto2727-org/admiral/blob/main/.agents/skills/admiral/SKILL.md) for option definitions, input precedence, and callback getters. If it is unavailable, consult the [package guide](https://github.com/totto2727-org/admiral/blob/main/README.mbt.md#defining-options-and-positions).
- Pass typed command input to application code, not the CLI context.
- Keep payload reads, domain parsing, request encoding, and transport outside option conversion.
- Keep maintained command compatibility contracts.
- No universal HTTP client selected.

- Audience: advanced MoonBit CLI consumers.
- JSON contracts: [codec boundaries](../knowledge/json.md).
- Output and exit contracts: [mbt-test](../../../mbt-test/SKILL.md).
