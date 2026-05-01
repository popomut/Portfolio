import { db } from '$lib/server/db/index.js';
import { navItem } from '$lib/server/db/schema.js';

try {
  // Insert the closed positions navigation item
  await db.insert(navItem).values({
    label: 'Closed Positions',
    href: '/closed-positions',
    icon: 'circle',
    parentId: null,
    sortOrder: 2
  }).run();

  console.log('✓ Navigation item added successfully');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
