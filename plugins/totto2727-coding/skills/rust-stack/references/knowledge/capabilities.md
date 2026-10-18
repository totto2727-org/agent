# Rust Capability Conventions

Select graph-flow, garde, and tracing independently of one another and of Web, CLI, desktop, or LLM profiles.

## Workflows with graph-flow

Use graph-flow for code-defined graph workflows and observable execution status.
Keep workflow-owned definitions and input contracts separate from per-run session state and execution history.
Select step-by-step execution when callers need intermediate status or execution control.
Use continuous execution when they do not.

If introspection exceeds the engine API, keep a serializable topology descriptor beside the graph.
Do not infer routes from private callbacks.
An engine session alone is not evidence of durable or exactly-once execution, retry, or resume semantics.
Make sure that those contracts meet the application's needs.

## Serde, garde, then domain construction

| Capability                                | Choice                      |
| ----------------------------------------- | --------------------------- |
| JSON                                      | `serde_json`                |
| TOML                                      | `toml`                      |
| CSV records                               | `csv` Serde deserialization |
| Semantic rules beyond structural decoding | garde                       |

When all three capabilities are necessary, use the sequence `Serde wire DTO -> garde validation -> fallible domain construction`.
Serde structural decoding is not semantic validation or authorization.
For closed input objects, use `#[serde(deny_unknown_fields)]` where the representation and protocol let you reject unknown fields.
Extensible configuration and versioned external protocols can need unknown fields.
Use [share-coding](../../../share-coding/SKILL.md) for general boundary rules.

## Logging with tracing

Use tracing for structured observability, not as a mandatory dependency.
Automatic argument capture and error formatting can put payloads in logs even when explicit log fields omit them.
Do not include prompts, tool arguments, documents, responses, query strings, or sensitive paths by default.
For existing network adapters, keep safe listening-address and completed-request diagnostics with normalized routes, status, and elapsed time.
This maintenance requirement does not select a Web stack.
Keep CLI diagnostics off machine-readable stdout.

## Official sources

- [graph-flow repository](https://github.com/a-agmon/rs-graph-llm)
- [graph-flow API](https://docs.rs/graph-flow/latest/graph_flow/)
- [Serde data model](https://serde.rs/data-model.html)
- [Serde attributes](https://serde.rs/attributes.html)
- [serde_json](https://docs.rs/serde_json/latest/serde_json/)
- [toml](https://docs.rs/toml/latest/toml/)
- [csv deserialization](https://docs.rs/csv/latest/csv/struct.Reader.html#method.deserialize)
- [garde](https://docs.rs/garde/latest/garde/)
- [tracing](https://docs.rs/tracing/latest/tracing/)
