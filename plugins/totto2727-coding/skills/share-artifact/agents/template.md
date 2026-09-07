{# All context keys are explicit; empty content omits irrelevant sections. Preserve applicable operational constraints, commands, and the CLAUDE.md -> AGENTS.md alias. -#}
{# Undefined markers below reject invalid input; they are not render context keys. -#}
{% if is_moonbit is not sameas true and is_moonbit is not sameas false -%}
{{ invalid_is_moonbit }}
{% endif -%}
# {{ project_name }}

{% if repository_structure -%}
## Repository structure

{{ repository_structure }}

{% endif -%}
{% if execution_rules or standard_tasks -%}
## Development commands

{% if execution_rules -%}
### Execution rules

{% for rule in execution_rules -%}
- {{ rule }}
{% endfor %}
{% endif -%}
{% if standard_tasks -%}
### Standard tasks

{% for task in standard_tasks -%}
- `{{ task.command }}` — {{ task.description }}
{% endfor %}
{% endif -%}
{% endif -%}
{% if architecture_sections -%}
## Architecture

{% for section in architecture_sections -%}
### {{ section.title }}

{% for item in section.get('items', required_architecture_items) -%}
- {{ item }}
{% endfor %}
{% endfor -%}
{% endif -%}
{% if development_tools -%}
## Development tools

{% for tool in development_tools -%}
- **{{ tool.name }}**: {{ tool.description }}
{% endfor %}
{% endif -%}
{% if package_rules -%}
## Package-specific rules

{% for rule in package_rules -%}
- {{ rule }}
{% endfor %}
{% endif -%}
{% if documentation_links -%}
## Task-specific documentation

{% for link in documentation_links -%}
- {{ link.when }}: [{{ link.title }}]({{ link.path }}).
{% endfor %}
{% endif -%}
{% if is_moonbit -%}
## MoonBit README maintenance

Keep the canonical end-user content in the physical `README.mbt.md` file and maintain `README.md` as the relative symlink `README.md -> README.mbt.md`. Validate supported MoonBit blocks with `moon check README.mbt.md` and `moon test README.mbt.md`. Never render canonical-file or symlink-maintenance instructions into the end-user README.

{% endif -%}
_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
