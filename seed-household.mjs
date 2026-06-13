// seed-household.mjs — create the family "household" role + members and grant
// them access to the moving-house task list. Idempotent and reproducible: runs
// the same against a local dev server or the deployed Pi. Drives the admin HTTP
// API (no fork code changes).
//
//   node seed-household.mjs
//
// Override via env: MWS_URL, MWS_ADMIN_USER, MWS_ADMIN_PASS, MWS_MEMBERS (comma list),
// MWS_DIR (path to the MWS install whose node_modules has @serenity-kit/opaque).
import { createRequire } from "module";
import { pathToFileURL, fileURLToPath } from "url";
import { resolve, dirname } from "path";

// Resolve the OPAQUE client from the MWS install (this script lives outside it).
const HERE = dirname(fileURLToPath(import.meta.url));
const MWS_DIR = process.env.MWS_DIR || resolve(HERE, "mws-fork");
const req = createRequire(pathToFileURL(resolve(MWS_DIR, "package.json")));
const opaque = await import(pathToFileURL(req.resolve("@serenity-kit/opaque/esm/index.js")).href);

const BASE = process.env.MWS_URL || "http://[::1]:8080";
const ADMIN_USER = process.env.MWS_ADMIN_USER || "admin";
const ADMIN_PASS = process.env.MWS_ADMIN_PASS || "1234";
const ROLE = "household";
const TARGET = "moving-house"; // bag AND recipe name
// Placeholder usernames — edit this list (or set MWS_MEMBERS=alice,bob,carol).
const MEMBERS = (process.env.MWS_MEMBERS || "member1,member2,member3")
  .split(",").map((s) => s.trim()).filter(Boolean);

const H = { "Content-Type": "application/json", "X-Requested-With": "TiddlyWiki" };

// --- OPAQUE login → returns the session cookie string ---
async function login(username, password) {
  await opaque.ready;
  const s = opaque.client.startLogin({ password });
  const r1 = await fetch(`${BASE}/login/1`, {
    method: "POST", headers: H,
    body: JSON.stringify({ username, startLoginRequest: s.startLoginRequest }),
  });
  if (!r1.ok) throw new Error(`login/1 (${username}): ${r1.status} ${await r1.text()}`);
  const { loginResponse, loginSession } = await r1.json();
  const fin = opaque.client.finishLogin({ clientLoginState: s.clientLoginState, loginResponse, password });
  if (!fin) throw new Error(`login (${username}): bad credentials`);
  const r2 = await fetch(`${BASE}/login/2`, {
    method: "POST", headers: H,
    body: JSON.stringify({ finishLoginRequest: fin.finishLoginRequest, loginSession }),
  });
  if (!r2.ok) throw new Error(`login/2 (${username}): ${r2.status} ${await r2.text()}`);
  return (r2.headers.get("set-cookie") || "").split(";")[0];
}

// --- admin API helper: POST /admin/<key> with the CSRF referer + cookie ---
function adminApi(cookie) {
  return async (key, data) => {
    const res = await fetch(`${BASE}/admin/${key}`, {
      method: "POST",
      headers: { ...H, "Cookie": cookie, "Referer": `${BASE}/admin-htmx` },
      body: JSON.stringify(data),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`admin/${key}: ${res.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };
}

async function main() {
  console.log(`Seeding household against ${BASE} ...`);
  const cookie = await login(ADMIN_USER, ADMIN_PASS);
  const api = adminApi(cookie);

  const index = await api("index_json", undefined);
  const roles = index.roleList || [];
  const users = index.userListAdmin || [];

  // 1. Ensure the household role.
  let role = roles.find((r) => r.role_name === ROLE);
  if (!role) {
    role = await api("role_create", { role_name: ROLE, description: "Family household members" });
    console.log(`  + created role '${ROLE}' (${role.role_id})`);
  } else {
    console.log(`  = role '${ROLE}' already exists (${role.role_id})`);
  }

  // 2. Create each member (if missing) and issue a one-time temp password.
  const creds = [];
  for (const username of MEMBERS) {
    let user = users.find((u) => u.username === username);
    if (!user) {
      user = await api("user_create", { username, email: `${username}@household.local`, role_ids: [role.role_id] });
      console.log(`  + created user '${username}' (${user.user_id})`);
    } else {
      console.log(`  = user '${username}' already exists (${user.user_id})`);
    }
    const { temporaryPassword } = await api("user_generate_temp_password", { user_id: user.user_id });
    creds.push({ username, temporaryPassword });
  }

  // 3. Grant the household role READ + WRITE on the moving-house bag and recipe.
  const acl = [
    { role_id: role.role_id, permission: "READ" },
    { role_id: role.role_id, permission: "WRITE" },
  ];
  await api("bag_acl_update", { bag_name: TARGET, acl });
  await api("recipe_acl_update", { recipe_name: TARGET, acl });
  console.log(`  + granted '${ROLE}' READ+WRITE on bag and recipe '${TARGET}'`);

  console.log("\nOne-time temporary passwords (members should change on first login):");
  for (const c of creds) console.log(`  ${c.username.padEnd(12)} ${c.temporaryPassword}`);
  console.log("\nDone.");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
