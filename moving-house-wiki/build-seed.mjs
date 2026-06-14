// Generates the Moving House task tiddlers from the source checklist.
// Re-runnable: rewrites tiddlers/ deterministically. Load into MWS with:
//   npm start load-wiki-folder <this-folder> --bag-name moving-house \
//     --bag-description "..." --recipe-name moving-house --recipe-description "..."
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TID = resolve(HERE, "tiddlers");
const TS = "20260612000000000"; // fixed created/modified for deterministic output

// [sectionName, [ item | { t, g } ]]  — g = optional sub-group ("Sort Utilities")
const sections = [
  ["After Your Offer's Been Accepted", [
    "Instruct a conveyancing solicitor",
    "Book a house survey",
    "Arrange your mortgage application",
    "Consider Home Buyer's Insurance",
    "De-clutter your home",
    "Get quotes from removal companies",
  ]],
  ["Between Exchange and Completion", [
    "Confirm and book your chosen removal company",
    "Sort Utilities",
    { t: "Notify energy suppliers", g: "Sort Utilities" },
    { t: "Notify water supplier", g: "Sort Utilities" },
    { t: "Notify council tax office", g: "Sort Utilities" },
    { t: "Arrange broadband", g: "Sort Utilities" },
    "Start packing",
    "Arrange contents insurance for your new home",
    "Collect all keys together",
    "Organise a post redirection",
    "Cancel milk, subscription boxes, and newspaper deliveries",
    "If moving to a new area, register with a GP and dentist",
    "Clean your house",
  ]],
  ["Change of Address Checklist", [
    "Notify HM Revenue and Customs",
    "Notify DVLA",
    "Update electoral roll registration",
    "Notify TV Licensing",
    "Update online shopping delivery addresses",
    "Notify employers",
    "Notify children's schools",
    "Notify friends, family, colleagues",
    "Notify insurance providers, including life insurance",
    "Notify GP and dentist",
  ]],
  ["On Move Day", [
    "Take meter readings.",
    "Do a final clean and walk-through of your old home",
    "Lock up and leave your keys with your estate agent",
    "Collect your new keys",
    "Oversee removals company collection/delivery of your things",
  ]],
  ["After Moving In", [
    "Check utilities and alarms are working",
    "Change the locks",
    "Alert your surveyor to any unexpected faults in your new home",
  ]],
];

// .tid filenames cannot contain "/"; slugify for the filename only — the real
// title lives in the title: field so the slug is cosmetic.
const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// Serialise a tiddler: header fields, blank line, body.
const tid = (fields, body = "") =>
  Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\n" + body + "\n";

rmSync(TID, { recursive: true, force: true });
mkdirSync(TID, { recursive: true });

let count = 0;

sections.forEach(([section, items], si) => {
  // One ordering tiddler per section.
  writeFileSync(resolve(TID, `_section-${slug(section)}.tid`), tid({
    title: section,
    tags: "task-section",
    order: String((si + 1) * 100),
    created: TS, modified: TS,
    type: "text/vnd.tiddlywiki",
  }));

  items.forEach((item, ii) => {
    const title = typeof item === "string" ? item : item.t;
    const group = typeof item === "string" ? "" : item.g;
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
    writeFileSync(resolve(TID, `${String(fields.order)}-${slug(title)}.tid`), tid(fields));
    count++;
  });
});

