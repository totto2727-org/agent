# Rust LLM Addition

| Selected technology                                         | Role                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| [Rust baseline](share.md)                                   | Compiler, dependencies, packaging                        |
| [Rig](https://rig.rs/docs)                                  | Completions, agents, tools, embeddings, provider clients |
| [graph-flow](https://docs.rs/graph-flow/latest/graph_flow/) | Optional code-defined workflows, not implied by Rig      |

| Composition boundary           | Selection                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Rig crates and features        | Required capabilities with verified provider and streaming support in the resolved release    |
| Provider profiles and adapters | Profile resolution separate from application-owned prompts, tools, and runtime initialization |
| Progress                       | Token streaming separate from workflow progress unless both represent the same operation      |
| Validation and telemetry       | Independent [capability additions](../knowledge/capabilities.md), not a Web baseline          |

- Audience: advanced LLM stack consumers.
