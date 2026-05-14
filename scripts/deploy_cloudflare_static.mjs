#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const API_BASE = 'https://api.cloudflare.com/client/v4';
// Keep Worker runtime compatibility pinned to wrangler.jsonc instead of drifting by deploy date.
const WORKER_COMPATIBILITY_DATE = '2026-05-06';
const DNS_MUTATION_ENABLED = process.env.CLOUDFLARE_MANAGE_DNS === 'true';
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;

if (proxyUrl) {
  // Node fetch does not honor proxy env vars automatically in this runtime; force Cloudflare API calls through the configured proxy.
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}
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

async function compileWorkerSource(workerSourcePath) {
  const source = await readFile(workerSourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
      removeComments: false,
    },
    fileName: workerSourcePath,
    reportDiagnostics: true,
  });
  const diagnostics = output.diagnostics ?? [];
  const blocking = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (blocking.length > 0) {
    const message = ts.formatDiagnosticsWithColorAndContext(blocking, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    });
    throw new Error(`Worker TypeScript transpilation failed:\n${message}`);
  }
  return output.outputText;
}

async function getWorkerCompatibilityDate(workerSourcePath) {
  const wranglerConfigPath = path.join(path.dirname(path.dirname(workerSourcePath)), 'wrangler.jsonc');
  const wranglerConfig = await readFile(wranglerConfigPath, 'utf8');
  const compatibilityDate = wranglerConfig.match(/"compatibility_date"\s*:\s*"([^"]+)"/)?.[1];
  if (!compatibilityDate) throw new Error(`Missing compatibility_date in ${wranglerConfigPath}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate)) throw new Error(`Invalid compatibility_date in ${wranglerConfigPath}: ${compatibilityDate}`);
  // Use wrangler.jsonc as the single runtime-compatibility source for direct API deploys.
  return compatibilityDate;
}

async function deployWorker({ accountId, workerName, token, completionJwt, workerSourcePath, compatibilityDate, supabaseUrl, supabaseServiceRoleKey }) {
  const scriptName = 'worker.mjs';
  const metadata = {
    main_module: scriptName,
    compatibility_date: WORKER_COMPATIBILITY_DATE,
    bindings: [
      { type: 'assets', name: 'ASSETS' },
      { type: 'secret_text', name: 'SUPABASE_URL', text: supabaseUrl },
      { type: 'secret_text', name: 'SUPABASE_SERVICE_ROLE_KEY', text: supabaseServiceRoleKey },
    ],
    assets: {
      jwt: completionJwt,
      config: {
        html_handling: 'auto-trailing-slash',
        not_found_handling: 'single-page-application',
      },
    },
    observability: { enabled: true },
  };
  const source = await compileWorkerSource(workerSourcePath);
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
  if (process.env.CLOUDFLARE_ZONE_ID?.trim()) {
    // Scoped Cloudflare tokens may not list zones; allow CI to provide the verified zone id directly.
    return process.env.CLOUDFLARE_ZONE_ID.trim();
  }

  const res = await apiFetch(`/zones?name=${encodeURIComponent(zoneName)}&status=active`, { token });
  const zone = res.result?.[0];
  if (!zone) throw new Error(`Zone not found for ${zoneName}. Set CLOUDFLARE_ZONE_ID or grant Zone Read for this domain.`);
  return zone.id;
}

async function preflightZoneAccess({ token, zoneId, zoneName }) {
  // Read-only checks prove route/DNS scope before any Worker deploy mutation occurs.
  await listDnsRecordsByName({ token, zoneId, name: zoneName });
  await listDnsRecordsByName({ token, zoneId, name: `www.${zoneName}` });
  await apiFetch(`/zones/${zoneId}/workers/routes`, { token });
}

/**
 * Ensures armageddon.icu has a proxied A record (required for worker routes).
 * Upserts: if a record exists for the name, updates it; otherwise creates it.
 */
async function listDnsRecordsByName({ token, zoneId, name }) {
  const response = await apiFetch(`/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}`, { token });
  return response.result ?? [];
}


function isWorkerRoutableDnsRecord(record) {
  // Worker routes only intercept traffic that reaches Cloudflare's proxy.
  return ['A', 'AAAA', 'CNAME'].includes(record.type) && record.proxied === true;
}

async function verifyProxiedDnsRecord({ token, zoneId, name }) {
  const records = await listDnsRecordsByName({ token, zoneId, name });
  const routable = records.find(isWorkerRoutableDnsRecord);
  if (!routable) {
    throw new Error(`No Cloudflare-proxied DNS record found for ${name}. Since CLOUDFLARE_MANAGE_DNS is not true, update DNS manually or opt in to DNS mutation.`);
  }
  console.log(`[DNS] Verified Cloudflare-proxied ${routable.type} record for ${name}`);
}

async function ensureProductionDns({ token, zoneId, zoneName }) {
  if (!DNS_MUTATION_ENABLED) {
    // DNS is operator-owned by default; validate it instead of replacing manual records.
    await verifyProxiedDnsRecord({ token, zoneId, name: zoneName });
    await verifyProxiedDnsRecord({ token, zoneId, name: `www.${zoneName}` });
    return;
  }

  // Explicit opt-in path for initial cutover automation.
  await upsertProxiedDnsRecord({ token, zoneId, name: zoneName });
  await upsertProxiedDnsRecord({ token, zoneId, name: `www.${zoneName}` });
}

async function deleteConflictingDnsRecords({ token, zoneId, name, keepRecordId }) {
  const records = await listDnsRecordsByName({ token, zoneId, name });
  for (const record of records) {
    if (record.id === keepRecordId) continue;
    if (record.type === 'A' || record.type === 'AAAA' || record.type === 'CNAME') {
      await apiFetch(`/zones/${zoneId}/dns_records/${record.id}`, { token, method: 'DELETE' });
      console.log(`[DNS] Deleted conflicting ${record.type} record for ${name}`);
    }
  }
}

async function upsertProxiedDnsRecord({ token, zoneId, name, content = '192.0.2.1' }) {
  const records = await listDnsRecordsByName({ token, zoneId, name });
  const record = records.find((item) => item.type === 'A');
  let keepRecordId;
  if (record) {
    if (!record.proxied || record.content !== content || record.ttl !== 1) {
      const updated = await apiFetch(`/zones/${zoneId}/dns_records/${record.id}`, {
        token, method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'A', name, content, proxied: true, ttl: 1 }),
      });
      keepRecordId = updated.result?.id ?? record.id;
      console.log(`[DNS] Updated A record for ${name} → Cloudflare-proxied placeholder`);
    } else {
      keepRecordId = record.id;
      console.log(`[DNS] A record for ${name} already Cloudflare-proxied ✓`);
    }
  } else {
    const created = await apiFetch(`/zones/${zoneId}/dns_records`, {
      token, method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'A', name, content, proxied: true, ttl: 1 }),
    });
    keepRecordId = created.result?.id;
    console.log(`[DNS] Created Cloudflare-proxied A record for ${name}`);
  }

  await deleteConflictingDnsRecords({ token, zoneId, name, keepRecordId });
}

/**
 * Registers worker routes for the zone so all traffic to armageddon.icu
 * is handled by the armageddon-core worker. Idempotent.
 */
async function upsertWorkerRoutes({ token, zoneId, workerName, patterns }) {
  const existing = await apiFetch(`/zones/${zoneId}/workers/routes`, { token });
  const routesByPattern = new Map((existing.result ?? []).map((route) => [route.pattern, route]));

  for (const pattern of patterns) {
    const route = routesByPattern.get(pattern);
    if (route?.script === workerName) {
      console.log(`[Routes] Route already registered: ${pattern} → ${workerName}`);
      continue;
    }
    if (route?.id) {
      await apiFetch(`/zones/${zoneId}/workers/routes/${route.id}`, {
        token, method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pattern, script: workerName }),
      });
      console.log(`[Routes] Updated route: ${pattern} → ${workerName}`);
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

async function getGitCommit() {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
    return stdout.trim();
  } catch {
    return process.env.GITHUB_SHA?.trim() || 'unknown';
  }
}

async function writeDeploymentManifest(outputDir) {
  const deployment = {
    provider: 'cloudflare-workers',
    canonicalHost: 'armageddon.icu',
    redirectHost: 'www.armageddon.icu',
    sourceCommit: await getGitCommit(),
    builtAt: new Date().toISOString(),
  };
  await writeFile(path.join(outputDir, 'deployment.json'), `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`[Cloudflare] Wrote deployment manifest for commit ${deployment.sourceCommit}`);
}

