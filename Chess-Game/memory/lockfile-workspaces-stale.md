---
name: lockfile-workspaces-stale
description: Why package-lock.json diffs look large when installing a new dep — the functions/packages workspaces are gone
metadata:
  type: project
---

`package-lock.json` still carried `"workspaces": ["packages/*", "functions"]` and an internal `"@chess-game/chess-engine"` dependency, but **neither `functions/` nor `packages/` exists on disk and neither is git-tracked**. So when `npm install` (e.g. tippy.js) ran, it dropped the stale workspace entries, making the lockfile diff look huge (~2400 lines removed). That cleanup is correct, not breakage.

**Why:** the engine was folded into `src/engine` (see [[chessops-import-path]]); the `functions`/`packages` dirs were removed early (commit "initial commit" era) but the lockfile was never regenerated, leaving the references behind.

**How to apply:** when a new-dependency install shows a very large `package-lock.json` diff, diff it for the removed `functions`/`packages`/`@chess-game/*` entries first — that's the stale-workspace cleanup, safe to keep. Don't re-add the workspace lines.
