# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "jinja2==3.1.6",
#   "pytest==8.4.1",
# ]
# ///

# How to run:
#   PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=. uv run tests/share_artifact_agents_template_test.py

import re
from copy import deepcopy

import pytest
from jinja2 import UndefinedError

from tests.share_artifact_agents_fixture import (
    DOCUMENT_TYPE,
    JsonValue,
    RenderContext,
    EMPTY_RENDER_CONTEXT,
    PROVENANCE,
    PROVENANCE_FOOTER,
    REPOSITORY_ROOT,
    SAMPLE_PATH,
    SAMPLE_RENDER_CONTEXT,
    SPEC_PATH,
    TEMPLATE_PATH,
    read_template,
)


def test_sample_is_byte_reproducible_with_valid_provenance() -> None:
    rendered = read_template().render(**SAMPLE_RENDER_CONTEXT)

    assert rendered.encode("utf-8") == SAMPLE_PATH.read_bytes()
    assert SPEC_PATH.parent == TEMPLATE_PATH.parent == SAMPLE_PATH.parent
    assert SPEC_PATH.parent.name == DOCUMENT_TYPE.lower()
    assert {SPEC_PATH.name, TEMPLATE_PATH.name, SAMPLE_PATH.name} == {
        "spec.md", "template.md", "sample.md",
    }
    assert rendered.endswith(PROVENANCE_FOOTER)
    for url, path in PROVENANCE:
        assert url in rendered
        assert path.resolve().is_relative_to(REPOSITORY_ROOT.resolve())
        assert path.is_file()


def test_empty_context_omits_irrelevant_sections_without_placeholders() -> None:
    rendered = read_template().render(**EMPTY_RENDER_CONTEXT)

    assert rendered == "# small-project\n\n" + PROVENANCE_FOOTER


@pytest.mark.parametrize("key", tuple(EMPTY_RENDER_CONTEXT))
@pytest.mark.parametrize("base_context", [EMPTY_RENDER_CONTEXT, SAMPLE_RENDER_CONTEXT])
def test_missing_explicit_context_is_rejected(key: str, base_context: RenderContext) -> None:
    context = deepcopy(base_context)
    del context[key]

    with pytest.raises(UndefinedError):
        _ = read_template().render(**context)


@pytest.mark.parametrize(
    "collection,key",
    [
        ("standard_tasks", "command"),
        ("standard_tasks", "description"),
        ("architecture_sections", "title"),
        ("architecture_sections", "items"),
        ("development_tools", "name"),
        ("development_tools", "description"),
        ("documentation_links", "when"),
        ("documentation_links", "title"),
        ("documentation_links", "path"),
    ],
)
def test_populated_entries_reject_missing_required_fields(collection: str, key: str) -> None:
    context = deepcopy(SAMPLE_RENDER_CONTEXT)
    del context[collection][0][key]

    with pytest.raises(UndefinedError):
        _ = read_template().render(**context)


@pytest.mark.parametrize("rules,tasks", [(False, False), (True, False), (False, True), (True, True)])
def test_sparse_commands_preserve_exact_constraints_and_tasks(rules: bool, tasks: bool) -> None:
    context = deepcopy(EMPTY_RENDER_CONTEXT)
    context["execution_rules"] = ["Run from `packages/api`; never access production."] if rules else []
    context["standard_tasks"] = [
        {"command": "nix develop --command tool test --target wasm-gc", "description": "Check affected API behavior."}
    ] if tasks else []

    rendered = read_template().render(**context)

    assert ("## Development commands" in rendered) == (rules or tasks)
    assert ("### Execution rules" in rendered) == rules
    assert ("### Standard tasks" in rendered) == tasks
    assert ("- Run from `packages/api`; never access production.\n" in rendered) == rules
    assert ("- `nix develop --command tool test --target wasm-gc` — Check affected API behavior.\n" in rendered) == tasks
    assert "## Repository structure" not in rendered
    assert "## Architecture" not in rendered
    assert "## Development tools" not in rendered
    assert "\n\n\n" not in rendered


def test_populated_sections_keep_order_and_conditional_navigation() -> None:
    context = deepcopy(SAMPLE_RENDER_CONTEXT)
    context["is_moonbit"] = True

    rendered = read_template().render(**context)

    assert [line for line in rendered.splitlines() if line.startswith("## ")] == [
        "## Repository structure",
        "## Development commands",
        "## Architecture",
        "## Development tools",
        "## Package-specific rules",
        "## Task-specific documentation",
        "## MoonBit README maintenance",
    ]
    assert "- When changing README artifact guidance: [README specification](./plugins/totto2727-coding/skills/share-artifact/readme/spec.md).\n" in rendered
    assert (REPOSITORY_ROOT / SAMPLE_RENDER_CONTEXT["documentation_links"][0]["path"]).is_file()
    assert re.search(r"(?m)^- .*\n\n- ", rendered) is None
    assert "\n\n\n" not in rendered


@pytest.mark.parametrize("is_moonbit", [False, True])
def test_moonbit_maintenance_is_conditional_and_preserves_consumer_boundary(is_moonbit: bool) -> None:
    context = deepcopy(EMPTY_RENDER_CONTEXT)
    context["is_moonbit"] = is_moonbit

    rendered = read_template().render(**context)

    for text in (
        "## MoonBit README maintenance",
        "`README.md -> README.mbt.md`",
        "`moon check README.mbt.md`",
        "`moon test README.mbt.md`",
        "Never render canonical-file or symlink-maintenance instructions into the end-user README.",
    ):
        assert (text in rendered) == is_moonbit
    assert rendered.endswith(PROVENANCE_FOOTER)


@pytest.mark.parametrize("invalid_value", ["true", "false", "", 0, 1, None, [], {}])
def test_moonbit_discriminator_rejects_non_boolean_values(invalid_value: JsonValue) -> None:
    context = deepcopy(EMPTY_RENDER_CONTEXT)
    context["is_moonbit"] = invalid_value

    with pytest.raises(UndefinedError):
        _ = read_template().render(**context)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q", "-s"]))
