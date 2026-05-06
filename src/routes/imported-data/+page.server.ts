import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { transaction, dividend } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const transactions = await db
		.select()
		.from(transaction)
		.orderBy(desc(transaction.date));

	const dividends = await db
		.select()
		.from(dividend)
		.orderBy(desc(dividend.exDate));

	return {
		transactions,
		dividends
	};
};
