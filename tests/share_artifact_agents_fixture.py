"""Named AGENTS sample fixture; executable checks live in the sibling test file."""

from pathlib import Path
from typing import Final

from jinja2 import Environment, StrictUndefined
from jinja2.environment import Template

type JsonScalar = str | int | bool | None
type JsonValue = JsonScalar | list[JsonValue] | dict[str, JsonValue]
type RenderContext = dict[str, JsonValue]

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
AGENTS_DIRECTORY = (
    REPOSITORY_ROOT / "plugins" / "totto2727-coding" / "skills" / "share-artifact" / "agents"
)
DOCUMENT_TYPE: Final = "AGENTS"
SPEC_PATH = AGENTS_DIRECTORY / "spec.md"
TEMPLATE_PATH = AGENTS_DIRECTORY / "template.md"
SAMPLE_PATH = AGENTS_DIRECTORY / "sample.md"
VALIDATION_COMMAND: Final = (
    "nix", "develop", "--command", "bash", "-c",
    "PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=. uv run tests/share_artifact_agents_template_test.py",
)
PROVENANCE: Final = (
    (
        "https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md",
        AGENTS_DIRECTORY.parent / "SKILL.md",
    ),
    (
        "https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md",
        TEMPLATE_PATH,
    ),
)
PROVENANCE_FOOTER: Final = (
    f"_This AGENTS.md was generated from the [share-artifact skill]({PROVENANCE[0][0]}) "
    f"and [AGENTS template]({PROVENANCE[1][0]})._\n"
)
EMPTY_RENDER_CONTEXT: Final[RenderContext] = {
    "project_name": "small-project",
    "repository_structure": "",
    "execution_rules": [],
    "standard_tasks": [],
    "architecture_sections": [],
    "development_tools": [],
    "package_rules": [],
    "documentation_links": [],
    "is_moonbit": False,
}
SAMPLE_RENDER_CONTEXT: Final[RenderContext] = {
    "project_name": "agent-marketplace",
    "repository_structure": "```text\nplugins/  Distributable plugins\n```",
    "execution_rules": [
        "Run commands from the repository root.",
        "Enter the pinned environment with `nix develop` before running Vite+ commands.",
        "Keep secrets out of distributed skills and examples.",
    ],
    "standard_tasks": [
        {"command": "vp check", "description": "Run repository formatting and validation checks."},
        {"command": "vp run test", "description": "Validate artifact templates and executable README examples."},
    ],
    "architecture_sections": [
        {"title": "Plugins", "items": ["Each plugin owns its distributable skills."]},
        {"title": "Skills", "items": ["Keep guidance project-independent."]},
    ],
    "development_tools": [{"name": "Vite+", "description": "Runs repository tasks."}],
    "package_rules": ["Package-specific AGENTS files supplement the root document."],
    "documentation_links": [{
        "when": "When changing README artifact guidance",
        "title": "README specification",
        "path": "./plugins/totto2727-coding/skills/share-artifact/readme/spec.md",
    }],
    "is_moonbit": False,
}


def read_template() -> Template:
    environment = Environment(
        undefined=StrictUndefined,
        keep_trailing_newline=True,
        trim_blocks=False,
        lstrip_blocks=False,
    )
    return environment.from_string(TEMPLATE_PATH.read_text(encoding="utf-8"))
