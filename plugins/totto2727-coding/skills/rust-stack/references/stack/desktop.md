# Rust Native Desktop Addition

| Selected technology                                                 | Role                                                           |
| ------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Rust baseline](share.md)                                           | Compiler, dependencies, packaging                              |
| [GPUI](https://github.com/zed-industries/zed/tree/main/crates/gpui) | Native UI and UI scheduling                                    |
| [Tokio](https://docs.rs/tokio/latest/tokio/)                        | Optional background I/O runtime, separate from GPUI scheduling |

| Integration boundary      | Required evidence                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Background I/O to UI      | Handoff through the selected GPUI revision's state-update API, not direct background-thread UI mutation |
| Executor interoperability | Actual integration with the selected GPUI revision, not assumed Tokio compatibility                     |
| macOS distribution        | Actual app-bundle launch with verified resource lookup, permissions, and native libraries               |

- Audience: advanced native desktop stack consumers.
