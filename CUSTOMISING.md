# Customising the list — and using this repo as a template

This repo is a **generic shared-checklist template** for the MWS fork. "Moving House" is just
one instance: the task list is data (`moving-house-wiki/tasks.json`), the dashboard is generated
from it (`build-seed.mjs`), and everything else (per-tiddler storage, multi-user sync, roles/ACL,
comments) comes from the server. Point it at a different `tasks.json` and you have a different
shared checklist.

> ## ⚠️ The one rule for a LIVE wiki
> **Never run `load-wiki-folder --overwrite` against a bag that already has data.** That command
> **replaces the entire bag** (it deletes every tiddler first), wiping done-states, comments, and
> per-person ticks. `--overwrite` is only for the **first** seed of an empty bag.
> To change a *running* wiki, edit **per tiddler** (wiki UI or the sync API) — see
> [Editing a live wiki](#editing-a-live-wiki). Per-tiddler edits sync as single rows and never
> clobber other data.

---

## The data model (just tiddlers)

The dashboard is filter-driven, so the "list" is simply tiddlers with these tags/fields:

| Tiddler | Tag | Key fields |
|---|---|---|
| **Task** | `task` | `section`, `order` (position), `done` (`yes`/`no`), `done-by`, `done-at`, optional `group`, optional `shared` (`yes`) |
| **Section heading** | `task-section` | `order` |
| **Comment** | `task-comment` | `comment-of`, `comment-by`, `comment-at`, body in `text` (append-only, one per comment) |
| **Per-person tick** | `task-done` | `done-of`, `done-by`, `done-at` (one per member, for `shared` tasks) |
| **Members roster** | — | `$:/<bag>/members`, a `list` field of usernames (written by `seed-household.mjs`) |

Because the dashboard lists `[tag[task]...]`, **any tiddler you add with `tags: task` + a
`section` + `order` appears automatically**, and deleting it removes it. That is what makes live
edits safe.

---

## 1. Add, edit, or remove list items

### In the source (`tasks.json`) — for a fresh deploy or to keep the repo authoritative
Edit `moving-house-wiki/tasks.json`. A task is a **string**, or an **object** for extras:

```jsonc
{
  "name": "Between Exchange and Completion",
  "tasks": [
    "Start packing",                                   // simple task
    "Sort Utilities",                                  // a heading-ish task...
    { "title": "Arrange broadband", "group": "Sort Utilities" },  // ...with sub-items (group)
    { "title": "Notify GP and dentist", "shared": true }          // everyone does their own (see §3)
  ]
}
```

Then regenerate and (for a **new/empty** wiki only) load it:

```sh
node moving-house-wiki/build-seed.mjs
# FIRST seed of an empty bag ONLY:
cd "$MWS_DIR" && ENABLE_DEV_SERVER=mws ENABLE_EXTERNAL_PLUGINS=1 node mws.dev.mjs \
  load-wiki-folder /path/to/moving-house-wiki \
  --bag-name moving-house --bag-description "…" \
  --recipe-name moving-house --recipe-description "…" --overwrite
```

### Editing a live wiki
Do **not** reload the folder. Instead, change individual tiddlers:

- **Add a task:** create a tiddler with `tags: task`, `section: <existing section>`,
  `order: <number>`, `done: no` (add `group: <heading>` for a sub-item). It appears under that
  section immediately. Create it from the wiki UI ("new tiddler"), or via the sync API:
  ```sh
  curl -X PUT "$BASE/recipe/moving-house/tiddlers/Walk%20the%20dog" \
    -H "X-Requested-With: TiddlyWiki" -H "Content-Type: application/json" -b "$COOKIE" \
    -d '{"title":"Walk the dog","tags":"task","section":"After Moving In","order":"550","done":"no"}'
  ```
- **Remove a task:** delete that one tiddler (UI delete, or `DELETE` the same URL).
- **Reorder:** change its `order` field.

Keep `tasks.json` in step with live changes by running [`export-tasks.mjs`](#4-round-trip-wiki--tasksjson).

## 2. Add a section
A section is a tiddler `tags: task-section`, `title: <name>`, `order: <n>`. Tasks with
`section: <name>` group beneath it. In `tasks.json` just add a new `{ "name": …, "tasks": [...] }`
block (order follows array position).

## 3. Tasks everyone must do individually (`shared`)
Set `"shared": true` on a task (or add a `shared: yes` field to its tiddler). Then:

- the single tick is replaced by **per-person completion** — each member presses **"I've done my
  part"**, which creates a discrete `task-done` tiddler for them (one row each, no clobber);
- the dashboard shows **"✓ N/M — names"** and marks the task **✅ all done** only when every
  member in the roster has done it;
- normal (single-owner) tasks are unchanged.

The roster is `$:/<bag>/members` (a `list` field of usernames). `seed-household.mjs` writes it
from your member list, so run that after creating members. Example: mark "Notify GP and dentist"
and "Notify HM Revenue and Customs" shared so each adult records their own.

---

## 4. Round-trip (wiki → `tasks.json`)
If an admin edits the structure live (adds/removes tasks, marks some shared), capture it back into
the repo from a **saved snapshot** of the wiki (TiddlyWiki "save snapshot for offline use", or the
browser's save):

```sh
node export-tasks.mjs ~/Downloads/moving-house.html        # -> moving-house-wiki/tasks.json
node moving-house-wiki/build-seed.mjs                      # regenerate (verify the diff)
```

It exports **structure only** (sections, tasks, `group`, `shared`) — never runtime data
(done-states, comments, ticks), which stay in the wiki. Always check the section/task counts after.

## 5. A brand-new list (new template instance)
```sh
node new-list.mjs "Garden Project" garden      # -> garden-wiki/ (bag/recipe "garden")
$EDITOR garden-wiki/tasks.json                 # your sections/tasks
node garden-wiki/build-seed.mjs
# first load (empty bag) + grant access; adapt seed-household.mjs's recipe/roster to "garden"
```

Each list is its own bag + recipe (own ACL, own dashboard at `/wiki/<recipe>`), so multiple
checklists can coexist on one server without interfering.

---

## Deploy summary
- **First seed** of an empty bag → `load-wiki-folder … --overwrite` is fine.
- **Live wiki** → per-tiddler add/edit/delete only (UI or sync API). Never `--overwrite`.
- Server operations (build, systemd, Tailscale Serve, `secure=true`, backups) live in the fork's
  `docs/operations.md`; security posture in `docs/security.md`.
