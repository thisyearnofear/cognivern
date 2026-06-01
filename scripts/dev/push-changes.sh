#!/usr/bin/env bash
# Push the 3 prepared commits to origin/main.
#
# Sandbox note: this script could not be auto-run from the agent because
# DNS to github.com is blocked in the sandbox. Run this from your local
# machine (or any environment with network access to GitHub) to push.

set -euo pipefail
cd "$(dirname "$0")/../.."

echo "▶ Pushing 3 commits to origin/main..."
git push -u origin main

echo
echo "▶ Pushed commits:"
git log --oneline origin/main~3..origin/main 2>/dev/null || git log --oneline -3
