#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): auto-fix the edited file with the project's ESLint and
# report remaining errors back to Claude (exit 2 = shown to the model).
set -uo pipefail

project=${CLAUDE_PROJECT_DIR:-}
[[ -n "$project" ]] || exit 0
file=$(jq -r '.tool_input.file_path // empty')
[[ -n "$file" && -f "$file" ]] || exit 0
case "$file" in
  *.ts|*.vue|*.mjs) ;;
  *) exit 0 ;;
esac
case "$file" in
  */node_modules/*|*/.nuxt/*|*/.nuxt-e2e/*|*/.output/*|*/dist/*) exit 0 ;;
esac

# Lint with the checkout the file is in: the project, or a linked worktree of the same repo
# (worktree mode). Files in other repos (a sibling project, a wiki) have their own lint config.
root=$project
case "$file" in
  "$project"/*) ;;
  *)
    root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0
    common() { git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null; }
    [[ -n "$root" && "$(common "$root")" == "$(common "$project")" ]] || exit 0
    ;;
esac

cd "$root" || exit 0
[[ -x node_modules/.bin/eslint ]] || exit 0
if ! out=$(yarn eslint --fix "$file" 2>&1); then
  echo "ESLint errors remain in $file after auto-fix:" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
exit 0
