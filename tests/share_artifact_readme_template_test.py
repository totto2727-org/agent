# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "jinja2==3.1.6",
#   "pytest==8.4.1",
# ]
# ///

# How to run:
#   uv run tests/share_artifact_readme_template_test.py

from copy import deepcopy
from pathlib import Path
from typing import Literal, assert_never

import pytest
from jinja2 import Environment, StrictUndefined, UndefinedError
from jinja2.environment import Template

type JsonScalar = str | int | bool | None
type JsonValue = JsonScalar | list[JsonValue] | dict[str, JsonValue]
type RenderContext = dict[str, JsonValue]
type ApplicationSurface = Literal["cli", "agent", "gui"]

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
README_DIRECTORY = (
    REPOSITORY_ROOT
    / "plugins"
    / "totto2727-coding"
    / "skills"
    / "share-artifact"
    / "readme"
)
TEMPLATE_PATH = README_DIRECTORY / "template.md"
SAMPLE_PATH = README_DIRECTORY / "sample.md"


def read_template() -> Template:
    environment = Environment(
        undefined=StrictUndefined,
        keep_trailing_newline=True,
        trim_blocks=False,
        lstrip_blocks=False,
    )
    return environment.from_string(TEMPLATE_PATH.read_text(encoding="utf-8"))


def library_context() -> RenderContext:
    return {
        "project_name": "moonbit-fib",
        "overview": "A small MoonBit Fibonacci library for applications that need an integer sequence primitive.",
        "entry_scope": "root",
        "usage_placement": "owned",
        "usage_surface": "library",
        "usage_examples": [
            {
                "summary": "Calculate the Fibonacci number at position 10 and verify the library returns 55.",
                "language": "mbt check",
                "code": 'test "fib usage" {\n  inspect(@fib.fib(10), content="55")\n}',
            }
        ],
        "usage_links": [],
        "usage_guide": {},
        "cli_usage_examples": [],
        "agent_usage_examples": [],
        "gui_usage": {},
        "features": [
            "Small public API",
            "Supports non-negative `Int` positions on MoonBit targets",
        ],
        "prerequisites": [
            {
                "name": "MoonBit project",
                "detail": "Use a project that can consume packages from Mooncakes.",
            }
        ],
        "setup_steps": [
            {
                "description": "Add the library dependency to the consuming MoonBit project.",
                "language": "bash",
                "command": "moon add example/moonbit-fib",
            },
            {
                "description": "Import the package in the consuming package's `moon.pkg`.",
                "language": "text",
                "command": 'import {\n  "example/moonbit-fib" @fib\n}',
            },
        ],
        "api": {
            "mode": "inline",
            "entries": [
                {
                    "name": "fib",
                    "summary": "Returns the Fibonacci number at the requested zero-based position.\n\nCallers must pass a non-negative position; negative positions are outside the supported input range.",
                    "language": "mbt check",
                    "example": 'test "fib API usage" {\n  inspect(@fib.fib(10), content="55")\n}',
                }
            ],
        },
        "development_summary": "For project structure and development commands, see [AGENTS.md](./AGENTS.md).",
        "license": "MIT",
    }


def application_context(surface: ApplicationSurface) -> RenderContext:
    context = deepcopy(library_context())
    context.update(
        {
            "project_name": "greet-app",
            "overview": "An application that formats a greeting.",
            "usage_surface": surface,
            "usage_examples": [],
            "setup_steps": [],
            "temporary_setup_options": [
                {
                    "description": "Run the npm package once.",
                    "language": "bash",
                    "command": "npx @example/greet-app@1.2.3 Ada",
                },
                {
                    "description": "Run the flake app once.",
                    "language": "bash",
                    "command": "nix run github:example/greet-app/0123456789abcdef0123456789abcdef01234567 -- Ada",
                },
            ],
            "persistent_setup_options": [
                {
                    "description": "Install from npm.",
                    "language": "bash",
                    "command": "npm i -g @example/greet-app@1.2.3",
                },
                {
                    "description": "Install into a Nix profile.",
                    "language": "bash",
                    "command": "nix profile add github:example/greet-app/0123456789abcdef0123456789abcdef01234567",
                },
            ],
            "consumer_flake_setup": {
                "description": "Add the package to a consumer flake.",
                "code": 'inputs.greet-app.url = "github:example/greet-app/0123456789abcdef0123456789abcdef01234567";\n\noutputs = { self, nixpkgs, greet-app, ... }: {\n  packages.x86_64-linux.default = greet-app.packages.x86_64-linux.default;\n};',
            },
        }
    )
    match surface:
        case "cli":
            context["cli_usage_examples"] = [
                {
                    "summary": "Greet Ada.",
                    "command": "greet Ada",
                    "result": "Hello, Ada!",
                }
            ]
        case "agent":
            context["agent_usage_examples"] = [
                {
                    "summary": "Ask the installed agent to greet Ada.",
                    "prompt": "Greet Ada.",
                    "result": "Hello, Ada!",
                }
            ]
        case "gui":
            context["gui_usage"] = {
                "image_alt": "Greeting window showing Hello, Ada!",
                "image_path": "./docs/greeting.png",
                "interaction_result": "Enter Ada and select Greet to display Hello, Ada!",
            }
        case unreachable:
            assert_never(unreachable)
    return context


def test_library_sample_is_reproducible_and_dependency_only() -> None:
    rendered = read_template().render(**library_context())

    assert rendered == SAMPLE_PATH.read_text(encoding="utf-8")
    assert "moon add example/moonbit-fib" in rendered
    assert "Run without permanent installation" not in rendered
    assert "Install persistently" not in rendered
    assert "Use from a consumer flake" not in rendered


@pytest.mark.parametrize("surface", ["cli", "agent", "gui"])
def test_application_renders_every_supported_acquisition_mode(
    surface: ApplicationSurface,
) -> None:
    rendered = read_template().render(**application_context(surface))

    for expected in (
        "### Run without permanent installation",
        "npx @example/greet-app@1.2.3 Ada",
        "nix run github:example/greet-app/0123456789abcdef0123456789abcdef01234567 -- Ada",
        "### Install persistently",
        "npm i -g @example/greet-app@1.2.3",
        "nix profile add github:example/greet-app/0123456789abcdef0123456789abcdef01234567",
        "### Use from a consumer flake",
        "```nix",
    ):
        assert expected in rendered


def test_application_omits_unsupported_persistent_and_flake_modes() -> None:
    context = application_context("cli")
    context["temporary_setup_options"] = [
        {
            "description": "Run the Go command without installing it.",
            "language": "bash",
            "command": "go run example.com/greet-app@v1.2.3 Ada",
        }
    ]
    context["persistent_setup_options"] = []
    context["consumer_flake_setup"] = {}

    rendered = read_template().render(**context)

    assert "go run example.com/greet-app@v1.2.3 Ada" in rendered
    assert "### Install persistently" not in rendered
    assert "### Use from a consumer flake" not in rendered


@pytest.mark.parametrize(
    "missing_key",
    [
        "temporary_setup_options",
        "persistent_setup_options",
        "consumer_flake_setup",
    ],
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

    rendered = read_template().render(**context)

    assert "No setup is required." in rendered


def test_nested_entry_does_not_duplicate_root_setup() -> None:
    context = library_context()
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
    context = library_context()
    context["usage_surface"] = "service"

    with pytest.raises(UndefinedError):
        _ = read_template().render(**context)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
