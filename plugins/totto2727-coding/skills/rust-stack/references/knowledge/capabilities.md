# Rust Capability Conventions

Use this reference when implementing a capability that needs workflows, typed formats, validation, or structured telemetry.
These recommendations are independent of Web applications and apply to CLI, desktop, and LLM compositions as needed.
Do not add graph-flow, garde, or tracing to applications that do not need the matching capability.
Read the selected release's official documentation before using concrete APIs.

## Workflows with graph-flow

Use graph-flow as the standard recommendation for code-defined graph workflows, tasks, conditional edges, sessions, and observable execution status.
Keep each workflow in its own module or directory.
Let it own its stable workflow ID, typed input and validators, graph construction, topology description, defaults, schedules, and display metadata where needed.
Keep forms with the workflow's input contract when a UI exists, without requiring a UI for workflow execution.
Let an application registry enumerate definitions and select a runtime by workflow ID.
Keep immutable graph definitions separate from per-run session state and execution history.
Use globally unique run or session IDs when runners share storage or history.
Choose step-by-step execution when callers need the active node, selected edge, timing, state, and output after each task.
Use continuous execution only when intermediate observability and caller control are unnecessary.
Keep a serializable topology descriptor beside the graph when a consumer needs introspection the selected engine API does not provide.
Do not infer routes or domain contracts from private callbacks or engine state.
Wrap the engine at the application boundary before considering a fork for a confirmed API gap.
Define cancellation, retry, resume, and persistence behavior explicitly rather than assuming engine sessions provide durable or exactly-once execution.

## Serde, garde, then domain construction

Use the format-specific Serde parser to decode bytes or text into a typed wire DTO.
Use `serde_json` for JSON, `toml` for TOML, and `csv` record deserialization for CSV when those formats are needed.
Do not keep generic values, maps, or string records in domain code when the input shape is known.
Let Serde handle structural rules such as field names, required fields, enums, numeric types, and unknown-field policy.
Prefer `#[serde(deny_unknown_fields)]` for closed input objects where compatible with the chosen representation and format.
Do not apply that policy blindly to extensible configuration or versioned external protocols.

Use garde as the standard recommendation when semantic validation requires rules for blank text, lengths, ranges, formats, nested values, cross-field relationships, or custom policies.
Validate after structural decoding and before domain execution.
Construct the domain type through `TryFrom` or a fallible constructor after validation.
Keep parser failures, garde reports, and domain-construction failures as distinct error categories.
Normalize only when the accepted contract permits it, and use the validated representation for construction and execution.
Keep workflow-specific DTOs and validators in the workflow module.
A generic dispatcher should select the workflow and pass boundary input to its owned decoder and validator rather than know every workflow's fields.
Apply authorization and resource limits separately from deserialization and validation.

## Logging with tracing

Use tracing as the standard recommendation for structured observability when that capability is needed.
Initialize its subscriber once at the executable boundary, not inside reusable libraries.
Prefer spans and structured fields for operation or run IDs, status, duration, and safe failure categories.
Select consumers and a redaction policy before adding workflow or LLM diagnostics.
Do not log secrets, complete inputs, prompts, tool arguments, documents, or responses by default.
Review automatic argument capture and error display for accidental payload exposure.
Omit query strings and sensitive paths by default, and allowlist only fields known to be safe.
For existing network adapters, retain safe listening-address and completed-request diagnostics, including method, normalized route or redacted path, status, and elapsed time.
That maintenance guidance does not select a Rust Web stack.
For CLI applications, keep diagnostics on stderr so stdout remains a reliable result channel.
Translate internal error causes into safe user-facing messages at the reporting boundary without destroying the internal error chain.

## Official sources

- [graph-flow repository](https://github.com/a-agmon/rs-graph-llm)
- [graph-flow crate documentation](https://docs.rs/graph-flow/latest/graph_flow/)
- [Serde data model](https://serde.rs/data-model.html)
- [Serde field and container attributes](https://serde.rs/attributes.html)
- [serde_json typed deserialization](https://docs.rs/serde_json/latest/serde_json/fn.from_slice.html)
- [toml typed deserialization](https://docs.rs/toml/latest/toml/fn.from_str.html)
- [csv Serde deserialization](https://docs.rs/csv/latest/csv/struct.Reader.html#method.deserialize)
- [garde documentation](https://docs.rs/garde/latest/garde/)
- [tracing documentation](https://docs.rs/tracing/latest/tracing/)
