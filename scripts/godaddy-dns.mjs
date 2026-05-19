#!/usr/bin/env node
// Set DNS records on GoDaddy for ittikar.com.
//
// Usage:
//   GODADDY_API_KEY=... GODADDY_API_SECRET=... node scripts/godaddy-dns.mjs <subdomain> <vercel-cname>
//
// Example:
//   node scripts/godaddy-dns.mjs self-service cname.vercel-dns.com
//
// Lists existing records first, then upserts the CNAME for <subdomain>.ittikar.com.

const DOMAIN = "ittikar.com";

const [, , subdomain, target] = process.argv;
if (!subdomain || !target) {
  console.error("Usage: node godaddy-dns.mjs <subdomain> <target>");
  console.error("Example: node godaddy-dns.mjs self-service cname.vercel-dns.com");
  process.exit(1);
}

const key = process.env.GODADDY_API_KEY;
const secret = process.env.GODADDY_API_SECRET;
if (!key || !secret) {
  console.error("Set GODADDY_API_KEY and GODADDY_API_SECRET in your shell env.");
  process.exit(1);
}

const headers = {
  Authorization: `sso-key ${key}:${secret}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function listRecords() {
  const res = await fetch(`https://api.godaddy.com/v1/domains/${DOMAIN}/records`, { headers });
  if (!res.ok) {
    console.error(`List failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
}

async function upsertCname(name, data) {
  // PUT replaces all records for (type, name). We pass a single-element array.
  const url = `https://api.godaddy.com/v1/domains/${DOMAIN}/records/CNAME/${name}`;
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify([{ data, ttl: 600 }]),
  });
  if (!res.ok) {
    console.error(`PUT failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`✓ CNAME ${name}.${DOMAIN} → ${data} (TTL 600)`);
}

(async () => {
  console.log(`Inspecting current DNS for ${DOMAIN}…`);
  const records = await listRecords();
  const existing = records.find((r) => r.type === "CNAME" && r.name === subdomain);
  if (existing) {
    console.log(`Existing CNAME for ${subdomain}: → ${existing.data} (will overwrite)`);
  } else {
    console.log(`No existing CNAME for ${subdomain}; creating new.`);
  }
  await upsertCname(subdomain, target);
  console.log("\nDNS update sent. Propagation typically completes in 1–5 minutes.");
  console.log(`Verify: dig +short CNAME ${subdomain}.${DOMAIN}`);
})();
