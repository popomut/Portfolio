import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { dirname, join } from 'node:path';

function resolveDbUrl(): string {
	if (env.DATABASE_URL) return env.DATABASE_URL;

	// No env override: place local.db next to the running executable.
	// - `node build/index.js`  -> next to node.exe (self-hosted web)
	// - packaged sidecar .exe  -> next to Portfolio.exe (Tauri desktop build)
	const dbPath = join(dirname(process.execPath), 'local.db');
	return `file:${dbPath}`;
}

const client = createClient({ url: resolveDbUrl() });

export const db = drizzle(client, { schema });
