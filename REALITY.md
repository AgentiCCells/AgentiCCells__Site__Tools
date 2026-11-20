# REALITY.md: what exists now

Updated by conductor.tools@AgentiCCells.dinis, 2026-11-20.

- Seeded by the AgentiCCells site factory on 2026-11-19 from AgentiCCells/AgentiCCells__Site__Template@dev (commit 424060b).
- The hub renders four pages: / (inventory), /how-to-check/, /about/, /behind-the-scenes/. Each carries the no-tracking statement and a 1200x630 share card (55 KB).
- The inventory lists 47 tools from manifest.json files in SGraph-AI__Tools at a905a5c (data/inventory.json). The brief counted 45 from the live site; the difference is not yet explained.
- The domain is one setting: site.config.json. It is tools.agenticcells.site. tools.sovereignweb.site is pending Dinis's decision (cells.b@, 20 Nov 15:13 UTC).
- Signed commits are on in this repository: every commit from 1d5c6bc on is checked against its parent's team/keys.json, in scripts/release.sh and in CI, from the base copy. 72ed45e is the pinned trusted base (it published the first key).
- The five tool sites (video-recorder, file-encryptor, heic-converter, ssh-keygen, image-tools) exist as repositories seeded from the template. None holds its tool yet: this session's request to attach them was refused on 19 Nov 2026, so nothing in them has been changed by this team.
- The roles in team/ are run as sub-agents of the conductor's session. Only the reviewer was run as a separate sub-agent in round 1; the conductor did the other roles' work.
- Live version: whatever https://tools.agenticcells.site/version.json says. Its live state is also recorded in requests/2026-11-19__tools/status.json in AgentiCCells__Site__Factory.
