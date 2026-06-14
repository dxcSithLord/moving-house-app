// Generates a shared task-list wiki from a data file (tasks.json) — re-runnable.
// This makes the repo a generic template: edit tasks.json (or scaffold a new list with
// ../new-list.mjs) and re-run this to regenerate tiddlers/.
//
//   node build-seed.mjs
//
// Then load into MWS (FIRST seed only — load-wiki-folder --overwrite REPLACES the bag;
// for a LIVE wiki edit tiddlers individually, see ../CUSTOMISING.md):
//   node mws.dev.mjs load-wiki-folder <this-folder> --bag-name <bag> ... --recipe-name <recipe> ...
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TID = resolve(HERE, "tiddlers");
const TS = "20260612000000000"; // fixed created/modified for deterministic output

const data = JSON.parse(readFileSync(resolve(HERE, "tasks.json"), "utf8"));
const list = data.list;
const sections = data.sections;
const membersTiddler = list.membersTiddler || "$:/moving-house/members";
const ns = list.bag || "moving-house"; // namespace for style/draft state tiddlers (clone-safe)
// TiddlyWiki date format (a space between date and time — fixes the run-together stamp).
const DATEFMT = "YYYY-0MM-0DD 0hh:0mm";

// .tid filenames cannot contain "/"; slugify for the filename only — the real title
// lives in the title: field so the slug is cosmetic.
const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const tid = (fields, body = "") =>
  Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\n" + body + "\n";

rmSync(TID, { recursive: true, force: true });
mkdirSync(TID, { recursive: true });

let count = 0, shared = 0;

sections.forEach((sec, si) => {
  const section = sec.name;
  writeFileSync(resolve(TID, `_section-${slug(section)}.tid`), tid({
    title: section,
    tags: "task-section",
    order: String((si + 1) * 100),
    created: TS, modified: TS,
    type: "text/vnd.tiddlywiki",
  }));

  sec.tasks.forEach((item, ii) => {
    const title = typeof item === "string" ? item : item.title;
    const group = typeof item === "string" ? "" : (item.group || "");
    const isShared = typeof item === "object" && !!item.shared;
    const fields = {
      title,
      tags: "task",
      section,
      order: String((si + 1) * 100 + (ii + 1)),
      done: "no",
      "done-by": "",
      "done-at": "",
      created: TS, modified: TS,
      type: "text/vnd.tiddlywiki",
    };
    if (group) fields.group = group;
    if (isShared) { fields.shared = "yes"; shared++; }
    writeFileSync(resolve(TID, `${String(fields.order)}-${slug(title)}.tid`), tid(fields));
    count++;
  });
});

