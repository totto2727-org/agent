# Rust Desktop Profile

Use GPUI for native GUI applications.

GPUI scheduling and Tokio are distinct.
Add Tokio only when selected background I/O needs it.
Use an explicit handoff to GPUI's supported state-update mechanism.
A background thread must not mutate UI state directly.
Use the selected GPUI revision's APIs as evidence of executor interoperability.

A Cargo build is not a complete macOS app bundle.
Examine resource lookup, permissions, native libraries, and launch behavior in the actual bundle.

## Official sources

- [GPUI site](https://www.gpui.rs/)
- [GPUI source and examples](https://github.com/zed-industries/zed/tree/main/crates/gpui)
- [GPUI crate documentation](https://docs.rs/gpui/latest/gpui/)
