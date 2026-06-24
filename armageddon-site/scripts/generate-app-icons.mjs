/**
 * Deterministic icon generation for the Armageddon Test Suite.
 *
 * Source: public/icons/source/armageddon-test-suite-icon.png
 * Outputs: all required PWA, web, Apple, and store icons.
 *
 * Exit non-zero on any failure. Logs every generated file.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..');
const publicDir = path.join(siteRoot, 'public');
const sourceIcon = path.join(publicDir, 'icons', 'source', 'armageddon-test-suite-icon.png');

function fail(msg) {
    process.stderr.write(`[FAIL] ${msg}\n`);
    process.exit(1);
}

function log(msg) {
    process.stdout.write(`[OK]   ${msg}\n`);
}

function resolveDest(...segments) {
    return path.join(publicDir, ...segments);
}

// ─── Validate source ────────────────────────────────────────────────────────

if (!existsSync(sourceIcon)) {
    fail(`Source icon not found: ${sourceIcon}`);
}
const sourceSize = statSync(sourceIcon).size;
if (sourceSize === 0) {
    fail(`Source icon is zero bytes: ${sourceIcon}`);
}

// ─── Ensure output directories ───────────────────────────────────────────────

await mkdir(path.join(publicDir, 'icons'), { recursive: true });
await mkdir(path.join(publicDir, 'icons', 'source'), { recursive: true });
await mkdir(path.join(publicDir, 'icons', 'store'), { recursive: true });

// ─── Helper: square-crop + resize ────────────────────────────────────────────

/**
 * Resize source to a square at the given size using centered-cover composition.
 * Returns a sharp instance (not yet a Buffer) for chaining.
 */
function squareResize(size) {
    return sharp(sourceIcon)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
}

/**
 * Resize with maskable safe-zone padding (10% each side → 80% inner safe zone).
 */
function maskableResize(size) {
    const innerSize = Math.round(size * 0.8);
    return sharp(sourceIcon)
        .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({
            top: Math.round(size * 0.1),
            bottom: size - innerSize - Math.round(size * 0.1),
            left: Math.round(size * 0.1),
            right: size - innerSize - Math.round(size * 0.1),
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
}

// ─── Generation plan (deterministic order) ───────────────────────────────────

async function generatePng(destRelative, pipeline) {
    const dest = resolveDest(destRelative);
    const buf = await pipeline.png().toBuffer();
    await writeFile(dest, buf);
    log(dest);
}

// 1. icon.png — 512×512 any-purpose
await generatePng('icon.png', squareResize(512));

// 2. apple-touch-icon.png — 180×180
await generatePng('apple-touch-icon.png', squareResize(180));

// 3. icons/icon-192.png — 192×192 any-purpose PWA
await generatePng(path.join('icons', 'icon-192.png'), squareResize(192));

// 4. icons/icon-512.png — 512×512 any-purpose PWA
await generatePng(path.join('icons', 'icon-512.png'), squareResize(512));

// 5. icons/icon-maskable-192.png — 192×192 maskable PWA
await generatePng(path.join('icons', 'icon-maskable-192.png'), maskableResize(192));

// 6. icons/icon-maskable-512.png — 512×512 maskable PWA
await generatePng(path.join('icons', 'icon-maskable-512.png'), maskableResize(512));

// 7. icons/store/app-store-icon-1024.png — 1024×1024 flat #030303 background
{
    const inner = Math.round(1024 * 0.8);
    const iconBuf = await sharp(sourceIcon)
        .resize(inner, inner, { fit: 'contain', background: { r: 3, g: 3, b: 3, alpha: 1 } })
        .png()
        .toBuffer();
    const finalBuf = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 3, g: 3, b: 3 } } })
        .composite([{ input: iconBuf, gravity: 'centre' }])
        .png()
        .toBuffer();
    const dest = resolveDest(path.join('icons', 'store', 'app-store-icon-1024.png'));
    await writeFile(dest, finalBuf);
    log(dest);
}

// 8. icons/store/play-store-icon-512.png — 512×512 PNG
await generatePng(path.join('icons', 'store', 'play-store-icon-512.png'), squareResize(512));

// 9. favicon.ico — embedded 16, 32, 48
{
    const sizes = [16, 32, 48];
    const pngBuffers = await Promise.all(
        sizes.map((s) =>
            squareResize(s).png().toBuffer()
        )
    );
    const ico = await pngToIco(pngBuffers);
    const dest = resolveDest('favicon.ico');
    await writeFile(dest, ico);
    log(dest);
}

process.stdout.write('[DONE] All icons generated successfully.\n');
