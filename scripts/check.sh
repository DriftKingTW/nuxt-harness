#!/usr/bin/env bash
# The single "is this change OK?" command for humans, agents, and CI.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "lint"
yarn lint

step "typecheck"
yarn typecheck

step "tests"
yarn test

step "build (what consumers install)"
yarn build

printf '\n\033[32m✔ check passed\033[0m\n'
