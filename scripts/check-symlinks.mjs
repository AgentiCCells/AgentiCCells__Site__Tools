// Copied from build/check-symlinks.mjs in AgentiCCells/AgentiCCells__Site__Factory (branch factory/check-from-base, commit ea47397,
// Apache-2.0, same team) by conductor.tools@AgentiCCells.dinis on 20 Nov 2026. Unchanged but for this header and the usage path.
// Control 10 (security@, ed70bd996, relayed by conductor.b@ 19 Nov 16:50 UTC): no symlinks.
// Node built-ins only. Written by cells.b@AgentiCCells.dinis.
//
// Refuses, in the range before..after:
//   - any mode-120000 entry added or changed in any commit (git diff-tree per commit, merges
//     against every parent), not only in the final tree;
//   - any symlink in the checked-out tree (when a working tree is given);
//   - any symlink under an extra directory, such as a downloaded artifact.
// The only exceptions are the paths listed in team/symlink-exceptions.json read from the
// trusted base commit, never from the pull request:
// {"exceptions":[{"path":"...","target":"...","reason":"..."}]}. The target is pinned too.
// An exception added in a pull request counts only once that pull request is merged.
//
// Usage: node scripts/check-symlinks.mjs <base> <before> <after> [--tree <dir>] [--dir <dir>]...
import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync, existsSync, readlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Paths are kept as raw bytes (latin1 strings, one character per byte), never decoded as UTF-8,
// so two different non-UTF-8 names cannot collapse into the same string (library.b@, 43b0f38).
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'latin1', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' } });
const bytes = (s) => Buffer.from(s, 'utf8').toString('latin1'); // a UTF-8 path from the JSON, as raw bytes
const show = (s) => Buffer.from(s, 'latin1').toString('utf8'); // for messages only

// Exceptions pin both the path and the link's target, so an excepted link cannot be re-pointed.
export function exceptionsAt(cwd, base) {
  let text;
  try { text = Buffer.from(git(cwd, ['show', `${base}:team/symlink-exceptions.json`]), 'latin1').toString('utf8'); } catch { return new Map(); }
  const data = JSON.parse(text);
  const out = new Map();
  for (const e of data.exceptions || []) {
    if (typeof e.path !== 'string' || !e.path || typeof e.target !== 'string' || !e.target || typeof e.reason !== 'string' || !e.reason.trim()) throw new Error('team/symlink-exceptions.json: every exception needs a path, a target and a reason');
    out.set(bytes(e.path), bytes(e.target));
  }
  return out;
}

function walkLinks(dir, root, found) {
  // Only the repository's own top-level .git is skipped; a .git anywhere else (inside a built site) is scanned.
  for (const n of readdirSync(dir, { encoding: 'buffer' })) {
    const p = Buffer.concat([dir, Buffer.from('/'), n]);
    if (p.equals(Buffer.concat([root, Buffer.from('/.git')]))) continue;
    const st = lstatSync(p);
    if (st.isSymbolicLink()) found.push({ path: p.subarray(root.length + 1).toString('latin1'), target: readlinkSync(p, { encoding: 'buffer' }).toString('latin1') });
    else if (st.isDirectory()) walkLinks(p, root, found);
  }
}

export function checkSymlinks({ cwd, base, before, after = 'HEAD', tree = null, dirs = [] }) {
  const allowed = exceptionsAt(cwd, base);
  const ok = (path, target) => allowed.has(path) && allowed.get(path) === target;
  const blob = (sha) => git(cwd, ['cat-file', 'blob', sha]);
  const errors = [];
  const commits = git(cwd, ['rev-list', `${before}..${after}`]).split('\n').filter(Boolean);
  for (const c of commits) {
    // --root covers a commit with no parent; -m compares a merge with each parent.
    const raw = git(cwd, ['diff-tree', '-r', '--raw', '--no-commit-id', '--root', '-m', '-z', c]).split('\0');
    for (let i = 0; i < raw.length - 1; i++) {
      const meta = raw[i];
      if (!meta.startsWith(':')) continue;
      const [, dstMode, , dstSha, status] = meta.slice(1).split(' ');
      const path = raw[++i];
      if (/^[RC]/.test(status)) i++; // renames and copies carry a second path
      if (dstMode === '120000' && !ok(path, blob(dstSha))) errors.push(`${c.slice(0, 7)} ${show(path)}: symlink added or changed (not allowed)`);
    }
  }
  // AFTER's own tree as well as each commit's changes.
  const entries = git(cwd, ['ls-tree', '-r', '-z', '--full-tree', after]).split('\0').filter(Boolean);
  for (const e of entries) {
    const tab = e.indexOf('\t');
    const [mode, , sha] = e.slice(0, tab).split(' ');
    const path = e.slice(tab + 1);
    if (mode === '120000' && !ok(path, blob(sha))) errors.push(`tree of ${after.slice(0, 7)} ${show(path)}: symlink (not allowed)`);
  }
  const scan = (dir, label) => {
    if (!dir || !existsSync(dir)) return;
    const root = Buffer.from(dir.replace(/\/+$/, ''));
    const found = [];
    walkLinks(root, root, found);
    for (const f of found) if (label !== 'tree' || !ok(f.path, f.target)) errors.push(`${label} ${show(f.path)}: symlink (not allowed)`);
  };
  scan(tree, 'tree');
  for (const d of dirs) scan(d, d);
  return { errors: [...new Set(errors)], commits: commits.length, exceptions: allowed.size };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const [base, before, after] = a;
  const opt = (name) => a.flatMap((x, i) => (x === name ? [a[i + 1]] : []));
  if (!base || !before || !after) { console.error('usage: check-symlinks.mjs <base> <before> <after> [--tree dir] [--dir dir]...'); process.exit(2); }
  const r = checkSymlinks({ cwd: process.cwd(), base, before, after, tree: opt('--tree')[0] || null, dirs: opt('--dir') });
  if (r.errors.length) { console.error(r.errors.join('\n')); console.error(`FAILED (${r.errors.length})`); process.exit(1); }
  console.log(`OK (no symlinks in ${r.commits} commits${opt('--tree').length ? ' or the tree' : ''}; ${r.exceptions} listed exceptions)`);
}
