#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
  ['.svg', 'image/svg+xml'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function requiredEnv(...names) {
  for (const name of names) {
    if (process.env[name]?.trim()) return process.env[name].trim();
  }
  throw new Error(`Missing required environment variable: ${names.join(' or ')}`);
}

async function apiFetch(endpoint, { token, ...init } = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok || body?.success === false) {
    const message = typeof body === 'string' ? body : JSON.stringify(body.errors ?? body, null, 2);
    throw new Error(`Cloudflare API ${init.method ?? 'GET'} ${endpoint} failed (${response.status}): ${message}`);
  }
  return body;
}

async function walkFiles(root, dir = root) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(root, absolute));
    } else if (entry.isFile()) {
      const relative = `/${path.relative(root, absolute).split(path.sep).join('/')}`;
      files.push({ absolute, relative });
    }
  }
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

async function createManifest(outputDir) {
  const files = await walkFiles(outputDir);
  if (files.length === 0) throw new Error(`No files found in build output: ${outputDir}`);

  const manifest = {};
  const byHash = new Map();
  for (const file of files) {
    const data = await readFile(file.absolute);
    const info = await stat(file.absolute);
    const hash = createHash('sha256').update(data).digest('hex');
    manifest[file.relative] = { hash, size: info.size };
    byHash.set(hash, { ...file, data, contentType: MIME_TYPES.get(path.extname(file.absolute)) ?? 'application/octet-stream' });
  }
  return { manifest, byHash, fileCount: files.length };
}

async function uploadAssets({ accountId, workerName, token, manifest, byHash }) {
  const session = await apiFetch(`/accounts/${accountId}/workers/scripts/${workerName}/assets-upload-session`, {
    token,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ manifest }),
  });

  const buckets = session.result?.buckets ?? [];
  let completionJwt = session.result?.jwt;
  if (!completionJwt) throw new Error('Cloudflare did not return an asset upload token.');

  for (const bucket of buckets) {
    const form = new FormData();
    for (const hash of bucket) {
      const asset = byHash.get(hash);
      if (!asset) throw new Error(`Cloudflare requested unknown asset hash: ${hash}`);
      const encoded = asset.data.toString('base64');
      form.append(hash, new Blob([encoded], { type: asset.contentType }), hash);
    }
    const upload = await apiFetch(`/accounts/${accountId}/workers/assets/upload?base64=true`, {
      token: completionJwt,
      method: 'POST',
      body: form,
    });
    completionJwt = upload.result?.jwt ?? completionJwt;
  }

  return completionJwt;
}

async function deployWorker({ accountId, workerName, token, completionJwt }) {
  const scriptName = 'worker.mjs';
  const metadata = {
    main_module: scriptName,
    compatibility_date: new Date().toISOString().slice(0, 10),
    bindings: [{ type: 'assets', name: 'ASSETS' }],
    assets: {
      jwt: completionJwt,
      config: {
        html_handling: 'auto-trailing-slash',
        not_found_handling: 'single-page-application',
      },
    },
    observability: { enabled: true },
  };
  const source = `export default {\n  async fetch(request, env) {\n    return env.ASSETS.fetch(request);\n  }\n};\n`;
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append(scriptName, new Blob([source], { type: 'application/javascript+module' }), scriptName);

  return apiFetch(`/accounts/${accountId}/workers/scripts/${workerName}`, {
    token,
    method: 'PUT',
    body: form,
  });
}

