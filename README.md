# Moving House — shared family task list

The HomeOwners Alliance **Moving House Checklist** turned into a shared, multi-user
task app: each family member sees what the others have ticked off, and can add notes
per task. It runs on a self-hosted [TiddlyWiki MultiWikiServer (MWS)](https://github.com/TiddlyWiki/MultiWikiServer)
— specifically the fork below — and is reached from phones over a private Tailscale network.

This app is **one example use case** of that fork, which is a general-purpose
*"multiple users, multiple wikis"* TiddlyWiki server. The fork's admin was rewritten from
React to HTMX to cut dependencies, lighten the runtime footprint, and shrink the
supply-chain attack surface — this family task list is the concrete use case that drove
those changes, but the server is not specialised to it.

## Requires (the server it deploys onto)

This repo is **content + deployment tooling only**. It deploys against the MWS fork:

> **`dxcSithLord/MultiWikiServer` @ branch `Alternative-to-react`**
> (React admin replaced with a zero-build HTMX admin; OPAQUE auth; role-based ACL;
> `reset-password` CLI; OpenAPI spec; deployed via `tailscale serve`.)

Clone and build that fork first — see its `ARCHITECTURE.md` for the design and
`docs/operations.md` for the canonical server deployment runbook (systemd, Tailscale Serve,
`secure=true`, backups); `docs/security.md` covers the auth/CSRF/FIPS posture. This repo's
scripts talk to it; set `MWS_DIR` to your fork checkout when running scripts here.

## Contents

| Path | What it is |
|---|---|
| `moving-house-wiki/` | The seed TiddlyWiki folder (`tiddlywiki.info` + `tiddlers/`). |
| `moving-house-wiki/build-seed.mjs` | Re-runnable generator — emits the 37 task tiddlers, 5 section tiddlers, the "Moving House Tasks" dashboard (core `$checkbox`/`$list` widgets, per-task `💬 notes` via `{{transclude}}`/`[[link]]`), and a stylesheet. |
| `seed-household.mjs` | Creates a `household` role + family-member users (one-time temp passwords) and grants READ+WRITE on the `moving-house` bag/recipe. Drives the admin HTTP API. |
| `DEPLOY-PI.md` | Raspberry Pi 400 + Tailscale deployment runbook. |
| `Moving-House-Checklist.md` / `.pdf` | The source checklist (origin of the task list). |

## Deploy (summary — full steps in `DEPLOY-PI.md`)

```sh
# 1. Build + init the MWS fork (separate checkout); note its path as $MWS_DIR.
#    e.g. MWS_DIR=~/src/movinghouse/mws-fork

# 2. Load the task list into a `moving-house` bag + recipe (run from the fork dir):
cd "$MWS_DIR"
ENABLE_DEV_SERVER=mws ENABLE_EXTERNAL_PLUGINS=1 node mws.dev.mjs load-wiki-folder \
  /path/to/moving-house-app/moving-house-wiki \
  --bag-name moving-house --bag-description "Moving House shared family task list" \
  --recipe-name moving-house --recipe-description "Moving House shared family task list"
# (add --overwrite to re-seed; that resets task done-states)

# 3. With the server running, create the household role + members + ACL:
MWS_DIR="$MWS_DIR" MWS_MEMBERS="alice,bob,carol" node /path/to/moving-house-app/seed-household.mjs

# 4. Re-generate the seed tiddlers after editing build-seed.mjs:
node moving-house-wiki/build-seed.mjs
```

## Notes
- Family members each get their own MWS login, so the `done-by` attribution on tasks
  is real (not the browser's `$:/status/UserName`).
- The seed source lives here; the running data lives in the server's SQLite store.
- Reached over Tailscale (`tailscale serve` HTTPS); not exposed publicly.
