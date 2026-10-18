# CLI Composition

Use Effect CLI as the required foundation for a new JS/TS command-line application or an explicitly approved CLI migration.
Unrelated maintenance must preserve an existing CLI's parsing, help, output, and exit-code contract.
Use [shared JS toolchain](share.md) for packaging and [Effect knowledge](../knowledge/effect.md) for installed-version verification.

## Command boundary

Define the command tree, positional arguments, options, defaults, and help through Effect CLI.
Check the installed Effect version's official CLI exports before choosing imports or constructors.
Do not copy an older `@effect/cli` example into a version that exposes a different CLI module.
Do not hand-parse `process.argv` or introduce another CLI framework for new commands.

Decode configuration and environment values at the CLI boundary before calling business services.
Keep parser validation separate from domain invariants and expose recoverable operation failures through Effect.
Have command handlers compose business Effects rather than running partial workflows inside services.
Select Layers, configuration, and the host runtime at the executable composition root.
Use [services and runtime](../knowledge/effect/services-runtime.md) for provisioning and resource cleanup.
Keep filesystem, process, HTTP, and terminal access behind the installed Effect platform APIs where available.
Use only minimal verified host adapters for unsupported capabilities.

## Output and process lifecycle

Keep stdout for the command's result contract, including machine-readable output when offered.
Keep diagnostics, progress, and user-facing failure explanations on stderr unless the existing contract specifies otherwise.
Map typed failures and interruption to documented exit behavior at the process boundary.
Do not stringify and discard the original cause inside a service or log the same failure at every layer.
Close scoped resources on success, failure, and interruption.
Avoid interactive prompts in unattended modes and never expose secret configuration in help or diagnostics.

## Verification and distribution

Use [js-test](../../../js-test/SKILL.md) for test structure and assertions.
Check command dispatch, arguments, options, defaults, invalid input, help, stdout/stderr separation, and exit behavior through the public CLI boundary.
Test business services independently from process launch and separately exercise the packaged executable.
For a Nix application build, use Bun without changing the dependency manager or claiming a different production host.
Verify the real packaged executable, its resource cleanup, and any declared external runtime requirement before distribution.
