# Effect CLI

| Concern                             | Selected technology                            |
| ----------------------------------- | ---------------------------------------------- |
| Commands, argument parsing, help    | Effect CLI                                     |
| Filesystem, process, HTTP, terminal | Installed Effect platform APIs where available |
| Packaging                           | [Shared JS toolchain](share.md)                |

- Check CLI exports against the [installed Effect version](../knowledge/effect.md#official-sources-and-version-checks), not an older `@effect/cli` example.
- Use Effect CLI instead of hand-written `process.argv` parsing or another CLI framework.
- Keep Promise conversion at required host or SDK adapters.
