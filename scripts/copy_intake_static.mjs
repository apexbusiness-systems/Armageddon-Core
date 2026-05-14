#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const source = path.join(repoRoot, 'armageddon-site', 'intake');
const outDir = path.join(repoRoot, 'armageddon-site', 'out');
const destination = path.join(outDir, 'intake');

async function getGitCommit() {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
    return stdout.trim();
  } catch {
    return process.env.GITHUB_SHA?.trim() || 'unknown';
  }
}

async function writeDeploymentManifest() {
  const deployment = {
    provider: 'cloudflare-workers',
    canonicalHost: 'armageddon.icu',
    redirectHost: 'www.armageddon.icu',
    sourceCommit: await getGitCommit(),
    builtAt: new Date().toISOString(),
  };
  await writeFile(path.join(outDir, 'deployment.json'), `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`[deployment] Wrote Cloudflare deployment manifest for commit ${deployment.sourceCommit}`);
}

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
await writeDeploymentManifest();
console.log(`[intake] Copied standalone static intake page to ${destination}`);
