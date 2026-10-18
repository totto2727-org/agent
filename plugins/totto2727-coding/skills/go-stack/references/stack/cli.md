# Go CLI Stack

## Composition

Use standard-library `flag` by default.
Add a CLI framework only when the command contract exceeds its option model.
For whole-process-tree termination with `exec.CommandContext`, use platform-specific handling.

## Generator-specific dependencies

Use Atlas when a generator needs its schema or HCL parser.
Keep Atlas parser values inside the schema adapter.
TypeScript output for Kysely does not add a Node runtime requirement to a Go generator.
Atlas use in a generator does not select a Go ORM or database runtime.

## Official references

- [flag](https://pkg.go.dev/flag)
- [os/exec](https://pkg.go.dev/os/exec)
- [Atlas schema inspection](https://atlasgo.io/inspect)
