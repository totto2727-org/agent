# Effront Frontend

| Concern                                        | Selected technology                            |
| ---------------------------------------------- | ---------------------------------------------- |
| RSC, SSR, Server Functions, browser navigation | Effront                                        |
| HTTP integration                               | Effront's native Effect HTTP integration       |
| Infrastructure integration                     | Effront's separate Alchemy adapter             |
| UI components                                  | Base UI-based shadcn/ui, not the Radix variant |

- For conditional exports and adapter compatibility, prefer the installed [effront skill](https://github.com/totto2727-org/effront/blob/main/skills/effront/SKILL.md). Check its peer requirements alongside the [stack dependency safeguards](share.md#dependency-versions).
- Compose the Alchemy adapter with native Effect HTTP, not a second HTTP server.
- Keep request-specific services outside a process-wide runtime under [ManagedRuntime conventions](../knowledge/effect/services-runtime.md#managedruntime).
- Verify that shadcn/ui generator or registry output uses Base UI.
- Select form and client-state libraries only for explicit requirements.
- Apply [IME-safe submission](../knowledge/ime-safe-enter-submit.md) to custom Enter-to-submit behavior.