async function main() {
  const accountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_ID');
  const token = requiredEnv('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_TOKEN_ATS', 'CLOUDFLARE_AGENT_TOKEN');
  const workerName = process.env.CLOUDFLARE_WORKER_NAME?.trim() || 'armageddon-core';
  const outputDir = process.env.CLOUDFLARE_OUTPUT_DIR?.trim()
    ? path.resolve(process.env.CLOUDFLARE_OUTPUT_DIR.trim())
    : path.join(repoRoot, 'armageddon-site', 'out');
  const workerSourcePath = process.env.CLOUDFLARE_WORKER_SOURCE?.trim()
    ? path.resolve(process.env.CLOUDFLARE_WORKER_SOURCE.trim())
    : path.join(repoRoot, 'armageddon-site', 'src', 'intake-handler.ts');
  const zoneName = process.env.CLOUDFLARE_ZONE_NAME?.trim() || 'armageddon.icu';
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (process.env.SUPABASE_ARMAGEDDON_INTAKE_MIGRATION_APPLIED !== 'true') {
    throw new Error('Refusing deploy: apply supabase/migrations/20260508000000_armageddon_intake.sql first, then set SUPABASE_ARMAGEDDON_INTAKE_MIGRATION_APPLIED=true.');
  }

  // ── 1. Preflight zone access before any Cloudflare deployment mutation ───
  const zoneId = await getZoneId({ token, zoneName });
  await preflightZoneAccess({ token, zoneId, zoneName });
  if (!DNS_MUTATION_ENABLED) {
    // Manual DNS cutovers must be proven before any Worker asset/script mutation.
    await ensureProductionDns({ token, zoneId, zoneName });
  }
  console.log(`[DNS] Zone access preflight passed for ${zoneName}`);

  // ── 2. Build manifest & upload assets ──────────────────────────────────
  console.log(`[Cloudflare] Preparing static asset deployment: ${workerName}`);
  await writeDeploymentManifest(outputDir);
  const { manifest, byHash, fileCount } = await createManifest(outputDir);
  console.log(`[Cloudflare] Manifest ready: ${fileCount} files`);

  const completionJwt = await uploadAssets({ accountId, workerName, token, manifest, byHash });
  console.log('[Cloudflare] Assets uploaded');

  // ── 3. Deploy worker ───────────────────────────────────────────────────
  await deployWorker({ accountId, workerName, token, completionJwt, workerSourcePath, supabaseUrl, supabaseServiceRoleKey });
  console.log('[Cloudflare] Worker deployed');

  // ── 4. Enable workers.dev preview ─────────────────────────────────────
  const subdomain = await enableWorkersDev({ accountId, workerName, token });
  const previewUrl = subdomain ? `https://${workerName}.${subdomain}.workers.dev/` : null;
  if (previewUrl) console.log(`[Cloudflare] Preview URL: ${previewUrl}`);

  // ── 5. Wire up armageddon.icu DNS + routes (zero Vercel) ──────────────
  console.log(`[Cloudflare] Configuring ${zoneName} DNS + worker routes...`);
  try {
    console.log(`[DNS] Zone ID: ${zoneId}`);

    // DNS is verified by default; mutation requires CLOUDFLARE_MANAGE_DNS=true.
    await ensureProductionDns({ token, zoneId, zoneName });

    // Register worker routes for root and www
    await upsertWorkerRoutes({
      token, zoneId, workerName,
      patterns: [`${zoneName}/*`, `www.${zoneName}/*`],
    });

    console.log(`[Cloudflare] ✅ ${zoneName} fully wired to Cloudflare Workers — zero Vercel`);
  } catch (err) {
    throw new Error(`Cloudflare zone wiring failed after worker deploy; production cutover is incomplete and must not be treated as successful: ${err.message}`);
  }

  console.log('[Cloudflare] Deployment complete');
  if (previewUrl) console.log(`[Cloudflare] Workers.dev: ${previewUrl}`);
  console.log(`[Cloudflare] Production: https://${zoneName}`);
}

main().catch((error) => {
  console.error(`[Cloudflare] Deployment failed: ${error.message}`);
  process.exit(1);
});
