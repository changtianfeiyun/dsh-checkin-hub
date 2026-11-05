#!/usr/bin/env node
/**
 * Build the distributable tarball and print its size and SHA-256.
 *
 * Cross-platform on purpose: it shells out to `npm pack` (shipped with every
 * Node install), reads the produced file with `node:fs`, and hashes it with
 * `node:crypto`. No `sh`, no `shasum`, no `sed` — so it behaves the same in
 * PowerShell, cmd.exe and bash.
 *
 *   node scripts/pack.mjs            # writes dist/<name>-<version>.tgz
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = manifest.version;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

execFileSync("npm", ["pack", "--pack-destination", dist], {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
  // npm is a .cmd shim on Windows, which execFile cannot spawn without a shell.
  shell: process.platform === "win32",
});

const tarballs = readdirSync(dist).filter((name) => name.endsWith(".tgz"));
if (tarballs.length !== 1) {
  console.error(`expected exactly one tarball in dist/, found ${tarballs.length}`);
  process.exit(1);
}

const file = join(dist, tarballs[0]);
const bytes = readFileSync(file);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const size = statSync(file).size;

console.log("");
console.log(`asset:  ${tarballs[0]}`);
console.log(`bytes:  ${size}`);
console.log(`sha256: ${sha256}`);
console.log(`version ${version} → release tag v${version}`);
