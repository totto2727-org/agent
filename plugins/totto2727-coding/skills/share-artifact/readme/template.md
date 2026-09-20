{# Apply documentation-principles for content quality. This template defines the README form. Extensions preserve section order, keep License last, and contain only consumer documentation. -#}

# {{ project_name }}

{# Overview field for the consumer entrypoint. -#}
{{ overview }}

{# Root and independent entries own Usage. Nested entries must own distinct Usage or link concrete relevant Usage; common setup and project metadata stay at root. -#}
{% if (entry_scope == "root" or entry_scope == "independent" or entry_scope == "nested") and usage_placement == "owned" -%}

## Usage

{# Usage fields contain the public operation and result; acquisition fields belong to Setup. Select exactly one surface: library, cli, agent, or gui. See documentation-principles for example quality and the sample contract for executable-example validation. -#}
{% if usage_surface == "library" -%}
{% if usage_examples -%}
{% for example in usage_examples -%}
{{ example.summary }}

```{{ example.language }}
{{ example.code }}
```

{% endfor -%}
{% elif usage_links -%}
{% if entry_scope == "root" -%}
Choose the package Usage that matches your goal:

{% for link in usage_links -%}
- [{{ link.title }}]({{ link.path }}): {{ link.summary }}
{% endfor %}
{% else -%}
{{ [] | first }}
{% endif -%}
{% elif entry_scope == "root" or entry_scope == "independent" -%}
{# Link directly to a concrete runnable example; for interface-only libraries, the linked implementation Usage must demonstrate real integration. -#}
{{ usage_guide.summary }}

See [{{ usage_guide.title }}]({{ usage_guide.path }}).

{% else -%}
{{ [] | first }}
{% endif -%}
{% elif usage_surface == "cli" -%}
{% if cli_usage_examples -%}
{% for example in cli_usage_examples -%}
{{ example.summary }}

```bash
{{ example.command }}
```

Expected result:

```text
{{ example.result }}
```

{% endfor -%}
{% else -%}
{{ [] | first }}
{% endif -%}
{% elif usage_surface == "agent" -%}
{% if agent_usage_examples -%}
{% for example in agent_usage_examples -%}
{{ example.summary }}

```text
{{ example.prompt }}
```

Expected result:

```text
{{ example.result }}
```

{% endfor -%}
{% else -%}
{{ [] | first }}
{% endif -%}
{% elif usage_surface == "gui" -%}
![{{ gui_usage.image_alt }}]({{ gui_usage.image_path }})

{{ gui_usage.interaction_result }}
{% else -%}
{{ [] | first }}
{% endif -%}
{% elif entry_scope == "nested" and usage_placement == "linked" -%}

## Usage

{{ usage_guide.summary }}

See [{{ usage_guide.title }}]({{ usage_guide.path }}).
{% else -%}
{{ [] | first }}
{% endif -%}

{% if entry_scope == "root" or entry_scope == "independent" -%}

## Key features

{% for feature in features -%}
- {{ feature }}
{% endfor %}
## Prerequisites

{# Include only consumer requirements that must be satisfied before setup. Put constraints and error behavior in Usage, API, or a purpose-specific end-user section. -#}
{% if prerequisites -%}
{% for prerequisite in prerequisites -%}
- **{{ prerequisite.name }}**: {{ prerequisite.detail }}
{% endfor %}
{% else -%}
No prerequisites.

{% endif -%}

## Setup

{# Applications group each populated command list into one bash block under Run without installing or Install, and render one nix block under Nix flake. Empty modes omit their headings. Alternatives are parallel, not numbered. Execution results occupy Usage. -#}
{% if usage_surface == "library" -%}
{% if setup_steps -%}
{% for step in setup_steps -%}
{% if step.description is defined and step.description -%}
{{ step.description }}

{% endif -%}

```{{ step.language }}
{{ step.command }}
```

{% endfor -%}
{% else -%}
No setup is required.
{% endif -%}
{% elif usage_surface == "cli" or usage_surface == "agent" or usage_surface == "gui" -%}
{% if temporary_setup_options -%}

### Run without installing

```bash
{% for option in temporary_setup_options -%}
{{ option.command }}
{% endfor -%}
```

{% endif -%}
{% if persistent_setup_options -%}

### Install

```bash
{% for option in persistent_setup_options -%}
{{ option.command }}
{% endfor -%}
```

{% endif -%}
{% if consumer_flake_setup -%}

### Nix flake

```nix
{{ consumer_flake_setup.code }}
```

{% endif -%}
{% if not temporary_setup_options and not persistent_setup_options and not consumer_flake_setup -%}
No setup is required.
{% endif -%}
{% else -%}
{{ [] | first }}
{% endif -%}
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
{{ [] | first }}
{% endif -%}

{% if entry_scope == "root" or entry_scope == "independent" -%}

## Development

{{ development_summary }}

## License

{{ license }}
{% endif %}
_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
