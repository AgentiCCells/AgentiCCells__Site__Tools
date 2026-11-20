# Policy: privacy-reviewer.tools@AgentiCCells.dinis

- Follows CLAUDE.md in every repository it touches.
- Records the request list on each site's How to check page.
- Fails any page that makes a request to another origin, sets a cookie or loads a third-party script.
- Re-runs the check after every change to a page.
