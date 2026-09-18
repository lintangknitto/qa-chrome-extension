#!/usr/bin/env python3
"""E2E test runner/orchestrator for the webapp-testing skill.

Wraps `npx playwright test`: ensures browsers are installed, runs the
JSON reporter, and prints a pass/fail/flaky summary. Exits non-zero on
any failure so it can be used both locally and in CI.

Usage:
    python run_e2e.py [--grep PATTERN] [--project NAME] [--headless] [--install]

Runs headed (visible browser) by default per playwright.config.ts — pass
--headless for unattended/agent-driven runs.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Must match the json reporter's outputFile in assets/playwright.config.ts.
RESULTS_PATH = Path("docs/qa/playwright-results.json")


def run(cmd: list[str], env: dict[str, str] | None = None) -> int:
    print(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, env=env, check=False).returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Playwright E2E tests with a summary report.")
    parser.add_argument("--grep", help="Only run tests matching this pattern")
    parser.add_argument("--project", help="Only run this Playwright project (e.g. chromium)")
    parser.add_argument(
        "--headless",
        action="store_true",
        help=(
            "Force headless even locally (config defaults to headed locally). "
            "Use this for unattended/agent-driven runs — no one's watching "
            "the window, and some sandboxes have no display to open one on."
        ),
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="No-op locally (already the default) — kept for explicitness/CI overrides",
    )
    parser.add_argument("--install", action="store_true", help="Install Playwright browsers before running")
    args = parser.parse_args()

    npx = shutil.which("npx")
    if npx is None:
        print("error: npx not found on PATH — Node.js is required", file=sys.stderr)
        return 1

    if args.install:
        code = run([npx, "playwright", "install", "--with-deps"])
        if code != 0:
            return code

    # Deliberately don't pass --reporter here: the CLI flag replaces the
    # config's reporters entirely rather than adding to them, which would
    # silently stop the html reporter from writing playwright-report/ (the
    # folder CI uploads as an artifact). Let playwright.config.ts's
    # ['html', ...] + ['json', ...] reporters run as configured instead.
    cmd = [npx, "playwright", "test"]
    if args.grep:
        cmd += ["--grep", args.grep]
    if args.project:
        cmd += ["--project", args.project]
    if args.headed:
        cmd.append("--headed")

    env = os.environ.copy()
    if args.headless:
        env["HEADLESS"] = "true"

    returncode = run(cmd, env)
    print(_summarize(RESULTS_PATH))

    if RESULTS_PATH.is_file():
        build_report = Path(__file__).resolve().parent / "build_report.py"
        run([sys.executable, str(build_report)])
        print(
            "\nReport: npx playwright show-report docs/qa/playwright-report\n"
            "  (attachments live in a sibling data/ folder, so open it via this\n"
            "  command, not by double-clicking index.html)\n"
            "For a failing test's trace (network log, DOM snapshots), find its\n"
            "trace.zip under docs/qa/test-results/ and run:\n"
            "  npx playwright show-trace <path-to-trace.zip>\n"
        )

    return returncode


def _summarize(results_path: Path) -> str:
    try:
        data = json.loads(results_path.read_text())
    except (json.JSONDecodeError, FileNotFoundError, OSError):
        return "Could not parse Playwright JSON output — see raw output above."

    passed = failed = flaky = skipped = 0

    def walk(suites):
        nonlocal passed, failed, flaky, skipped
        for suite in suites:
            for spec in suite.get("specs", []):
                for test in spec.get("tests", []):
                    status = test.get("status")
                    if status == "expected":
                        passed += 1
                    elif status == "unexpected":
                        failed += 1
                    elif status == "flaky":
                        flaky += 1
                    elif status == "skipped":
                        skipped += 1
            walk(suite.get("suites", []))

    walk(data.get("suites", []))
    total = passed + failed + flaky + skipped
    return (
        f"\n--- E2E Summary ---\n"
        f"Total: {total} | Passed: {passed} | Failed: {failed} | "
        f"Flaky: {flaky} | Skipped: {skipped}\n"
    )


if __name__ == "__main__":
    sys.exit(main())
