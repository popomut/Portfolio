import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { navItem } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export const load: LayoutServerLoad = async () => {
	const items = await db.select().from(navItem).orderBy(asc(navItem.sortOrder));

	// Ensure Settings nav item exists
	const hasSettings = items.some(i => i.href === '/settings');
	if (!hasSettings) {
		await db.insert(navItem).values({
			label: 'Settings',
			href: '/settings',
			icon: 'settings',
			sortOrder: 4
		});
		items.push({
			id: 'generated-settings',
			label: 'Settings',
			href: '/settings',
			icon: 'settings',
			parentId: null,
			sortOrder: 4
		});
	}

	// Ensure Dividends nav item exists
	const hasDividends = items.some(i => i.href === '/dividends');
	if (!hasDividends) {
		await db.insert(navItem).values({
			label: 'Dividends',
			href: '/dividends',
			icon: 'bar-chart-2',
			sortOrder: 5
		});
		items.push({
			id: 'generated-dividends',
			label: 'Dividends',
			href: '/dividends',
			icon: 'bar-chart-2',
			parentId: null,
			sortOrder: 5
		});
	}

	// Ensure Asset Allocation nav item exists
	const hasAssetAllocation = items.some(i => i.href === '/asset-allocation');
	if (!hasAssetAllocation) {
		await db.insert(navItem).values({
			label: 'Asset Allocation',
			href: '/asset-allocation',
			icon: 'globe',
			sortOrder: 6
		});
		items.push({
			id: 'generated-asset-allocation',
			label: 'Asset Allocation',
			href: '/asset-allocation',
			icon: 'globe',
			parentId: null,
			sortOrder: 6
		});
	}

	// Ensure SETMAI Fund nav item exists
	const hasSetmaiFund = items.some(i => i.href === '/setmai-fund');
	if (!hasSetmaiFund) {
		await db.insert(navItem).values({
			label: 'SETMAI Fund',
			href: '/setmai-fund',
			icon: 'bar-chart-2',
			sortOrder: 7
		});
		items.push({
			id: 'generated-setmai-fund',
			label: 'SETMAI Fund',
			href: '/setmai-fund',
			icon: 'bar-chart-2',
			parentId: null,
			sortOrder: 7
		});
	}

	// Ensure SETMAI Closed Positions nav item exists
	const hasSetmaiClosed = items.some(i => i.href === '/setmai-fund/closed-positions');
	if (!hasSetmaiClosed) {
		await db.insert(navItem).values({
			label: 'SETMAI Closed',
			href: '/setmai-fund/closed-positions',
			icon: 'circle',
			sortOrder: 8
		});
		items.push({
			id: 'generated-setmai-closed',
			label: 'SETMAI Closed',
			href: '/setmai-fund/closed-positions',
			icon: 'circle',
			parentId: null,
			sortOrder: 8
		});
	}

	// Build tree: top-level items with their children
	const roots = items.filter((i) => i.parentId === null);
	const tree = roots.map((root) => ({
		...root,
		children: items.filter((i) => i.parentId === root.id)
	}));

	return { navTree: tree };
};
