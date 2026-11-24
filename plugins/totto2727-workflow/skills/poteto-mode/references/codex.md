# Codex as the selected harness

For supervision, use the registered ID and the [Orca worker route](orca.md).
For an explicit shell task, inspect `codex exec --help` on the target host and start a fresh invocation in the intended checkout.
Do not resume an unrelated session.

For a harmless readiness probe on versions that advertise these options:

```sh
codex exec --ephemeral --sandbox read-only 'Do not use tools. What is 137 plus 214? Reply with the number only.'
```

Expect `351` and exit status zero.
This tests noninteractive execution, not editing, a specific model, or supervised completion.
Do not weaken sandbox or approval settings to pass a probe.
See the [Codex CLI reference](https://developers.openai.com/codex/cli/reference/).
