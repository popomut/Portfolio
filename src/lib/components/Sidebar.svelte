<script lang="ts">
import { page } from '$app/stores';

type NavChild = {
id: string;
label: string;
href: string;
icon: string;
parentId: string | null;
sortOrder: number;
};

type NavNode = NavChild & { children: NavChild[] };

let {
navTree,
collapsed = $bindable(false),
mobileOpen = $bindable(false)
}: {
navTree: NavNode[];
collapsed: boolean;
mobileOpen: boolean;
} = $props();

let expanded = $state<Record<string, boolean>>({});

function toggleGroup(id: string) {
expanded[id] = !expanded[id];
}

function isActive(href: string) {
return $page.url.pathname === href;
}

function isParentActive(node: NavNode) {
return isActive(node.href) || node.children.some((c) => $page.url.pathname.startsWith(c.href));
}

const icons: Record<string, string> = {
home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
globe: 'M2 12a10 10 0 1 0 20 0A10 10 0 0 0 2 12z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
smartphone: 'M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z M12 18h.01',
code: 'M16 18l6-6-6-6 M8 6l-6 6 6 6',
circle: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
'bar-chart-2': 'M18 20V10 M12 20V4 M6 20v-6',
upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12'
};
</script>

<aside
class="flex h-full flex-col border-r border-slate-700 bg-slate-900 text-white transition-all duration-300"
class:w-64={!collapsed}
class:w-16={collapsed}
>
<div
class="flex items-center border-b border-slate-700 px-3 py-4"
class:justify-center={collapsed}
class:justify-between={!collapsed}
>
{#if !collapsed}
<span class="text-lg font-bold tracking-wide text-white">Portfolio</span>
{/if}
<button
onclick={() => (collapsed = !collapsed)}
class="rounded-md p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
>
<svg
xmlns="http://www.w3.org/2000/svg"
class="h-5 w-5 transition-transform duration-300"
class:rotate-180={collapsed}
fill="none"
viewBox="0 0 24 24"
stroke="currentColor"
stroke-width="2"
>
<path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
</svg>
</button>
</div>

<nav class="flex-1 overflow-y-auto overflow-x-hidden py-4">
{#each navTree as node (node.id)}
{@const active = isParentActive(node)}
{@const hasChildren = node.children.length > 0}
{@const groupOpen = expanded[node.id] ?? active}

<div class="mb-0.5 px-2">
{#if hasChildren}
<button
onclick={() => toggleGroup(node.id)}
class="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium transition-colors hover:bg-slate-700 hover:text-white"
class:bg-slate-700={active}
class:text-white={active}
class:text-slate-400={!active}
title={collapsed ? node.label : ''}
>
<svg
xmlns="http://www.w3.org/2000/svg"
class="h-5 w-5 shrink-0"
fill="none"
viewBox="0 0 24 24"
stroke="currentColor"
stroke-width="2"
>
{#each (icons[node.icon] ?? icons.circle).split(' M') as seg, i}
<path stroke-linecap="round" stroke-linejoin="round" d={i === 0 ? seg : 'M' + seg} />
{/each}
</svg>
{#if !collapsed}
<span class="flex-1 truncate text-left">{node.label}</span>
<svg
xmlns="http://www.w3.org/2000/svg"
class="h-4 w-4 shrink-0 transition-transform duration-200"
class:rotate-90={groupOpen}
fill="none"
viewBox="0 0 24 24"
stroke="currentColor"
stroke-width="2"
>
<path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
</svg>
{/if}
</button>
{#if !collapsed && groupOpen}
<div class="ml-3 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
{#each node.children as child (child.id)}
{@const childActive = isActive(child.href)}
<a
href={child.href}
onclick={() => (mobileOpen = false)}
class="flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors"
class:bg-indigo-600={childActive}
class:text-white={childActive}
class:text-slate-400={!childActive}
class:hover:bg-slate-700={!childActive}
class:hover:text-white={!childActive}
>
<svg
xmlns="http://www.w3.org/2000/svg"
class="h-4 w-4 shrink-0"
fill="none"
viewBox="0 0 24 24"
stroke="currentColor"
stroke-width="2"
>
{#each (icons[child.icon] ?? icons.circle).split(' M') as seg, i}
<path stroke-linecap="round" stroke-linejoin="round" d={i === 0 ? seg : 'M' + seg} />
{/each}
</svg>
<span class="truncate">{child.label}</span>
</a>
{/each}
</div>
{/if}
{:else}
<a
href={node.href}
onclick={() => (mobileOpen = false)}
class="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium transition-colors hover:bg-slate-700 hover:text-white"
class:bg-indigo-600={active}
class:text-white={active}
class:text-slate-400={!active}
title={collapsed ? node.label : ''}
>
<svg
xmlns="http://www.w3.org/2000/svg"
class="h-5 w-5 shrink-0"
fill="none"
viewBox="0 0 24 24"
stroke="currentColor"
stroke-width="2"
>
{#each (icons[node.icon] ?? icons.circle).split(' M') as seg, i}
<path stroke-linecap="round" stroke-linejoin="round" d={i === 0 ? seg : 'M' + seg} />
{/each}
</svg>
{#if !collapsed}
<span class="truncate">{node.label}</span>
{/if}
</a>
{/if}
</div>
{/each}
</nav>

{#if !collapsed}
<div class="border-t border-slate-700 px-4 py-3 text-xs text-slate-500">© 2025 Portfolio</div>
{/if}
</aside>