// The dashboard. Core widgets only. Each task row branches on its `shared` field:
//  - normal task: a single shared checkbox (done / done-by / done-at).
//  - shared task: per-person completion — each member ticks their OWN part, stored as a
//    discrete `task-done` tiddler (one row per member, no clobber). Complete only when every
//    member listed in the members roster has done it.
// Comments (append-only `task-comment` tiddlers) hang off every task.
const view = [
  `<a href="/" class="mh-home">🏠 MWS home</a>`,
  "",
  `!! ${list.title}`,
  "",
  list.intro || "",
  `''<$count filter="[tag[task]field:done[yes]]"/>'' of ''<$count filter="[tag[task]]"/>'' single-owner tasks done.`,
  "",
  `<$list filter="[tag[task-section]nsort[order]]" variable="section">`,
  "",
  `!!! <$text text=<<section>>/> (<$text text={{{ [tag[task]field:section<section>field:done[yes]count[]] }}}/>/<$text text={{{ [tag[task]field:section<section>count[]] }}}/>)`,
  "",
  `<$list filter="[tag[task]field:section<section>nsort[order]]" variable="taskTitle">`,
  `<$tiddler tiddler=<<taskTitle>>>`,
  `<div class="mh-task">`,

  // --- normal (single-owner) task ---
  `<$list filter="[{!!shared}!match[yes]]" variable="x">`,
  `<$checkbox field="done" checked="yes" unchecked="no" actions="""`,
  `<$action-setfield $field="done-by" $value={{{ [{!!done}match[yes]then{$:/status/UserName}] }}}/>`,
  `<$action-setfield $field="done-at" $value=<<now [UTC]${DATEFMT}>>/>`,
  `""">&#32;<$list filter="[{!!group}!is[blank]]" variable="g">↳ </$list><$text text=<<taskTitle>>/></$checkbox>`,
  `<$list filter="[{!!done}match[yes]]" variable="x"><span class="mh-by"> ✓ <$text text={{!!done-by}}/> <$text text={{!!done-at}}/></span></$list>`,
  `</$list>`,

  // --- shared (everyone-individually) task ---
  `<$list filter="[{!!shared}match[yes]]" variable="x">`,
  `<$set name="myDoneTitle" value={{{ [<taskTitle>] [{$:/status/UserName}] +[join[ :: ]addprefix[task-done :: ]] }}}>`,
  `<$set name="doneN" value={{{ [tag[task-done]field:done-of<taskTitle>count[]] }}}>`,
  `<$set name="memberN" value={{{ [list[${membersTiddler}]count[]] }}}>`,
  `<span class="mh-shared-name"><$list filter="[{!!group}!is[blank]]" variable="g">↳ </$list><$text text=<<taskTitle>>/> <span class="mh-everyone">everyone</span></span>`,
  `<span class="mh-prog">✓ <$text text=<<doneN>>/>/<$text text=<<memberN>>/></span>`,
  `<$list filter="[<doneN>compare:integer:gteq<memberN>] :filter[<memberN>compare:integer:gteq[1]]" variable="x"><span class="mh-allgood"> ✅ all done</span></$list>`,
  `<$list filter="[tag[task-done]field:done-of<taskTitle>nsort[done-at]]" variable="d"><span class="mh-who">✓ <$text text={{{ [<d>get[done-by]] }}}/></span></$list>`,
  `<$list filter="[<myDoneTitle>!is[tiddler]]" variable="x"><$button class="mh-mine-btn"><$action-createtiddler $basetitle=<<myDoneTitle>> tags="task-done" done-of=<<taskTitle>> done-by={{$:/status/UserName}} done-at=<<now [UTC]${DATEFMT}>>/>I've done my part</$button></$list>`,
  `<$list filter="[<myDoneTitle>is[tiddler]]" variable="x"><$button class="mh-undo"><$action-deletetiddler $tiddler=<<myDoneTitle>>/>undo mine</$button></$list>`,
  `</$set></$set></$set>`,
  `</$list>`,

  // --- comments (discrete, append-only) for every task ---
  `<$set name="notesTitle" value={{{ [<taskTitle>addsuffix[ (notes)]] }}}>`,
  `<$set name="draftTitle" value={{{ [<taskTitle>addprefix[$:/state/${ns}/draft/]] }}}>`,
  `&#32;<details class="mh-details"><summary class="mh-c">💬 <$count filter="[tag[task-comment]field:comment-of<taskTitle>]"/></summary>`,
  `<div class="mh-thread">`,
  `<$list filter="[<notesTitle>is[tiddler]has[text]]" variable="x"><div class="mh-notes"><span class="mh-cby">note (legacy)</span><div class="mh-ctext"><$transclude tiddler=<<notesTitle>> mode="block"/></div></div></$list>`,
  `<$list filter="[tag[task-comment]field:comment-of<taskTitle>nsort[created]]" variable="cmt">`,
  `<div class="mh-comment"><span class="mh-cby"><$text text={{{ [<cmt>get[comment-by]] }}}/></span> <span class="mh-cat"><$text text={{{ [<cmt>get[comment-at]] }}}/></span><div class="mh-ctext"><$transclude tiddler=<<cmt>> mode="block"/></div></div>`,
  `</$list>`,
  `<div class="mh-add"><$edit-text tiddler=<<draftTitle>> field="text" tag="textarea" class="mh-input" placeholder="Add a comment…"/>`,
  `<$button class="mh-addbtn"><$list filter="[<draftTitle>get[text]!is[blank]]" variable="x">`,
  `<$vars nowstamp=<<now [UTC]YYYY0MM0DD0hh0mm0ssXXX>>>`,
  `<$action-createtiddler $basetitle={{{ [<taskTitle>] [{$:/status/UserName}] [<nowstamp>] +[join[ :: ]addprefix[mh-comment :: ]] }}} tags="task-comment" comment-of=<<taskTitle>> comment-by={{$:/status/UserName}} comment-at=<<now [UTC]${DATEFMT}>> type="text/vnd.tiddlywiki" text={{{ [<draftTitle>get[text]] }}}/>`,
  `<$action-deletetiddler $tiddler=<<draftTitle>>/>`,
  `</$vars></$list>Add comment</$button>`,
  `</div>`,
  `</div>`,
  `</details>`,
  `</$set></$set>`,

  `</div>`,
  `</$tiddler>`,
  `</$list>`,
  `</$list>`,
  "",
].join("\n");

