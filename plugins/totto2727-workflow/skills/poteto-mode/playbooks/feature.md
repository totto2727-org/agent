### Feature

Choose the smallest end-to-end slice that demonstrates the requested behavior. Use [architect](../../architect/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-engineering/skills/architect/SKILL.md)) when a design decision spans interfaces.

Keep coupled changes with one owner. If independent work can proceed in parallel, assign each [Orca worker](../references/orca.md) its paths, prerequisites, and acceptance check. Use [arena](../../arena/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-engineering/skills/arena/SKILL.md)) only when comparing competing designs would change the decision.

Verify the slice through the interface its caller uses. Report any behavior that could not be observed. When publication is in scope, follow [Opening a PR](opening-a-pr.md).