async function enableWorkersDev({ accountId, workerName, token }) {
  await apiFetch(`/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
    token,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true, previews_enabled: true }),
  });
  const subdomain = await apiFetch(`/accounts/${accountId}/workers/subdomain`, { token });
  return subdomain.result?.subdomain;
}

/**
 * Finds the Cloudflare Zone ID for a given domain name.
 */
async function getZoneId({ token, zoneName }) {
  const res = await apiFetch(`/zones?name=${encodeURIComponent(zoneName)}&status=active`, { token });
  const zone = res.result?.[0];
  if (!zone) throw new Error(`Zone not found for ${zoneName}. Ensure the domain is added to this Cloudflare account.`);
  return zone.id;
}

/**
 * Ensures armageddon.icu has a proxied A record (required for worker routes).
 * Upserts: if a record exists for the name, updates it; otherwise creates it.
 */
async function upsertProxiedDnsRecord({ token, zoneId, name, content = '192.0.2.1' }) {
  const existing = await apiFetch(`/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}&type=A`, { token });
  const record = existing.result?.[0];
  if (record) {
    if (record.proxied && record.content === content) {
      console.log(`[DNS] A record for ${name} already proxied ✓`);
      return record;
    }
    await apiFetch(`/zones/${zoneId}/dns_records/${record.id}`, {
      token, method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'A', name, content, proxied: true, ttl: 1 }),
    });
    console.log(`[DNS] Updated A record for ${name} → proxied`);
  } else {
    await apiFetch(`/zones/${zoneId}/dns_records`, {
      token, method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'A', name, content, proxied: true, ttl: 1 }),
    });
    console.log(`[DNS] Created proxied A record for ${name}`);
  }
}

/**
 * Registers worker routes for the zone so all traffic to armageddon.icu
 * is handled by the armageddon-core worker. Idempotent.
 */
async function upsertWorkerRoutes({ token, zoneId, workerName, patterns }) {
  const existing = await apiFetch(`/zones/${zoneId}/workers/routes`, { token });
  const existingPatterns = new Set((existing.result ?? []).map(r => r.pattern));

  for (const pattern of patterns) {
    if (existingPatterns.has(pattern)) {
      console.log(`[Routes] Route already registered: ${pattern}`);
      continue;
    }
    await apiFetch(`/zones/${zoneId}/workers/routes`, {
      token, method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pattern, script: workerName }),
    });
    console.log(`[Routes] Registered route: ${pattern} → ${workerName}`);
  }
}

async function main() {
  const accountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_ID');
  const token = requiredEnv('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_TOKEN_ATS');
  const workerName = process.env.CLOUDFLARE_WORKER_NAME?.trim() || 'armageddon-core';
  const outputDir = path.resolve(process.env.CLOUDFLARE_OUTPUT_DIR?.trim() || 'armageddon-site/out');
  const zoneName = process.env.CLOUDFLARE_ZONE_NAME?.trim() || 'armageddon.icu';

  // ── 1. Build manifest & upload assets ──────────────────────────────────
  console.log(`[Cloudflare] Preparing static asset deployment: ${workerName}`);
  const { manifest, byHash, fileCount } = await createManifest(outputDir);
  console.log(`[Cloudflare] Manifest ready: ${fileCount} files`);

  const completionJwt = await uploadAssets({ accountId, workerName, token, manifest, byHash });
  console.log('[Cloudflare] Assets uploaded');

  // ── 2. Deploy worker ───────────────────────────────────────────────────
  await deployWorker({ accountId, workerName, token, completionJwt });
  console.log('[Cloudflare] Worker deployed');

  // ── 3. Enable workers.dev preview ─────────────────────────────────────
  const subdomain = await enableWorkersDev({ accountId, workerName, token });
  const previewUrl = subdomain ? `https://${workerName}.${subdomain}.workers.dev/` : null;
  if (previewUrl) console.log(`[Cloudflare] Preview URL: ${previewUrl}`);

  // ── 4. Wire up armageddon.icu DNS + routes (zero Vercel) ──────────────
  console.log(`[Cloudflare] Configuring ${zoneName} DNS + worker routes...`);
  try {
    const zoneId = await getZoneId({ token, zoneName });
    console.log(`[DNS] Zone ID: ${zoneId}`);

    // Ensure root + www have proxied A records so worker routes intercept them
    await upsertProxiedDnsRecord({ token, zoneId, name: zoneName });
    await upsertProxiedDnsRecord({ token, zoneId, name: `www.${zoneName}` });

    // Register worker routes for root and www
    await upsertWorkerRoutes({
      token, zoneId, workerName,
      patterns: [`${zoneName}/*`, `www.${zoneName}/*`],
    });

    console.log(`[Cloudflare] ✅ ${zoneName} fully wired to Cloudflare Workers — zero Vercel`);
  } catch (err) {
    // Non-fatal: worker is deployed, routes just need manual zone wiring if token lacks zone perms
    console.warn(`[DNS] Warning: Could not auto-configure zone routes: ${err.message}`);
    console.warn('[DNS] Worker deployed. Add routes manually in Cloudflare dashboard if needed.');
  }

  console.log('[Cloudflare] Deployment complete');
  if (previewUrl) console.log(`[Cloudflare] Workers.dev: ${previewUrl}`);
  console.log(`[Cloudflare] Production: https://${zoneName}`);
}

main().catch((error) => {
  console.error(`[Cloudflare] Deployment failed: ${error.message}`);
  process.exit(1);
});
