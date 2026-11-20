// Copied from build/check-signatures.mjs in AgentiCCells/AgentiCCells__Site__Factory (branch factory/check-from-base, commit ea47397,
// Apache-2.0, same team) by conductor.tools@AgentiCCells.dinis on 20 Nov 2026. Changes: the path (scripts/) and the trusted base.
// The trusted base here is 72ed45e, the commit that published the first key in team/keys.json; the seed before it has none.
// Every commit is signed by its agent's own published key and names its session.
// Dinis Cruz, 18 November 2026 ~23:55 UTC (in cyber.b@PrompTugal.dinis's session), confirmed for every
// agent ~01:10 UTC 19 November (PrompTugal__News__Website board/guidance/2026-11-19-signed-commits-paid-search-and-free-embeds.md,
// section 2): "every single agent that runs in here should have published its public key on the repo that it maintains
// ... every then commit is signed by that key ... you should also include the session ID".
// Pattern: cyber.b@'s scripts/check-signatures.mjs in PrompTugal__News__Cyber (commit c8fff24, Apache-2.0, same team).
//
// Usage: node scripts/check-signatures.mjs <before> <after>   the range to check (run by plan.yml on pull requests)
// For each commit in before..after (merges and side branches included) that is not an ancestor of the pinned
// TRUSTED_BASE (control 8: a skip is decided only by git merge-base --is-ancestor, never by what a tree holds,
// so deleting this file never skips a commit):
//   1. it carries a git SSH signature that verifies against a key in its (first) PARENT's team/keys.json (status not
//      "superseded"), never the keys in the commit itself: a new or rotated key is added by a commit signed with a
//      key already listed, or by a person (the commit that adds this check is reviewed and merged by Dinis);
//   2. the key's agent is the commit's one Agent: trailer;
//   3. its one Claude-Session: trailer is the session recorded with that key.
// No commit is exempt by its author or committer, which anyone can set. The factory's own workflow commits are on
// dev only and never in a pull request's range. One failure refuses the whole range (exit 1). In a pull request,
// pass the head commit, not GitHub's synthetic merge commit. Controls per security@'s ruling of 19 Nov 01:30 UTC.
// Both controls follow signals.b@'s review of this pattern (PrompTugal__News__Signals 0101639), relayed by conductor.b@.
// The OpenSSH form of each key is derived from its published PEM (bundle.sign) with ssh-keygen; nothing else is trusted.
// An orphan commit (no parent) is refused: it has no parent keys to trust (control 6). CI runs this file from
// the base branch's copy, not the pushed tree's (control 7; .github/workflows/plan.yml).
// Needs git 2.34+ and ssh-keygen. Prints OK or each failing commit and exits 1. History is never rewritten.
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const SELF = 'scripts/check-signatures.mjs';
// The trusted base: 72ed45e, the bootstrap commit that published conductor.tools@'s key (for Dinis to review).
// It is pinned here, in the trusted copy CI runs; there is no environment override.
export const TRUSTED_BASE = '72ed45e8dcab7f6ca18602c548b69eb21ee620e8';
const AGENT = /^[a-z0-9]+(?:[.-][a-z0-9]+)*@[a-z0-9.-]+$/i;
const lines = (s) => (s ? s.split('\n').map((x) => x.trim()).filter(Boolean) : []);

