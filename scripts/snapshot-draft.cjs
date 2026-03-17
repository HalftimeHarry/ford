#!/usr/bin/env node
/**
 * Snapshots pool_teams, draft_orders, draft_picks, ncaa_teams from PocketBase
 * into scripts/draft-snapshot.json.
 *
 * Usage: node scripts/snapshot-draft.cjs
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)/);
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  });
}
const BASE_URL = (envVars.POCKETBASE_URL || process.env.POCKETBASE_URL || '').replace(/\/$/, '');
const EMAIL = envVars.POCKETBASE_ADMIN_EMAIL || process.env.POCKETBASE_ADMIN_EMAIL;
const PASSWORD = envVars.POCKETBASE_ADMIN_PASSWORD || process.env.POCKETBASE_ADMIN_PASSWORD;

function httpReq(method, urlStr, body, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method, headers
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getAll(token, collection) {
  let page = 1, items = [];
  while (true) {
    const url = BASE_URL + '/api/collections/' + collection + '/records?page=' + page + '&perPage=200';
    const data = await httpReq('GET', url, null, token);
    if (!data.items) { console.error('  Unexpected response for', collection, JSON.stringify(data).slice(0, 200)); break; }
    items = items.concat(data.items);
    if (page >= (data.totalPages || 1)) break;
    page++;
  }
  return items;
}

async function main() {
  const auth = await httpReq('POST', BASE_URL + '/api/collections/_superusers/auth-with-password', { identity: EMAIL, password: PASSWORD });
  const token = auth.token;
  if (!token) { console.error('Auth failed', JSON.stringify(auth)); process.exit(1); }
  console.log('Authenticated. Fetching...');

  const [poolTeams, draftOrders, draftPicks, ncaaTeams] = await Promise.all([
    getAll(token, 'pool_teams'),
    getAll(token, 'draft_orders'),
    getAll(token, 'draft_picks'),
    getAll(token, 'ncaa_teams'),
  ]);

  const snapshot = { snapshotAt: new Date().toISOString(), pool_teams: poolTeams, draft_orders: draftOrders, draft_picks: draftPicks, ncaa_teams: ncaaTeams };
  const outPath = path.join(__dirname, 'draft-snapshot.json');
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log('Snapshot saved to ' + outPath);
  console.log('  pool_teams:   ' + poolTeams.length);
  console.log('  draft_orders: ' + draftOrders.length);
  console.log('  draft_picks:  ' + draftPicks.length);
  console.log('  ncaa_teams:   ' + ncaaTeams.length);
}
main().catch(e => { console.error(e); process.exit(1); });
