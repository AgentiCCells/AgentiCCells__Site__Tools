#!/usr/bin/env bash
# Rebase on dev, run every gate against the new base, then push. Stops at the first failure. Never pipe a gate.
# Order fixed by conductor.tools@ (2026-11-20, reviewer finding 9): rebase first, so the signature check's
# base is the dev we push onto. Rebased commits must stay signed: commit.gpgsign must be true here.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -e board/HOLD.md ] && { echo "board/HOLD.md exists: no release while it does" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "uncommitted changes: commit or stash them first" >&2; exit 1; }
[ "$(git config --bool commit.gpgsign || true)" = true ] || { echo "set commit.gpgsign true (and the SSH signing key) in this repository first" >&2; exit 1; }
CHECKER_COMMIT=1d5c6bcfb7c478e3a32a81ee2e429ac184026887
# Signed commits and no symlinks, with the checkers taken from the base copy (origin/dev), as CI does.
trusted() {
  local dir; dir=$(mktemp -d); trap 'rm -rf "$dir"' RETURN
  for f in check-signatures.mjs check-symlinks.mjs check-commits.mjs; do
    local src=origin/dev
    git cat-file -e "$src:scripts/$f" 2>/dev/null || src=$CHECKER_COMMIT
    [ "$(git ls-tree "$src" -- "scripts/$f" | cut -d' ' -f1)" = 100644 ] || { echo "scripts/$f at $src is not a plain file" >&2; return 1; }
    git show "$src:scripts/$f" > "$dir/$f"
  done
  node "$dir/check-signatures.mjs" origin/dev HEAD
  node "$dir/check-symlinks.mjs" origin/dev origin/dev HEAD --tree .
  node "$dir/check-commits.mjs" origin/dev HEAD
}
for i in 1 2 3 4 5; do
  git fetch -q origin dev
  git rebase -q origin/dev || { git rebase --abort; echo "rebase conflict: resolve by hand" >&2; exit 1; }
  # One gate per line: under set -e a failure inside an && chain does not stop the script (specialist.code@ finding 1).
  node scripts/build.mjs
  node scripts/privacy-check.mjs
  node scripts/validate.mjs
  node scripts/leak-scan.mjs
  trusted
  if git -c push.negotiate=true push -q origin HEAD:dev; then echo "released $(git rev-parse --short HEAD) to dev"; exit 0; fi
  sleep $((i * 3))
done
echo "release failed after 5 attempts" >&2; exit 1
