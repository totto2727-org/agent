# /// script
# requires-python = ">=3.12"
# dependencies = ["pytest==8.4.1"]
# ///

"""Regression checks for the external-information platform manifests.

These checks protect platform-specific fields, not the complete vendor schemas.
Claude's authoritative check is `claude plugin validate <plugin> --strict`.
References:
https://code.claude.com/docs/en/plugins-reference#plugin-manifest-schema
https://cursor.com/docs/reference/plugins#cursor-plugin-manifest
"""

import json
from pathlib import Path

import pytest


PLUGIN_ROOT = Path(__file__).resolve().parents[1] / "plugins" / "external-information"


def read_manifest(platform: str) -> dict:
    return json.loads((PLUGIN_ROOT / f".{platform}-plugin" / "plugin.json").read_text())


@pytest.mark.parametrize("platform", ["claude", "cursor"])
def test_codex_interface_does_not_leak_into_other_platforms(platform: str) -> None:
    assert "interface" not in read_manifest(platform)


def test_cursor_author_uses_documented_fields() -> None:
    author = read_manifest("cursor")["author"]
    assert "name" in author
    assert set(author) <= {"name", "email"}


def test_codex_retains_its_interface_metadata() -> None:
    interface = read_manifest("codex")["interface"]
    assert interface["displayName"] == "External Information"
    assert interface["defaultPrompt"]


@pytest.mark.parametrize("platform", ["claude", "cursor", "codex"])
def test_shared_identity_and_skill_discovery_stay_consistent(platform: str) -> None:
    manifest = read_manifest(platform)
    canonical = read_manifest("claude")
    for field in ("name", "version", "description", "skills"):
        assert manifest[field] == canonical[field]
    for field in ("name", "email"):
        assert manifest["author"][field] == canonical["author"][field]
    assert manifest["name"] == "external-information"
    skills = PLUGIN_ROOT / manifest["skills"]
    assert {path.parent.name for path in skills.glob("*/SKILL.md")} == {
        "open-connector",
        "web-search",
        "doc-search",
    }


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
