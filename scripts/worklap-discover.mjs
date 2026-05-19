#!/usr/bin/env node
// Discover Worklap UUIDs you need to configure the portal.
//
// Loads .env.local from the project root, logs in, and:
//   1. Lists projects you have access to (pick one → WORKLAP_PROJECT_UUID)
//   2. Lists users in that project (find Pavan → WORKLAP_ASSIGNEE_USER_UUID)
//   3. Prints common work types / statuses Worklap exposes for the project
//
// Usage (from the project root):
//   node scripts/worklap-discover.mjs
//   node scripts/worklap-discover.mjs <projectUuid>      # to drill into a project

import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    v = v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const base = need("WORKLAP_API_URL").replace(/\/$/, "");

const COMMON_HEADERS = { "ngrok-skip-browser-warning": "true" };

async function login() {
  const res = await fetch(`${base}/auth/login/native`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...COMMON_HEADERS },
    body: JSON.stringify({ email: need("WORKLAP_EMAIL"), password: need("WORKLAP_PASSWORD") }),
  });
  if (!res.ok) {
    console.error("Login failed:", res.status, await res.text());
    process.exit(1);
  }
  const body = await res.json();
  const token = body?.response?.authToken;
  if (!token) {
    console.error("Could not find authToken in login response:", JSON.stringify(body).slice(0, 400));
    process.exit(1);
  }
  // Pretty-print what login told us — orgUuid and appUserUuid are useful
  const r = body.response;
  console.log("Login response:");
  console.log(`  appUserUuid: ${r.appUserUuid}`);
  console.log(`  orgUuid:     ${r.orgUuid}`);
  console.log(`  orgSlug:     ${r.orgSlug}`);
  console.log();
  return { token, orgUuid: r.orgUuid };
}

async function get(token, path) {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, ...COMMON_HEADERS },
  });
  if (!res.ok) {
    console.error(`GET ${path} failed: ${res.status} ${await res.text()}`);
    return null;
  }
  return res.json();
}

(async () => {
  const { token, orgUuid } = await login();
  console.log("✓ Logged in to Worklap as", process.env.WORKLAP_EMAIL);
  console.log();

  // Optionally accept org slug + project key to resolve directly
  const orgSlug = process.argv[2];
  const projectKey = process.argv[3];

  let projectUuid;
  if (orgSlug && projectKey) {
    const r = await get(token, `/pmo/resolve/${orgSlug}/${projectKey}`);
    console.log(`== /pmo/resolve/${orgSlug}/${projectKey} ==`);
    console.log(JSON.stringify(r?.response ?? r?.data ?? r, null, 2).slice(0, 4000));
    projectUuid =
      r?.response?.projectUuid ??
      r?.response?.uuid ??
      r?.data?.projectUuid ??
      r?.data?.uuid;
    console.log();
  } else {
    // List all projects for the user — needs appUserUuid
    const appUserUuid = process.env.WORKLAP_ASSIGNEE_USER_UUID;
    if (!appUserUuid) {
      console.log("Hint: pass <orgSlug> <projectKey> to resolve directly,");
      console.log("  or set WORKLAP_ASSIGNEE_USER_UUID in .env.local to list all projects.");
      console.log(`  Usage: node scripts/worklap-discover.mjs <orgSlug> <projectKey>`);
      console.log(`  e.g.:  node scripts/worklap-discover.mjs mondevo-group P001`);
      return;
    }
    const r = await get(token, `/pmo/get-all-projects/${appUserUuid}?page=0&size=50`);
    console.log("== all projects ==");
    console.log(JSON.stringify(r?.response ?? r?.data ?? r, null, 2).slice(0, 4000));
    console.log();
  }

  if (!projectUuid) {
    console.log("No projectUuid resolved; stopping here.");
    return;
  }

  console.log(`Drilling into project ${projectUuid}…`);
  console.log();

  const defaults = await get(token, `/pmo/get-project-work-defaults/${projectUuid}`);
  if (defaults) {
    console.log(`== /pmo/get-project-work-defaults/${projectUuid} ==`);
    console.log(JSON.stringify(defaults.response ?? defaults.data ?? defaults, null, 2).slice(0, 4000));
    console.log();
  }

  const users = await get(token, `/pmo/get-all-users-in-project/${projectUuid}`);
  if (users) {
    console.log(`== /pmo/get-all-users-in-project/${projectUuid} ==`);
    console.log(JSON.stringify(users.response ?? users.data ?? users, null, 2).slice(0, 3000));
    console.log();
  }
})();
