<div class="space-y-4">
	<h2 class="text-2xl font-bold text-slate-800">Projects</h2>
	<p class="text-slate-500">Browse all projects by category using the sidebar.</p>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		{#each [
			{ title: 'Web Apps', href: '/projects/web', desc: 'Browser-based applications' },
			{ title: 'Mobile Apps', href: '/projects/mobile', desc: 'iOS & Android apps' },
			{ title: 'Open Source', href: '/projects/oss', desc: 'Community contributions' }
		] as item}
			<a href={item.href} class="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all">
				<h3 class="font-semibold text-slate-800">{item.title}</h3>
				<p class="mt-1 text-sm text-slate-500">{item.desc}</p>
			</a>
		{/each}
	</div>
</div>
