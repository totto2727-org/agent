# {{ document_type }} template contract

## Purpose

{{ purpose }}

## Required render context

{% for name in required_context %}

- `{{ name }}`
  {% endfor %}

## Required sections

{% for section in required_sections %}

- {{ section }}
  {% endfor %}

## Optional sections

{% for section in optional_sections %}

- {{ section }}
  {% endfor %}

## Extension rule

{{ extension_rule }}

## Prohibited patterns

{% for pattern in prohibited_patterns %}

- {{ pattern }}
  {% endfor %}

## Validation checks

{% for check in validation_checks %}

- {{ check }}
  {% endfor %}
