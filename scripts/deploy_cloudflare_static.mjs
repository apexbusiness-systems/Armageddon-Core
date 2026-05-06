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

async function main() {
  const accountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_ID');
  const token = requiredEnv('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_TOKEN_ATS');
  const workerName = process.env.CLOUDFLARE_WORKER_NAME?.trim() || 'armageddon-core';
  const outputDir = path.resolve(process.env.CLOUDFLARE_OUTPUT_DIR?.trim() || 'armageddon-site/out');

  console.log(`[Cloudflare] Preparing static asset deployment: ${workerName}`);
  const { manifest, byHash, fileCount } = await createManifest(outputDir);
  console.log(`[Cloudflare] Manifest ready: ${fileCount} files`);

  const completionJwt = await uploadAssets({ accountId, workerName, token, manifest, byHash });
  console.log('[Cloudflare] Assets uploaded');

  await deployWorker({ accountId, workerName, token, completionJwt });
  const subdomain = await enableWorkersDev({ accountId, workerName, token });

  const url = subdomain ? `https://${workerName}.${subdomain}.workers.dev/` : null;
  console.log('[Cloudflare] Deployment complete');
  if (url) console.log(`[Cloudflare] URL: ${url}`);
}

main().catch((error) => {
  console.error(`[Cloudflare] Deployment failed: ${error.message}`);
  process.exit(1);
});
