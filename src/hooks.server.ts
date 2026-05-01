import { sequence } from '@sveltejs/kit/hooks';
import { db } from '$lib/server/db';
import { navItem } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

async function ensureClosedPositionsNav() {
  try {
    // Check if closed positions nav item exists
    const existing = await db
      .select()
      .from(navItem)
      .where(eq(navItem.href, '/closed-positions'));

    if (existing.length === 0) {
      // Add it
      await db.insert(navItem).values({
        label: 'Closed Positions',
        href: '/closed-positions',
        icon: 'circle',
        parentId: null,
        sortOrder: 2
      });
      console.log('✓ Added "Closed Positions" to navigation');
    }
  } catch (error) {
    console.error('Failed to ensure nav item:', error);
  }
}

// Run on startup
await ensureClosedPositionsNav();

export const handle = sequence();