export function checkSignatures({ cwd = process.cwd(), before, after = 'HEAD', trustedBase = TRUSTED_BASE } = {}) {
  const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
  const tryGit = (...a) => { try { return git(...a); } catch { return null; } };
  // A shallow clone hides history, so parents and older commits cannot be told apart: refuse it.
  if (tryGit('rev-parse', '--is-shallow-repository') === 'true') return { errors: ['shallow checkout: fetch the full history (fetch-depth 0)'], checked: 0, skipped: 0 };
  // Fail closed: without the trusted base in this clone, nothing can be judged.
  if (!tryGit('rev-parse', '--verify', '--quiet', `${trustedBase}^{commit}`)) return { errors: [`trusted base ${trustedBase.slice(0, 7)} is not in this clone`], checked: 0, skipped: 0 };
  const from = before && !/^0+$/.test(before) && tryGit('rev-parse', '--verify', '--quiet', `${before}^{commit}`);
  // BEFORE must be the already-checked commit the change builds on: refuse one that is not an ancestor of AFTER.
  if (from && spawnSync('git', ['merge-base', '--is-ancestor', from, after], { cwd }).status !== 0) return { errors: [`before (${from.slice(0, 7)}) is not an ancestor of ${after}: update the branch from dev`], checked: 0, skipped: 0 };
  const range = lines(git('rev-list', ...(from ? [`${from}..${after}`] : [after])));
  const isAncestorOfBase = (c) => spawnSync('git', ['merge-base', '--is-ancestor', c, trustedBase], { cwd }).status === 0;
  const inScope = new Set(range.filter((c) => !isAncestorOfBase(c)));

  const dir = mkdtempSync(join(tmpdir(), 'sigcheck-'));
  const cache = new Map();
  // The allowed signers published in a commit's tree: { file, sessionOf }.
  const signersAt = (rev) => {
    const blob = tryGit('rev-parse', '--verify', '--quiet', `${rev}:team/keys.json`);
    if (!blob) return null;
    if (cache.has(blob)) return cache.get(blob);
    const doc = JSON.parse(git('cat-file', 'blob', blob));
    const keys = Array.isArray(doc) ? doc : doc.keys || [];
    const signers = [], sessionOf = new Map();
    for (const k of keys) {
      const agent = k.agent, pemText = k.bundle?.sign ?? k.public_key?.sign;
      if (!agent || !AGENT.test(agent) || !pemText || k.status === 'superseded') continue;
      const pem = join(dir, `${cache.size}-${signers.length}.pem`); writeFileSync(pem, pemText);
      const ssh = execFileSync('ssh-keygen', ['-i', '-m', 'PKCS8', '-f', pem], { encoding: 'utf8' }).trim().split(' ').slice(0, 2).join(' ');
      signers.push(`${agent} namespaces="git" ${ssh}`);
      if (!sessionOf.has(agent)) sessionOf.set(agent, new Set());
      if (k.session) sessionOf.get(agent).add(k.session);
    }
    const file = join(dir, `allowed_signers_${cache.size}`); writeFileSync(file, signers.join('\n') + '\n');
    const r = { file, sessionOf }; cache.set(blob, r); return r;
  };

  try {
    const errors = []; let checked = 0;
    for (const c of range) {
      if (!inScope.has(c)) continue;
      checked++;
      const subject = git('log', '-1', '--format=%s', c);
      const parent = signersAt(`${c}^1`);
      if (!parent) { errors.push(`${c.slice(0, 7)} ${subject}: its parent has no team/keys.json`); continue; }
      const agents = lines(git('log', '-1', '--format=%(trailers:key=Agent,valueonly)', c));
      const sessions = lines(git('log', '-1', '--format=%(trailers:key=Claude-Session,valueonly)', c));
      const v = spawnSync('git', ['-c', 'gpg.format=ssh', '-c', 'gpg.ssh.program=ssh-keygen', '-c', `gpg.ssh.allowedSignersFile=${parent.file}`, 'verify-commit', c], { cwd, encoding: 'utf8' });
      if (v.status !== 0) { errors.push(`${c.slice(0, 7)} ${subject}: no valid signature by a key in its parent's team/keys.json`); continue; }
      const principal = (`${v.stdout}\n${v.stderr}`.match(/Good "git" signature for (\S+)/) || [])[1];
      if (!principal || agents.length !== 1 || agents[0] !== principal) { errors.push(`${c.slice(0, 7)} ${subject}: signed by ${principal || 'unknown'}, Agent: ${agents.join(', ') || 'none'}`); continue; }
      if (sessions.length !== 1 || !(parent.sessionOf.get(principal) || new Set()).has(sessions[0])) errors.push(`${c.slice(0, 7)} ${subject}: Claude-Session: missing or not the session published with ${principal}'s key`);
    }
    return { errors, checked, skipped: range.length - checked };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [before, after] = process.argv.slice(2);
  const r = checkSignatures({ before, after: after || 'HEAD' });
  if (r.errors.length) { console.error(r.errors.join('\n')); console.error(`FAILED (${r.errors.length} of ${r.checked} commits checked)`); process.exit(1); }
  console.log(`OK (${r.checked} signed commits checked, ${r.skipped} older than the trusted base skipped)`);
}
