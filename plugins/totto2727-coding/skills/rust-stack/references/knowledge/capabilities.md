# Rust Capability Conventions

- Audience: advanced consumers composing Rust libraries.
- Select graph-flow, garde, and tracing independently of one another and of Web, CLI, desktop, or LLM additions.

## Workflows with graph-flow

- [graph-flow](https://docs.rs/graph-flow/latest/graph_flow/): workflow definitions and input contracts separate from per-run session state and history.
- Step-by-step execution for intermediate status or execution control.
- Continuous execution otherwise.
- Introspection beyond the engine API: serializable topology descriptor beside the graph, not routes inferred from private callbacks.
- Verify durability, exactly-once execution, retry, and resume requirements separately from engine-session creation.

## Serde, garde, then domain construction

| Capability                                | Choice                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| JSON                                      | [serde_json](https://docs.rs/serde_json/latest/serde_json/)                                       |
| TOML                                      | [toml](https://docs.rs/toml/latest/toml/)                                                         |
| CSV records                               | [csv](https://docs.rs/csv/latest/csv/struct.Reader.html#method.deserialize) Serde deserialization |
| Semantic rules beyond structural decoding | [garde](https://docs.rs/garde/latest/garde/)                                                      |

- When required: [Serde](https://serde.rs/) wire DTO → garde validation → fallible domain construction.
- Structural decoding does not provide semantic validation or authorization.
- Closed objects: `#[serde(deny_unknown_fields)]` when supported by the representation and protocol.
- Preserve required extensibility for configuration and versioned external protocols.

## Logging with tracing

- [tracing](https://docs.rs/tracing/latest/tracing/): inspect automatic argument capture and error formatting for payload exposure, not only explicit fields.
- Exclude prompts, tool arguments, documents, responses, query strings, and sensitive paths by default.
- Existing network adapters: retain safe listening-address and completed-request diagnostics with normalized routes, status, and elapsed time.
- These diagnostics do not select a Web stack.
- CLI diagnostics: separate from machine-readable stdout.
