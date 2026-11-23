# Effront Frontend

| Concern                                        | Selected technology                            |
| ---------------------------------------------- | ---------------------------------------------- |
| RSC, SSR, Server Functions, browser navigation | Effront                                        |
| HTTP integration                               | Effront's native Effect HTTP integration       |
| Infrastructure integration                     | Effront's separate Alchemy adapter             |
| UI components                                  | Base UI-based shadcn/ui, not the Radix variant |

- Use [Effront integration knowledge](../knowledge/effront.md) for conditional exports and adapter compatibility.
- Compose the Alchemy adapter with native Effect HTTP, not a second HTTP server.
- Keep request-specific services outside a process-wide runtime under [ManagedRuntime conventions](../knowledge/effect/services-runtime.md#managedruntime).
- Verify that shadcn/ui generator or registry output uses Base UI.
- Select form and client-state libraries only for explicit requirements.
- Apply [IME-safe submission](../../../js-coding/references/ime-safe-enter-submit.md) to custom Enter-to-submit behavior.
