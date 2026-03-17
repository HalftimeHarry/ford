#!/usr/bin/env node
/**
 * Restores pool_teams, draft_orders, and draft_picks from scripts/draft-snapshot.json.
 * Clears existing records first, then re-creates from snapshot.
 * ncaa_teams are matched by name — not deleted/recreated.
 *
 * Usage: node scripts/restore-draft.cjs
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

let TOKEN = '';

function httpReq(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method, headers
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getAll(collection) {
  let page = 1, items = [];
  while (true) {
    const r = await httpReq('GET', BASE_URL + '/api/collections/' + collection + '/records?page=' + page + '&perPage=200');
    if (!r.body.items) break;
    items = items.concat(r.body.items);
    if (page >= (r.body.totalPages || 1)) break;
    page++;
  }
  return items;
}

async function deleteAll(collection) {
  const items = await getAll(collection);
  for (const item of items) {
    await httpReq('DELETE', BASE_URL + '/api/collections/' + collection + '/records/' + item.id);
  }
  console.log('  Deleted ' + items.length + ' records from ' + collection);
}

async function main() {
  const snapshotPath = path.join(__dirname, 'draft-snapshot.json');
  if (!fs.existsSync(snapshotPath)) { console.error('No snapshot found. Run snapshot-draft.cjs first.'); process.exit(1); }
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  console.log('Restoring snapshot from ' + snapshot.snapshotAt);

  // Auth
  const authRes = await new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + '/api/collections/_superusers/auth-with-password');
    const lib = url.protocol === 'https:' ? https : http;
    const data = JSON.stringify({ identity: EMAIL, password: PASSWORD });
    const req = lib.request({ hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let raw = ''; res.on('data', d => raw += d); res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
  TOKEN = authRes.token;
  if (!TOKEN) { console.error('Auth failed', authRes); process.exit(1); }

  // Build ncaa_teams name->id map from live DB
  const liveNcaaTeams = await getAll('ncaa_teams');
  const ncaaByName = {};
  for (const t of liveNcaaTeams) ncaaByName[t.name] = t.id;

  // Build snapshot ncaa_teams id->name map
  const snapNcaaById = {};
  for (const t of snapshot.ncaa_teams) snapNcaaById[t.id] = t.name;

  // 1. Clear in dependency order
  console.log('\nClearing existing records...');
  await deleteAll('draft_picks');
  await deleteAll('draft_orders');
  await deleteAll('pool_teams');

  // 2. Restore pool_teams, build old->new id map
  console.log('\nRestoring pool_teams...');
  const poolTeamIdMap = {};
  for (const pt of snapshot.pool_teams) {
    const r = await httpReq('POST', BASE_URL + '/api/collections/pool_teams/records', { name: pt.name, slot_count: pt.slot_count ?? 1 });
    if (r.status !== 200) { console.error('  Failed pool_team', pt.name, r.body); continue; }
    poolTeamIdMap[pt.id] = r.body.id;
    console.log('  ' + pt.name + ' -> ' + r.body.id);
  }

  // 3. Restore draft_orders
  console.log('\nRestoring draft_orders...');
  let orderOk = 0;
  for (const o of snapshot.draft_orders) {
    const newPoolTeamId = poolTeamIdMap[o.pool_team];
    if (!newPoolTeamId) { console.warn('  Skipping order — no pool_team mapping for ' + o.pool_team); continue; }
    const r = await httpReq('POST', BASE_URL + '/api/collections/draft_orders/records', { pool_team: newPoolTeamId, position: o.position, round_group: o.round_group });
    if (r.status !== 200) console.error('  Failed draft_order', r.body);
    else orderOk++;
  }
  console.log('  Restored ' + orderOk + '/' + snapshot.draft_orders.length + ' draft_orders');

  // 4. Restore draft_picks
  console.log('\nRestoring draft_picks...');
  let pickOk = 0, pickFail = 0;
  // Sort by pick_number to preserve order
  const sortedPicks = [...snapshot.draft_picks].sort((a, b) => a.pick_number - b.pick_number);
  for (const p of sortedPicks) {
    const newPoolTeamId = poolTeamIdMap[p.pool_team];
    if (!newPoolTeamId) { console.warn('  Skipping pick — no pool_team mapping for ' + p.pool_team); pickFail++; continue; }
    const teamName = snapNcaaById[p.team];
    const liveTeamId = teamName ? ncaaByName[teamName] : null;
    if (!liveTeamId) { console.warn('  Skipping pick — ncaa_team not found: ' + p.team + ' (' + teamName + ')'); pickFail++; continue; }
    const r = await httpReq('POST', BASE_URL + '/api/collections/draft_picks/records', {
      pool_team: newPoolTeamId, team: liveTeamId, user: p.user || '', draft_round: p.draft_round, pick_number: p.pick_number
    });
    if (r.status !== 200) { console.error('  Failed pick', teamName, r.body); pickFail++; }
    else pickOk++;
  }
  console.log('  Restored ' + pickOk + ' picks (' + pickFail + ' failed)');
  console.log('\nRestore complete.');
}
main().catch(e => { console.error(e); process.exit(1); });
