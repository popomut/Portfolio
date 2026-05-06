import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { stock, transaction, dividend } from '$lib/server/db/schema';

export const POST: RequestHandler = async () => {
  await db.delete(dividend);
  await db.delete(transaction);
  await db.delete(stock);

  return json({ success: true });
};
