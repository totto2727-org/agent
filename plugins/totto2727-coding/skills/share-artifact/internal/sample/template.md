# {{ document_type }} sample record

## Fixture

{{ fixture_name }}

## Source contracts

- Specification: `{{ spec_path }}`
- Template: `{{ template_path }}`

## Render context

```text
{{ render_context }}
```

## Rendered output

{{ rendered_output }}

## Provenance checks

{% for check in provenance_checks %}

- {{ check }}
  {% endfor %}

## Validation checks

{% for check in validation_checks %}

- {{ check }}
  {% endfor %}
