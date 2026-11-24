---
name: principle-exhaust-the-design-space
description: "Apply when facing a novel UI interaction or architectural decision with no precedent in the codebase. Build 2-3 competing prototypes and compare side by side before committing."
disable-model-invocation: true
---

# Exhaust the Design Space

Check the project's installed dependencies first. If none covers the requirement, prefer a mature, maintained library over a custom implementation unless a concrete constraint rules it out. Before prototyping, look at how mature products solve the same problem. Compare alternatives when no precedent satisfies the requirements.

It also applies to product design decisions where user experience depends on feel, not logic.
