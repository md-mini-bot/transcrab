#!/usr/bin/env bash
set -euo pipefail

# Convenience wrapper for the bot:
# URL + optional flags -> run TransCrab pipeline locally.
#
# Usage:
#   ./scripts/run-crab.sh <url> [--lang zh] [--model openai-codex/gpt-5.2]

node ./scripts/add-url.mjs "$@"
