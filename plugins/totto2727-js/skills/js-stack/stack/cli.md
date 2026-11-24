# Standalone TypeScript CLI

For a scriptable command, use Effect CLI and the Node platform for arguments, files, process lifetime, and output. The program owns its exit status, stdout, and stderr. If it also ships with a desktop app, share the application services, not the UI runtime.

GlossShift's [CLI entry point](https://github.com/totto2727-org/glossshift/blob/c47587d41fb4827a48c4e5366fc4479979e99760/app/cli/src/main.ts) is the example in its [TypeScript design](https://github.com/totto2727-org/glossshift/pull/17): the `gshift` command uses Node.js and Effect CLI, while the [native GUI](desktop.md) uses NSH. Running `--help` or piping translated text must not start the desktop host or request macOS Accessibility permission. Test a built CLI as a subprocess to observe its output and exit status.
