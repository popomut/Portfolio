import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { navItem } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export const load: LayoutServerLoad = async () => {
	const items = await db.select().from(navItem).orderBy(asc(navItem.sortOrder));

	// Build tree: top-level items with their children
	const roots = items.filter((i) => i.parentId === null);
	const tree = roots.map((root) => ({
		...root,
		children: items.filter((i) => i.parentId === root.id)
	}));

	return { navTree: tree };
};
