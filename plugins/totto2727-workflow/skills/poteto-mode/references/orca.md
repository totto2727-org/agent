# Select an Orca execution route

Orca manages workspaces, terminals, and supervised workers. A harness executes the assignment. Do not infer a harness, model, or permissions from a workspace name.

## Discover before launch

Prefer the installed official [orca-cli](https://github.com/stablyai/orca) and [orchestration](https://github.com/stablyai/orca) skills. Follow their discovery stubs to select the executable and load its version-matched guides. If the stubs are missing, consult the [official Orca site](https://orca.dev/) and use the guides shipped by the selected executable. On Linux outside an Orca terminal, do not invoke bare `orca`: that name can start the GNOME screen reader.

Replace `ORCA` with that executable in these examples:

```text
ORCA skills get orca-cli
ORCA skills get orchestration
ORCA status --json
ORCA worktree current --json
ORCA agent installed --json
```

Check the host and absolute worktree path against the assignment. A nested checkout can resolve to its registered parent. If they differ, verify an explicit workspace selector before launching a worker. Use the agent ID returned on the target host, not a display name or an executable on another machine.

## Choose the lifecycle

| Need                                         | Route                                                                                                | Evidence                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Finish in the current session                | Work directly in the intended checkout.                                                              | Acceptance check and result.                                        |
| A registered harness must report back        | Follow the orchestration guide to start a supervised worker.                                         | Dispatch identity, worker report, and independently checked result. |
| Hand off work without a result expected here | Follow the orca-cli guide for agent launch or worktree creation.                                     | Launch receipt and workspace. Do not report task completion.        |
| Run a CLI command without worker supervision | Run its documented noninteractive command in an owned Orca terminal. The CLI need not be registered. | Terminal handle, output, and command exit status.                   |

For a local supervised assignment, the orchestration guide provides this pattern. Supply a bounded brief and acceptance check. Follow the receipt. If another host was requested, use the guide's placement procedure instead.

```text
ORCA orchestration worker-start --environment local --worktree <verified-selector> --agent <registered-id> --spec <brief>
```

Registration does not prove worker readiness. If start fails, follow the receipt and the guide's recovery instructions. Do not retry an uncertain dispatch or silently substitute a shell. Pass model or effort only when requested and supported. Verify the effective choice before claiming it.

For a shell task, use a fresh terminal rather than borrowing a session. Inspect the CLI's own help. Pass a trusted, correctly quoted command, not raw user input. Run short commands in the foreground. For background work, retain an owned job or terminal handle and arrange to capture its output and exit status before detaching. Do not claim dispatch, wakeup, or worker cancellation semantics for a shell process.

```text
ORCA terminal create --worktree <verified-selector> --title <task-name> --command <trusted-command> --json
ORCA terminal read --terminal <returned-handle> --screen --json
ORCA terminal close --terminal <returned-handle> --json
```

A terminal can return to its shell after the CLI exits. Verify the command's output and exit status, not just the terminal's running state. Close only the handle created for this task after collecting its result. See the conditional [Codex](codex.md) and [Jcode](jcode.md) examples. Use other CLIs' own documented invocation with the same lifecycle.
