<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Sidebar from '$lib/components/Sidebar.svelte';

	let { children, data } = $props();

	let sidebarCollapsed = $state(false);
	let mobileOpen = $state(false);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex h-screen overflow-hidden bg-slate-50">
	<!-- Mobile overlay backdrop -->
	{#if mobileOpen}
		<div
			class="fixed inset-0 z-20 bg-black/50 lg:hidden"
			onclick={() => (mobileOpen = false)}
			role="button"
			tabindex="-1"
			aria-label="Close sidebar"
		></div>
	{/if}

	<!-- Sidebar: fixed overlay on mobile, static on desktop -->
	<div
		class="fixed inset-y-0 left-0 z-30 transition-transform duration-300 lg:static lg:translate-x-0 lg:z-auto"
		class:-translate-x-full={!mobileOpen}
		class:translate-x-0={mobileOpen}
	>
		<Sidebar navTree={data.navTree} bind:collapsed={sidebarCollapsed} bind:mobileOpen />
	</div>

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		<header
			class="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"
		>
			<!-- Hamburger button (mobile only) -->
			<button
				class="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
				onclick={() => (mobileOpen = !mobileOpen)}
				aria-label="Open sidebar"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
			<h1 class="text-xl font-semibold text-slate-800">Stock Portfolio</h1>
		</header>

		<main class="flex-1 overflow-y-auto p-4 lg:p-6">
			{@render children()}
		</main>
	</div>
</div>

