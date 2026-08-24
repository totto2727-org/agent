from copy import deepcopy
from pathlib import Path
from typing import Final, Literal

from jinja2 import Environment, StrictUndefined
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
SPEC_PATH = README_DIRECTORY / "spec.md"
SAMPLE_PATH = README_DIRECTORY / "sample.md"
DOCUMENT_TYPE: Final = "README"
ARTIFACT_RELATIVE_PATH = Path("src/test/README.mbt.md")
DEPENDENCY_CONTEXT: Final = ("example/moonbit-fib", "0.1.0", "./src")
MOON_FLAKE: Final = (
    "github:totto2727/moonbit-overlay/6bf553e6349a68f0d27fc741ceb3da70ac573b6f#moon"
)
VALIDATION_COMMAND: Final = (
    "nix",
    "run",
    MOON_FLAKE,
    "--",
    "test",
    ARTIFACT_RELATIVE_PATH.as_posix(),
    "--target",
    "wasm-gc",
    "-v",
)
EXECUTED_OUTPUT: Final = (
    '("fib usage") ok',
    '("fib API usage") ok',
    "Total tests: 2, passed: 2, failed: 0.",
)
CONSUMER_FLAKE_CODE: Final = """{
  inputs = {
    greet-app.url = "github:example/greet-app/0123456789abcdef0123456789abcdef01234567";
  };
  outputs = { self, greet-app }: {
    packages = greet-app.packages;
  };
}
"""
FLAKE_VALIDATION_COMMAND: Final = ("nix-instantiate", "--parse")
PROVENANCE: Final = (
    (
        "https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md",
        README_DIRECTORY.parent / "SKILL.md",
    ),
    (
        "https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md",
        TEMPLATE_PATH,
    ),
)


def read_template() -> Template:
    environment = Environment(
        undefined=StrictUndefined,
        keep_trailing_newline=True,
        trim_blocks=False,
        lstrip_blocks=False,
    )
    return environment.from_string(TEMPLATE_PATH.read_text(encoding="utf-8"))


SAMPLE_RENDER_CONTEXT: Final[RenderContext] = {
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
            "language": "bash",
            "command": "moon add example/moonbit-fib",
        },
        {
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


def setup_option(command: str) -> RenderContext:
    return {"language": "bash", "command": command}


def application_context(surface: ApplicationSurface) -> RenderContext:
    context = deepcopy(SAMPLE_RENDER_CONTEXT)
    context.update(
        {
            "project_name": "greet-app",
            "overview": "An application that formats a greeting.",
            "usage_surface": surface,
            "usage_examples": [],
            "setup_steps": [],
            "temporary_setup_options": [
                setup_option("npx @example/greet-app Ada"),
                setup_option("nix run github:example/greet-app -- Ada"),
            ],
            "persistent_setup_options": [
                setup_option("npm i -g @example/greet-app"),
                setup_option("nix profile add github:example/greet-app"),
            ],
            "consumer_flake_setup": {
                "code": CONSUMER_FLAKE_CODE,
            },
            "cli_usage_examples": [
                {"summary": "Greet Ada.", "command": "greet Ada", "result": "Hello!"}
            ],
            "agent_usage_examples": [
                {
                    "summary": "Ask for a greeting.",
                    "prompt": "Greet Ada.",
                    "result": "Hello!",
                }
            ],
            "gui_usage": {
                "image_alt": "Greeting window",
                "image_path": "./docs/greeting.png",
                "interaction_result": "Enter Ada and select Greet.",
            },
        }
    )
    return context


def write_fixture_file(root: Path, relative_path: Path, content: str) -> Path:
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(content, encoding="utf-8")
    return path
