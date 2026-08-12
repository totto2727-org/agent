{# Extensions may add end-user sections if they preserve this order, keep License last, retain the MoonBit canonical-output and relative-symlink rule when applicable, and do not add developer, contributor, AI, or internal-operation guidance. -#}

# {{ project_name }}

{{ overview }}

{% if is_moonbit -%}
This document is canonical `README.mbt.md`; maintain `README.md` as the relative symlink `README.md -> README.mbt.md`.
{%- endif %}

## Usage

{% for example in usage_examples -%}

```{{ example.language }}
{{ example.code }}
```

{% endfor -%}

## Key features

{% for feature in features -%}

- {{ feature }}

{% endfor -%}

## Prerequisites

{% for prerequisite in prerequisites -%}

- **{{ prerequisite.name }}**: {{ prerequisite.detail }}

{% endfor -%}

## Setup

{% for step in setup_steps -%}
{{ loop.index }}. {{ step.description }}

```bash
{{ step.command }}
```

{% endfor -%}

## Development

{{ development_summary }}

## Documentation

- [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md)
- [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)

## License

{{ license }}
