// new-list.mjs — scaffold a NEW shared checklist from this template.
//
// Creates <slug>-wiki/ with a starter tasks.json, a tiddlywiki.info, and a copy of
// build-seed.mjs, so the repo works as a generic "shared checklist" template (moving-house
// being just one instance).
//
//   node new-list.mjs "Garden Project" garden
//     -> creates garden-wiki/ with bag/recipe "garden", dashboard "Garden Project Tasks".
//
//   args: <Display Title> [slug]   (slug defaults to a kebab-case of the title)
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const title = process.argv[2];
if (!title) {
  console.error('Usage: node new-list.mjs "<Display Title>" [slug]');
  process.exit(1);
}
const slug = (process.argv[3] || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const dir = resolve(HERE, `${slug}-wiki`);
if (existsSync(dir)) { console.error(`Refusing to overwrite existing ${dir}`); process.exit(1); }

mkdirSync(resolve(dir, "tiddlers"), { recursive: true });

const tasks = {
  list: {
    title: `${title} Tasks`,
    intro: "Shared checklist — tick a task and everyone sees it.",
    bag: slug,
    recipe: slug,
    description: `${title} shared task list`,
    membersTiddler: `$:/${slug}/members`,
  },
  _comment: "A task is a string, or {title, group?, shared?}. shared:true = each member completes their own part.",
  sections: [
    { name: "To do", tasks: [
      "First task",
      "Second task",
      { title: "A task everyone must do individually", shared: true },
    ] },
    { name: "Later", tasks: ["Another task"] },
  ],
};
writeFileSync(resolve(dir, "tasks.json"), JSON.stringify(tasks, null, 2) + "\n");

writeFileSync(resolve(dir, "tiddlywiki.info"), JSON.stringify({
  description: `${title} — shared task list`,
  plugins: [],
  themes: ["tiddlywiki/vanilla", "tiddlywiki/snowwhite"],
  build: {},
}, null, 2) + "\n");

copyFileSync(resolve(HERE, "moving-house-wiki", "build-seed.mjs"), resolve(dir, "build-seed.mjs"));

console.log(`Scaffolded ${dir}`);
console.log("Next:");
console.log(`  1. Edit ${slug}-wiki/tasks.json (your sections/tasks).`);
console.log(`  2. node ${slug}-wiki/build-seed.mjs`);
console.log(`  3. First load only (see CUSTOMISING.md): load-wiki-folder ${slug}-wiki --bag-name ${slug} --recipe-name ${slug} ...`);
console.log(`  4. Grant access + roster: adapt seed-household.mjs (set the recipe/roster to "${slug}").`);
