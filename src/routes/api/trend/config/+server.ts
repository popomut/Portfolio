import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { trendConfig } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const CONFIG_ID = 'config';

async function getOrCreate() {
	const [existing] = await db.select().from(trendConfig).where(eq(trendConfig.id, CONFIG_ID));
	if (existing) return existing;
	const [created] = await db
		.insert(trendConfig)
		.values({ id: CONFIG_ID, updatedAt: new Date().toISOString() })
		.returning();
	return created;
}

export const GET: RequestHandler = async () => {
	const cfg = await getOrCreate();
	return json(cfg);
};

export const PATCH: RequestHandler = async ({ request }) => {
	await getOrCreate();
	const body = await request.json();
	const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
	for (const key of ['equity', 'riskPct', 'atrPeriod', 'atrMultStop', 'atrMultAdd', 'maxUnits']) {
		if (body[key] != null) patch[key] = Number(body[key]);
	}
	const [updated] = await db
		.update(trendConfig)
		.set(patch)
		.where(eq(trendConfig.id, CONFIG_ID))
		.returning();
	return json(updated);
};
