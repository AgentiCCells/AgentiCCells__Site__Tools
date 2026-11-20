#!/usr/bin/env bash
# Run every gate, then rebase on dev and push. Stops at the first failure. Never pipe a gate.
set -euo pipefail
cd "$(dirname "$0")/.."
# Refuse during a hold (finding 3), with uncommitted changes (finding 4: the gates must check what is
# pushed), and check every commit's Agent: trailer before the push, while it can still be amended (finding 5).
[ -e board/HOLD.md ] && { echo "board/HOLD.md exists: no release while it does" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "uncommitted changes: commit or stash them first" >&2; exit 1; }
git fetch -q origin dev
node scripts/build.mjs
node scripts/validate.mjs
node scripts/leak-scan.mjs
node scripts/check-commits.mjs origin/dev HEAD
# Signed commits and no symlinks, run from the base copy (origin/dev), as CI does.
trusted() {
  local dir; dir=$(mktemp -d)
  for f in check-signatures.mjs check-symlinks.mjs; do
    local src=origin/dev
    git cat-file -e "$src:scripts/$f" 2>/dev/null || src=1d5c6bcfb7c478e3a32a81ee2e429ac184026887
    [ "$(git ls-tree "$src" -- "scripts/$f" | cut -d' ' -f1)" = 100644 ] || { echo "scripts/$f at $src is not a plain file" >&2; return 1; }
    git show "$src:scripts/$f" > "$dir/$f"
  done
  node "$dir/check-signatures.mjs" origin/dev HEAD
  node "$dir/check-symlinks.mjs" origin/dev origin/dev HEAD --tree .
}
trusted
for i in 1 2 3 4 5; do
  git fetch -q origin dev
  git rebase -q origin/dev
  # One gate per line: under set -e a failure inside an && chain does not stop the script (specialist.code@ finding 1).
  node scripts/build.mjs >/dev/null
  node scripts/validate.mjs >/dev/null
  node scripts/leak-scan.mjs >/dev/null
  node scripts/check-commits.mjs origin/dev HEAD >/dev/null
  trusted >/dev/null
  if git -c push.negotiate=true push -q origin HEAD:dev; then echo "released $(git rev-parse --short HEAD) to dev"; exit 0; fi
  sleep $((i * 3))
done
echo "release failed after 5 attempts" >&2; exit 1
