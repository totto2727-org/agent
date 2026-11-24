# Visual role

Rule: `visual-role`.
This supplements STE with presentation of distinct content roles.

Use project conventions first.
For Markdown, use permitted GFM features to distinguish consequential instructions, warnings, examples, and reference information.
A command block, table, list, diagram, or GitHub alert can carry substantive information rather than decorate prose.

## Finding

A destructive-action warning is buried in the middle of an ordinary descriptive paragraph.
Use a permitted warning form before the action so the reader can distinguish the consequence from background information.
Keep the consequence specific; an alert label does not replace its content.

## Boundaries

Do not impose an alert quota or add another warning around an already clear representation.
Do not claim that a renderer supports GitHub-specific syntax without checking the actual rendering separately.
Preserve fixed templates, heading identifiers, and exact quoted material.
If no meaningful content-role distinction is needed, the rule is `not_applicable`.
