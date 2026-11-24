# Jcode as the selected harness

For supervision, use the registered ID and the [Orca worker route](orca.md).
For an explicit shell task, inspect `jcode run --help` on the target host and use a fresh invocation rather than connecting to an active session.

For a harmless readiness probe on versions that advertise this option:

```sh
jcode run --tool-profile none 'Do not use tools. What is 137 plus 214? Reply with the number only.'
```

Expect `351` and exit status zero.
This tests one-shot execution, not a particular provider, registered worker readiness, or nested delegation.
Do not grant tools, change providers, or modify shared settings to obtain a successful probe.
See the [Jcode project](https://github.com/1jehuang/jcode).
