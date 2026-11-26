---
name: poteto-mode
description: Route implementation, investigation, or delivery work to a pstack playbook and verify the requested outcome. Use when the user requests poteto-mode or pstack's working style.
---

# Poteto mode

State the requested outcome and the smallest check that would prove it. Keep simple work in the current session.
For a substantial task, open the matching playbook below and track its applicable steps in the current harness. Follow user constraints over playbook defaults.

| When the user needs to…                       | Start here                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Understand a symptom before changing code     | [Investigation](playbooks/investigation.md), [runtime forensics](playbooks/runtime-forensics.md), or [trace forensics](playbooks/trace-forensics.md) |
| Fix incorrect or slow behavior                | [Bug fix](playbooks/bug-fix.md) or [performance issue](playbooks/perf-issue.md)                                                                      |
| Change an interface or its implementation     | [Feature](playbooks/feature.md), [refactoring](playbooks/refactoring.md), or [visual parity](playbooks/visual-parity.md)                             |
| Choose or measure an approach                 | [Prototype](playbooks/prototype.md), [evaluation](playbooks/eval.md), or [hillclimb](playbooks/hillclimb.md)                                         |
| Author a skill or plan several changes        | [Authoring a skill](playbooks/authoring-a-skill.md) or [multi-phase plan](playbooks/multi-phase-plan.md)                                             |
| Open, monitor, or land a change               | [Opening a PR](playbooks/opening-a-pr.md), [babysit](playbooks/babysit.md), or [shipping](playbooks/shipping.md)                                     |
| Coordinate extended work                      | [Autonomous run](playbooks/autonomous-run.md), [independent queue](playbooks/autopilot-full.md), or [dependent stack](playbooks/autopilot-stack.md)  |
| Pause, resume, or remove completed workspaces | [Pause safely](playbooks/pause-safely.md), [session pickup](playbooks/session-pickup.md), or [worktree cleanup](playbooks/worktree-cleanup.md)       |

For a README, AGENTS.md, or ADR, use [technical-writing](../technical-writing/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-documentation/skills/technical-writing/SKILL.md)). If substantial work fits no playbook, use [figure-it-out](../figure-it-out/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-engineering/skills/figure-it-out/SKILL.md)).

## Execution

Use the repository's verification workflow. For a defect, capture the failure first. For a design choice, run the smallest experiment that distinguishes the alternatives. For a behavior change, exercise the affected interface after editing. Inspect the final diff, including work you delegated.

Use [the Orca adapter](references/orca.md) for workspace placement, handoff, and supervised workers. A playbook role describes a responsibility, not a requirement to launch another agent. Work serially if there is no independent assignment or the requested execution route is unavailable and the user permits direct work. Do not silently substitute a different requested harness or model.

Give each worker the [worker brief](worker.md), the goal, its owned paths, the acceptance check, and the expected return. Workers do not delegate by default. For long runs, use [Show me your work](../show-me-your-work/SKILL.md) when decisions need an audit trail.

Report what changed, what you actually tested, and what remains unverified. Stop before a destructive action or external publication unless it is authorized.
