#!/usr/bin/env python3
"""Scan the current project for stack/tooling signals.

Stdlib-only, read-only — never installs, runs, or modifies anything. Prints
a summary an agent can use as a starting point for CLAUDE.md/AGENTS.md,
instead of guessing the stack from scratch by eye.

Usage:
    python scripts/detect_stack.py [path]
"""
import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# marker file -> (label, install command, common run commands to check for)
NODE_LOCKFILES = {
    "pnpm-lock.yaml": "pnpm",
    "yarn.lock": "yarn",
    "bun.lockb": "bun",
    "package-lock.json": "npm",
}

STACK_MARKERS = {
    "requirements.txt": ("Python (pip)", "pip install -r requirements.txt"),
    "pyproject.toml": ("Python (pyproject)", "pip install -e . (or poetry/uv install — check [build-system])"),
    "Pipfile": ("Python (pipenv)", "pipenv install"),
    "go.mod": ("Go", "go mod download"),
    "Cargo.toml": ("Rust", "cargo build"),
    "composer.json": ("PHP (composer)", "composer install"),
    "Gemfile": ("Ruby (bundler)", "bundle install"),
    "pom.xml": ("Java (Maven)", "mvn install"),
    "build.gradle": ("Java/Kotlin (Gradle)", "./gradlew build"),
    "build.gradle.kts": ("Java/Kotlin (Gradle)", "./gradlew build"),
    "mix.exs": ("Elixir (Mix)", "mix deps.get"),
}

DOC_FILES = ["CLAUDE.md", "AGENTS.md", "README.md", "CONTRIBUTING.md"]

CI_MARKERS = [".github/workflows", ".gitlab-ci.yml", ".circleci/config.yml", "Jenkinsfile"]

CONTAINER_MARKERS = ["Dockerfile", "docker-compose.yml", "compose.yaml"]


def find_node_package_manager(root: Path) -> str:
    for lockfile, manager in NODE_LOCKFILES.items():
        if (root / lockfile).is_file():
            return manager
    return "npm"  # default assumption when only package.json exists


def scan(root: Path) -> dict:
    result: dict = {
        "root": str(root),
        "node": None,
        "other_stacks": [],
        "docs": [],
        "ci": [],
        "containers": [],
        "test_signals": [],
        "lint_signals": [],
    }

    pkg_json = root / "package.json"
    if pkg_json.is_file():
        try:
            pkg = json.loads(pkg_json.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pkg = {}
        manager = find_node_package_manager(root)
        scripts = pkg.get("scripts", {})
        deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
        framework = next(
            (name for name in ("next", "vite", "react", "vue", "svelte", "@angular/core", "express", "nestjs", "fastify")
             if name in deps),
            None,
        )
        result["node"] = {
            "package_manager": manager,
            "install_cmd": f"{manager} install",
            "framework_hint": framework,
            "scripts": {k: v for k, v in scripts.items() if k in ("dev", "build", "test", "start", "lint")},
        }

    for marker, (label, install_cmd) in STACK_MARKERS.items():
        if (root / marker).is_file():
            result["other_stacks"].append({"marker": marker, "label": label, "install_cmd": install_cmd})

    for doc in DOC_FILES:
        if (root / doc).is_file():
            result["docs"].append(doc)

    for marker in CI_MARKERS:
        if (root / marker).exists():
            result["ci"].append(marker)

    for marker in CONTAINER_MARKERS:
        if (root / marker).is_file():
            result["containers"].append(marker)

    for marker in ("tests", "test", "__tests__", "spec", "pytest.ini", "jest.config.js", "vitest.config.ts", "playwright.config.ts"):
        if (root / marker).exists():
            result["test_signals"].append(marker)

    for marker in (".eslintrc.json", ".eslintrc.js", "eslint.config.js", ".flake8", "ruff.toml", "pyproject.toml", ".prettierrc"):
        if (root / marker).exists():
            result["lint_signals"].append(marker)

    return result


def render(result: dict) -> str:
    lines = [f"Scanned: {result['root']}", ""]

    if result["node"]:
        n = result["node"]
        lines.append(f"Node.js — package manager: {n['package_manager']} ({n['install_cmd']})")
        if n["framework_hint"]:
            lines.append(f"  framework hint: {n['framework_hint']}")
        if n["scripts"]:
            lines.append("  package.json scripts found: " + ", ".join(f"{k}" for k in n["scripts"]))
            for k, v in n["scripts"].items():
                lines.append(f"    {k}: {v}")
        lines.append("")

    for stack in result["other_stacks"]:
        lines.append(f"{stack['label']} — marker: {stack['marker']} — install: {stack['install_cmd']}")
    if result["other_stacks"]:
        lines.append("")

    if not result["node"] and not result["other_stacks"]:
        lines.append("No recognized stack marker found at root — may be a monorepo (check subfolders) or unsupported stack.")
        lines.append("")

    lines.append("Existing docs: " + (", ".join(result["docs"]) or "none"))
    lines.append("CI config: " + (", ".join(result["ci"]) or "none"))
    lines.append("Container config: " + (", ".join(result["containers"]) or "none"))
    lines.append("Test signals: " + (", ".join(result["test_signals"]) or "none"))
    lines.append("Lint/format signals: " + (", ".join(result["lint_signals"]) or "none"))

    return "\n".join(lines)


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 1

    result = scan(root)
    print(render(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
