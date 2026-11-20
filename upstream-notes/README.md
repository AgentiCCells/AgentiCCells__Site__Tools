# Notes for the SGraph-AI__Tools team

Changes that could go back upstream. We never push to SGraph-AI__Tools; a person passes these on.

1. **Descriptions use em dashes** (e.g. video-recorder's manifest.json at a905a5c). Our family style has none, so the hub shows them as colons. Optional.
2. **Two tool folders use "id" not "slug"** in manifest.json: `en-gb/vault-mgr` (v0.1.51) and `en-gb/auth-mvp` (v0.1.50). Tools that list manifests by slug miss them.
3. **Category case**: sg-video-editor uses "Media"; the others use lower case.
4. **No NOTICE file** at a905a5c. Not required by Apache-2.0, recorded because the brief asks us to keep one if present.
