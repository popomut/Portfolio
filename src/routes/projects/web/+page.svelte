<div class="space-y-4">
	<h2 class="text-2xl font-bold text-slate-800">Web Apps</h2>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#each ['Portfolio Site', 'Task Manager', 'E-Commerce Dashboard', 'Blog Platform'] as name, i}
			<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<div class="flex items-center gap-3 mb-2">
					<div class="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">#{i + 1}</div>
					<h3 class="font-semibold text-slate-800">{name}</h3>
				</div>
				<p class="text-sm text-slate-500">A web application built with modern frameworks and best practices.</p>
			</div>
		{/each}
	</div>
</div>
