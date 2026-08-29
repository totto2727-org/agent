# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "jinja2==3.1.6",
#   "pytest==8.4.1",
# ]
# ///

# How to run:
#   PYTHONPATH=. uv run tests/share_artifact_readme_template_test.py

from copy import deepcopy
from pathlib import Path
from subprocess import run

import pytest
from jinja2 import UndefinedError

from tests.share_artifact_readme_fixture import (
    ARTIFACT_RELATIVE_PATH,
    CONSUMER_FLAKE_CODE,
    DEPENDENCY_CONTEXT,
    DOCUMENT_TYPE,
    EXECUTED_OUTPUT,
    FLAKE_VALIDATION_COMMAND,
    PROVENANCE,
    REPOSITORY_ROOT,
    SAMPLE_PATH,
    SAMPLE_RENDER_CONTEXT,
    SPEC_PATH,
    TEMPLATE_PATH,
    VALIDATION_COMMAND,
    ApplicationSurface,
    application_context,
    read_template,
    write_fixture_file,
)


def test_library_sample_records_its_contract_structure() -> None:
    rendered = read_template().render(**SAMPLE_RENDER_CONTEXT)

    assert rendered == SAMPLE_PATH.read_text(encoding="utf-8")
    assert SPEC_PATH.parent == TEMPLATE_PATH.parent == SAMPLE_PATH.parent
    assert SPEC_PATH.parent.name == DOCUMENT_TYPE.lower()
    assert {SPEC_PATH.name, TEMPLATE_PATH.name, SAMPLE_PATH.name} == {
        "spec.md",
        "template.md",
        "sample.md",
    }
    for url, repo_path in PROVENANCE:
        assert url in rendered
        assert repo_path.resolve().is_relative_to(REPOSITORY_ROOT.resolve())
        assert repo_path.resolve().is_file()
    for section in ("# moonbit-fib", "## Usage", "## Setup", "## API", "## License"):
        assert section in rendered
    assert "moon add example/moonbit-fib" in rendered
    assert "Run without installing" not in rendered
    assert "### Install" not in rendered
    assert "### Nix flake" not in rendered


def test_sample_moonbit_examples_execute(tmp_path: Path) -> None:
    module_name, module_version, module_source = DEPENDENCY_CONTEXT
    manifest = (
        f'name = "{module_name}"\nversion = "{module_version}"\n'
        f'source = "{module_source}"\n'
    )
    _ = write_fixture_file(tmp_path, Path("moon.mod"), manifest)
    _ = write_fixture_file(tmp_path, Path("src/moon.pkg"), "")
    _ = write_fixture_file(
        tmp_path,
        Path("src/fib.mbt"),
        "pub fn fib(n : Int) -> Int {\n  match n {\n    0 => 0\n    1 => 1\n    _ => fib(n - 1) + fib(n - 2)\n  }\n}\n",
    )
    _ = write_fixture_file(
        tmp_path,
        Path("src/test/moon.pkg"),
        f'import {{\n  "{module_name}" @fib,\n}} for "test"\n',
    )
    artifact_path = write_fixture_file(
        tmp_path,
        ARTIFACT_RELATIVE_PATH,
        read_template().render(**SAMPLE_RENDER_CONTEXT),
    )

    completed = run(
        VALIDATION_COMMAND,
        cwd=tmp_path,
        check=False,
        capture_output=True,
        text=True,
    )
    output = completed.stdout + completed.stderr
    print(output, end="")

    assert (
        artifact_path.resolve().relative_to(tmp_path.resolve())
        == ARTIFACT_RELATIVE_PATH
    )
    assert completed.returncode == 0, output
    for marker in EXECUTED_OUTPUT:
        assert marker in output


@pytest.mark.parametrize("surface", ["cli", "agent", "gui"])
def test_application_renders_every_supported_acquisition_mode(
    surface: ApplicationSurface,
) -> None:
    rendered = read_template().render(**application_context(surface))

    for expected in (
        "npx @example/greet-app Ada",
        "nix run github:example/greet-app -- Ada",
        "npm i -g @example/greet-app",
        "nix profile add github:example/greet-app",
        CONSUMER_FLAKE_CODE,
    ):
        assert expected in rendered
    setup = rendered.split("## Setup", 1)[1].split("## API", 1)[0]
    headings = ("### Run without installing", "### Install", "### Nix flake")
    for heading, next_heading in zip(headings, (*headings[1:], "")):
        section = setup.split(heading, 1)[1]
        if next_heading:
            section = section.split(next_heading, 1)[0]
        assert section.count("```") == 2
        fence = "```nix" if heading == "### Nix flake" else "```bash"
        assert section.count(fence) == 1


def test_consumer_flake_is_complete_and_parses(tmp_path: Path) -> None:
    flake_path = write_fixture_file(tmp_path, Path("flake.nix"), CONSUMER_FLAKE_CODE)

    completed = run(
        (*FLAKE_VALIDATION_COMMAND, str(flake_path)),
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr
    assert "outputs" in completed.stdout


def test_application_omits_unsupported_persistent_and_flake_modes() -> None:
    context = application_context("cli")
    context["temporary_setup_options"] = [
        {
            "command": "go run example.com/greet-app@latest Ada",
        }
    ]
    context["persistent_setup_options"] = []
    context["consumer_flake_setup"] = {}

    rendered = read_template().render(**context)

    assert "go run example.com/greet-app@latest Ada" in rendered
    assert "### Install" not in rendered
    assert "### Nix flake" not in rendered


@pytest.mark.parametrize(
    "missing_key",
    ["temporary_setup_options", "persistent_setup_options", "consumer_flake_setup"],
)
def test_application_rejects_missing_setup_input(missing_key: str) -> None:
    context = application_context("cli")
    del context[missing_key]

    with pytest.raises(UndefinedError):
        _ = read_template().render(**context)


def test_application_without_acquisition_route_states_no_setup() -> None:
    context = application_context("cli")
    context["temporary_setup_options"] = []
    context["persistent_setup_options"] = []
    context["consumer_flake_setup"] = {}

    assert "No setup is required." in read_template().render(**context)


def test_nested_entry_does_not_duplicate_root_setup() -> None:
    context = deepcopy(SAMPLE_RENDER_CONTEXT)
    context["entry_scope"] = "nested"
    context["usage_placement"] = "linked"
    context["usage_guide"] = {
        "summary": "Use the root Fibonacci example.",
        "title": "Root Usage",
        "path": "../../README.md#usage",
    }

    rendered = read_template().render(**context)

    assert "## Usage" in rendered
    assert "## API" in rendered
    assert "## Setup" not in rendered


def test_invalid_usage_surface_is_rejected() -> None:
    context = deepcopy(SAMPLE_RENDER_CONTEXT)
    context["usage_surface"] = "service"

    with pytest.raises(UndefinedError):
        _ = read_template().render(**context)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q", "-s"]))
