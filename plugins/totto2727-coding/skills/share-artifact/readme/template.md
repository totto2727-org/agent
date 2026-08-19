{# Extensions may add end-user sections if they preserve this order, keep License last, retain the MoonBit canonical-output and relative-symlink rule when applicable, and do not add developer, contributor, AI, or internal-operation guidance. -#}

# {{ project_name }}

{# State the end-user outcome, not the repository implementation. -#}
{{ overview }}

{% if is_moonbit -%}
This document is canonical `README.mbt.md`; maintain `README.md` as the relative symlink `README.md -> README.mbt.md`.
{%- endif %}

## Usage

{# Each example must exercise the installed or acquired public interface. CLI projects must also expose a maintained help or user-guide discovery path. -#}
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

{# Include only consumer requirements that must be satisfied before setup. Put constraints and error behavior in Usage, API, or a purpose-specific end-user section. -#}
{% if prerequisites -%}
{% for prerequisite in prerequisites -%}

- **{{ prerequisite.name }}**: {{ prerequisite.detail }}

{% endfor -%}
{% else -%}
No prerequisites.
{% endif -%}

## Setup

{# Steps must acquire/install the consumer artifact; repository preparation belongs in AGENTS.md. -#}
{% if setup_steps -%}
{% for step in setup_steps -%}
{{ loop.index }}. {{ step.description }}

```bash
{{ step.command }}
```

{% endfor -%}
{% else -%}
No setup is required.
{% endif -%}

## API

{% if api.mode == "registry" -%}
[{{ api.registry_name }} API reference]({{ api.registry_url }})
{% elif api.mode == "inline" -%}
{% for entry in api.entries -%}

### `{{ entry.name }}`

{{ entry.summary }}

```{{ entry.language }}
{{ entry.example }}
```

{% endfor -%}
{% elif api.mode == "guide" -%}
{{ api.guide_summary }}

See [{{ api.guide_title }}]({{ api.guide_path }}).
{% else -%}
{{ {}[api.mode] }}
{% endif -%}

## Development

{{ development_summary }}

## License

{{ license }}

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
