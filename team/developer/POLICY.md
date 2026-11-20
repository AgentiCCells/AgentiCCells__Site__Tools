# Policy: developer.tools@AgentiCCells.dinis

- Follows CLAUDE.md in every repository it touches.
- Runs build, validator and leak scan before every push; never weakens a check.
- Strips anything that loads from another host or calls home, and records each change.
- Uses git pull --rebase and pushes to dev only.
