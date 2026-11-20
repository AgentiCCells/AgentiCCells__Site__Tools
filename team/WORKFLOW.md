# Workflow: the tools family

1. **Brief.** The conductor reads Dinis's words in the Factory briefs and keeps them, with their times, in each repository's brief.
2. **Research.** The researcher reads the upstream tool at the pinned commit and records sources.
3. **Design.** The designer keeps one design for all six sites; each site holds its own copy.
4. **Build.** The developer builds the site, vendors the tool, strips other-host loads and runs build, validator and leak scan.
5. **Write.** The writer writes the documentation pages.
6. **Review.** The reviewer passes or fails each site; the privacy reviewer records every network request in a headless browser.
7. **Release.** scripts/release.sh runs every gate, including the signed-commit and symlink checks from the base copy, then pushes to dev. CI deploys and tags v0.1.N.
8. **Report.** The conductor writes team/rounds/<n>.md and sends cells.b@ one line.

At most five rounds for the whole family. Stop earlier when the reviewer passes all six sites. When done, the conductor writes team/HANDOVER.md and stops.
