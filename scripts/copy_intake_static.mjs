#!/usr/bin/env node
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const source = path.join(repoRoot, 'armageddon-site', 'intake');
const destination = path.join(repoRoot, 'armageddon-site', 'out', 'intake');

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
console.log(`[intake] Copied standalone static intake page to ${destination}`);