// The dashboard: built from TiddlyWiki core widgets only (checkbox + list).
// Ticking a task sets done=yes (and records who/when); MWS stores each tiddler
// as its own row, so other family members see the change on sync.
const view = [
  // Absolute link back to the MWS app root (the wiki render has no other way out,
  // especially on phones). "/" is the server front door -> admin home / login.
  "<a href=\"/\" class=\"mh-home\">🏠 MWS home</a>",
  "",
  "!! Moving House Tasks",
  "",
  "Shared checklist — tick a task and everyone sees it.",
  "''<$count filter=\"[tag[task]field:done[yes]]\"/>'' of ''<$count filter=\"[tag[task]]\"/>'' tasks done.",
  "",
  "<$list filter=\"[tag[task-section]nsort[order]]\" variable=\"section\">",
  "",
  "!!! <$text text=<<section>>/> (<$text text={{{ [tag[task]field:section<section>field:done[yes]count[]] }}}/>/<$text text={{{ [tag[task]field:section<section>count[]] }}}/>)",
  "",
  "<$list filter=\"[tag[task]field:section<section>nsort[order]]\" variable=\"taskTitle\">",
  "<$tiddler tiddler=<<taskTitle>>>",
  "<div class=\"mh-task\">",
  "<$checkbox field=\"done\" checked=\"yes\" unchecked=\"no\" actions=\"\"\"",
  "<$action-setfield $field=\"done-by\" $value={{{ [{!!done}match[yes]then{$:/status/UserName}] }}}/>",
  "<$action-setfield $field=\"done-at\" $value=<<now [UTC]YYYY-0MM-0DD0hh:0mm>>/>",
  "\"\"\">&#32;<$list filter=\"[{!!group}!is[blank]]\" variable=\"x\">↳ </$list><$text text=<<taskTitle>>/></$checkbox>",
  "<$list filter=\"[{!!done}match[yes]]\" variable=\"x\"><span class=\"mh-by\"> ✓ <$text text={{!!done-by}}/> <$text text={{!!done-at}}/></span></$list>",
  // Comments as DISCRETE, append-only tiddlers — one MWS row per comment, so concurrent
  // authors never overwrite each other (replaces the old single-notes last-write-wins).
  // Collapsed behind a <details> with a count; a read-only legacy note is shown above the
  // thread if an old "<task> (notes)" tiddler still exists.
  "<$set name=\"notesTitle\" value={{{ [<taskTitle>addsuffix[ (notes)]] }}}>",
  "<$set name=\"draftTitle\" value={{{ [<taskTitle>addprefix[$:/state/moving-house/draft/]] }}}>",
  "&#32;<details class=\"mh-details\"><summary class=\"mh-c\">💬 <$count filter=\"[tag[task-comment]field:comment-of<taskTitle>]\"/></summary>",
  "<div class=\"mh-thread\">",
  "<$list filter=\"[<notesTitle>is[tiddler]has[text]]\" variable=\"x\"><div class=\"mh-notes\"><span class=\"mh-cby\">note (legacy)</span><div class=\"mh-ctext\"><$transclude tiddler=<<notesTitle>> mode=\"block\"/></div></div></$list>",
  "<$list filter=\"[tag[task-comment]field:comment-of<taskTitle>nsort[created]]\" variable=\"cmt\">",
  "<div class=\"mh-comment\"><span class=\"mh-cby\"><$text text={{{ [<cmt>get[comment-by]] }}}/></span> <span class=\"mh-cat\"><$text text={{{ [<cmt>get[comment-at]] }}}/></span><div class=\"mh-ctext\"><$transclude tiddler=<<cmt>> mode=\"block\"/></div></div>",
  "</$list>",
  "<div class=\"mh-add\"><$edit-text tiddler=<<draftTitle>> field=\"text\" tag=\"textarea\" class=\"mh-input\" placeholder=\"Add a comment…\"/>",
  "<$button class=\"mh-addbtn\"><$list filter=\"[<draftTitle>get[text]!is[blank]]\" variable=\"x\">",
  "<$vars nowstamp=<<now [UTC]YYYY0MM0DD0hh0mm0ssXXX>>>",
  "<$action-createtiddler $basetitle={{{ [<taskTitle>] [{$:/status/UserName}] [<nowstamp>] +[join[ :: ]addprefix[mh-comment :: ]] }}} tags=\"task-comment\" comment-of=<<taskTitle>> comment-by={{$:/status/UserName}} comment-at=<<now [UTC]YYYY-0MM-0DD0hh:0mm>> type=\"text/vnd.tiddlywiki\" text={{{ [<draftTitle>get[text]] }}}/>",
  "<$action-deletetiddler $tiddler=<<draftTitle>>/>",
  "</$vars></$list>Add comment</$button>",
  "</div>",
  "</div>",
  "</details>",
  "</$set></$set>",
  "</div>",
  "</$tiddler>",
  "</$list>",
  "</$list>",
  "",
].join("\n");

writeFileSync(resolve(TID, "Moving House Tasks.tid"), tid({
  title: "Moving House Tasks",
  type: "text/vnd.tiddlywiki",
  created: TS, modified: TS,
}, view));

// Small stylesheet for the task rows.
const css = [
  ".mh-task { margin: .25em 0; }",
  ".mh-by { color: #6a8a4a; font-size: .82em; margin-left: .5em; }",
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
writeFileSync(resolve(TID, "$__moving-house_style.tid"), tid({
  title: "$:/moving-house/style",
  tags: "$:/tags/Stylesheet",
  type: "text/vnd.tiddlywiki",
}, css));

// Default tiddler: open the dashboard on load.
writeFileSync(resolve(TID, "$__DefaultTiddlers.tid"), tid({
  title: "$:/DefaultTiddlers",
  type: "text/vnd.tiddlywiki",
}, "[[Moving House Tasks]]"));

console.log(`Wrote ${count} task tiddlers + ${sections.length} section tiddlers + defaults to ${TID}`);
