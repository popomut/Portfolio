// Stages the Node sidecar payload for Tauri to bundle.
// Copies build/ and prunes node_modules to production-only deps in src-tauri/sidecar/.
// Run automatically via `beforeBundleCommand` in tauri.conf.json.

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const stage = join(root, 'src-tauri', 'sidecar');

console.log('[stage-sidecar] cleaning', stage);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

console.log('[stage-sidecar] copying build/');
cpSync(join(root, 'build'), join(stage, 'build'), { recursive: true });

console.log('[stage-sidecar] writing minimal package.json (runtime deps only)');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const runtimePkg = {
	name: pkg.name,
	version: pkg.version,
	private: true,
	type: 'module',
	dependencies: pkg.dependencies
};
writeFileSync(join(stage, 'package.json'), JSON.stringify(runtimePkg, null, 2));

// drizzle-orm is imported at runtime but lives in devDependencies. Add it explicitly.
if (pkg.devDependencies?.['drizzle-orm']) {
	runtimePkg.dependencies['drizzle-orm'] = pkg.devDependencies['drizzle-orm'];
	writeFileSync(join(stage, 'package.json'), JSON.stringify(runtimePkg, null, 2));
}

console.log('[stage-sidecar] npm install --omit=dev (this can take a minute)');
execSync('npm install --omit=dev --no-audit --no-fund --ignore-scripts=false', {
	cwd: stage,
	stdio: 'inherit'
});

console.log('[stage-sidecar] generating template.db from schema');
const templateDb = join(stage, 'template.db');
rmSync(templateDb, { force: true });
execSync('npx drizzle-kit push --force', {
	cwd: root,
	stdio: 'inherit',
	env: { ...process.env, DATABASE_URL: `file:${templateDb}` }
});

if (!existsSync(templateDb)) {
	throw new Error(`[stage-sidecar] template.db was not created at ${templateDb}`);
}

console.log('[stage-sidecar] done. Contents:');
console.log('  ' + stage);
