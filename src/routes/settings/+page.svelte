<script lang="ts">
import { invalidateAll } from '$app/navigation';

let showConfirm = $state(false);
let deleting = $state(false);

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
</script>

<div class="max-w-xl space-y-6">
  <h2 class="text-2xl font-bold text-slate-800">Settings</h2>
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