writeFileSync(resolve(TID, `${slug(list.title)}.tid`), tid({
  title: list.title,
  type: "text/vnd.tiddlywiki",
  created: TS, modified: TS,
}, view));

// Stylesheet.
const css = [
  ".mh-task { margin: .25em 0; }",
  ".mh-by { color: #6a8a4a; font-size: .82em; margin-left: .5em; }",
  ".mh-shared-name { font-weight: 600; }",
  ".mh-everyone { font-size: .7em; font-weight: 400; color: #fff; background: #7a9; border-radius: 3px; padding: 0 .35em; vertical-align: middle; }",
  ".mh-prog { font-size: .82em; color: #4a6a8a; margin-left: .5em; }",
  ".mh-allgood { color: #2e7d32; font-weight: 600; font-size: .82em; }",
  ".mh-who { font-size: .78em; color: #6a8a4a; margin-left: .4em; }",
  ".mh-mine-btn, .mh-undo { font-size: .8em; margin-left: .5em; }",
  ".mh-details { display: inline-block; margin-left: .4em; }",
  ".mh-c { cursor: pointer; font-size: .82em; color: #6a6a6a; }",
  ".mh-thread { margin: .2em 0 .4em 1.6em; }",
  ".mh-comment { margin: .25em 0; padding: .3em .6em; border-left: 3px solid #cdd9c0; background: #f6f8f2; }",
  ".mh-cby { font-weight: 600; font-size: .82em; color: #4a6a8a; }",
  ".mh-cat { font-size: .75em; color: #999; margin-left: .4em; }",
  ".mh-ctext { margin-top: .15em; }",
  ".mh-add { margin: .35em 0; }",
  ".mh-input { width: 100%; box-sizing: border-box; min-height: 2.4em; }",
  ".mh-addbtn { margin-top: .25em; }",
  ".mh-notes { margin: .25em 0; padding: .3em .6em; border-left: 3px solid #e0d6b0; background: #faf7ea; }",
  ".mh-home { display: inline-block; margin: 0 0 .6em; padding: .4em .8em; background: #eef3ff; border: 1px solid #c7d6f0; border-radius: 6px; text-decoration: none; }",
].join("\n");
writeFileSync(resolve(TID, "_style.tid"), tid({
  title: `$:/${ns}/style`,
  tags: "$:/tags/Stylesheet",
  type: "text/vnd.tiddlywiki",
}, css));

writeFileSync(resolve(TID, "$__DefaultTiddlers.tid"), tid({
  title: "$:/DefaultTiddlers",
  type: "text/vnd.tiddlywiki",
}, `[[${list.title}]]`));

console.log(`Wrote ${count} task tiddlers (${shared} shared) + ${sections.length} sections + dashboard "${list.title}" to ${TID}`);
