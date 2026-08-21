<script lang="ts">
import { invalidateAll } from '$app/navigation';

let showConfirm = $state(false);
let deleting = $state(false);

let initializing = $state(false);
let initResult = $state<{ ok: boolean; message: string; tables?: string[] } | null>(null);

async function handleDelete() {
  if (!showConfirm || deleting) return;
  deleting = true;
  try {
    const res = await fetch('/api/settings/delete-all-data', { method: 'POST' });
    if (res.ok) {
      showConfirm = false;
      await invalidateAll();
    }
  } finally {
    deleting = false;
  }
}

async function handleInitDb() {
  if (initializing) return;
  initializing = true;
  initResult = null;
  try {
    const res = await fetch('/api/settings/init-db', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      initResult = {
        ok: true,
        message: `Schema ready — ${data.ensured?.length ?? 0} tables/indexes ensured.`,
        tables: data.ensured
      };
      await invalidateAll();
    } else {
      initResult = { ok: false, message: data.error ?? 'Failed to initialize database.' };
    }
  } catch (err) {
    initResult = { ok: false, message: (err as Error).message };
  } finally {
    initializing = false;
  }
}
</script>

<div class="max-w-xl space-y-6">
  <h2 class="text-2xl font-bold text-slate-800">Settings</h2>

  <!-- Initialize database -->
  <div class="rounded-xl border border-indigo-200 bg-white p-6 shadow-sm">
    <div>
      <p class="text-lg font-semibold text-indigo-700">Initialize Database</p>
      <p class="text-sm text-slate-500 mt-1">
        Creates any missing tables/indexes required by the app (portfolio, SETMAI, trend-following, and lot-match tracking).
        Safe to run at any time — existing data is preserved and existing tables are left untouched.
      </p>
    </div>
    <button
      onclick={handleInitDb}
      disabled={initializing}
      class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if initializing}
        Initializing...
      {:else}
        Create Missing Tables
      {/if}
    </button>
    {#if initResult}
      <div
        class="mt-3 rounded-lg border px-4 py-2 text-sm"
        class:border-green-200={initResult.ok}
        class:bg-green-50={initResult.ok}
        class:text-green-700={initResult.ok}
        class:border-red-200={!initResult.ok}
        class:bg-red-50={!initResult.ok}
        class:text-red-700={!initResult.ok}
      >
        <p class="font-medium">{initResult.message}</p>
        {#if initResult.tables && initResult.tables.length > 0}
          <p class="mt-1 text-xs text-slate-500">
            Ensured: {initResult.tables.join(', ')}
          </p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Delete all data -->
  <div class="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
    <div>
      <p class="text-lg font-semibold text-red-700">Delete All Data</p>
      <p class="text-sm text-slate-500 mt-1">
        This will permanently remove all stocks, transactions, and dividends. This action cannot be undone.
      </p>
    </div>
    {#if !showConfirm}
      <button
        onclick={() => showConfirm = true}
        class="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
      >
        Delete All Data
      </button>
    {:else}
      <div class="mt-4 flex items-center gap-3">
        <button
          onclick={handleDelete}
          disabled={deleting}
          class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if deleting}
            Deleting...
          {:else}
            Confirm Delete
          {/if}
        </button>
        <button
          onclick={() => showConfirm = false}
          disabled={deleting}
          class="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    {/if}
  </div>
</div>
