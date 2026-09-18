#!/usr/bin/env bash
# Local git pre-push hook — runs the E2E suite on your own machine before
# `git push` is allowed to proceed. No CI provider, no workflow file, no
# GitHub Actions runner involved: this only ever executes locally, as part
# of your own `git push`, and never leaves your machine.
#
# Install (from the project root):
#   cp skills/webapp-testing/assets/pre-push-hook.sh .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
#
# Uninstall: rm .git/hooks/pre-push
set -e

echo "Running E2E suite before push (skills/webapp-testing pre-push hook)..."
python scripts/run_e2e.py --headless

echo "E2E suite passed — proceeding with push."
