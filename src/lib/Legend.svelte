<svelte:options runes={false} />

<script lang="ts">
	import { tick } from 'svelte';

	type LegendItem = {
		id: number;
		color: string;
		label: string;
	};

	export let legend: LegendItem[] = [];
	export let onUpdate: (items: LegendItem[]) => void | Promise<void> = () => {};

	const COLORS = [
		'#FFE5B4', // Peach
		'#87CEEB', // Sky Blue
		'#FFB6C1', // Light Pink
		'#90EE90', // Light Green
		'#FFD700', // Gold
		'#DDA0DD', // Plum
		'#F08080', // Light Coral
		'#20B2AA', // Light Sea Green
		'#FFDAB9', // Peach Puff
		'#B0E0E6', // Powder Blue
		'#FFA07A', // Light Salmon
		'#98FB98', // Pale Green
		'#FFE4B5', // Moccasin
		'#E0FFFF', // Light Cyan
		'#F0E68C', // Khaki
		'#EE82EE'  // Violet
	];

	let isAdding = false;
	let newColor = '#FFE5B4';
	let newLabel = '';
	let labelError = '';
	let nextId = Math.max(...legend.map((l) => l.id), 0) + 1;
	let labelInput: HTMLInputElement;

	async function startAdd() {
		isAdding = true;
		newColor = '#FFE5B4';
		newLabel = '';
		labelError = '';
		await tick();
		labelInput?.focus();
	}

	function validate() {
		labelError = newLabel.trim() ? '' : 'Label required';
		return !labelError;
	}

	async function addItem() {
		if (!validate()) return;

		const item: LegendItem = {
			id: nextId,
			color: newColor,
			label: newLabel.trim()
		};

		nextId++;
		const updated = [...legend, item];

		try {
			await onUpdate(updated);
			newLabel = '';
			isAdding = false;
			labelError = '';
		} catch (e) {
			console.error('Failed to add legend item:', e);
		}
	}

	async function deleteItem(id: number) {
		const updated = legend.filter((item) => item.id !== id);
		try {
			await onUpdate(updated);
		} catch (e) {
			console.error('Failed to delete legend item:', e);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void addItem();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			isAdding = false;
		}
	}
</script>

<div class="legend-container">
	<h3>Legend</h3>
	<div class="legend-list">
		{#each legend as item (item.id)}
			<div class="legend-item">
				<div class="color-box" style="background-color: {item.color}" title={item.color}></div>
				<span class="label">{item.label}</span>
				<button type="button" on:click={() => deleteItem(item.id)} class="delete-btn">
					×
				</button>
			</div>
		{/each}
		{#if isAdding}
			<div class="legend-editor">
				<div class="color-picker-small">
					{#each COLORS as color}
						<button
							type="button"
							class="color-option"
							style="background-color: {color}"
							on:click={() => (newColor = color)}
							title={color}
							aria-pressed={newColor === color}
						></button>
					{/each}
				</div>
				<input
					bind:this={labelInput}
					bind:value={newLabel}
					placeholder="Label"
					on:keydown={handleKeydown}
					aria-invalid={labelError ? 'true' : 'false'}
				/>
				{#if labelError}
					<div class="error">{labelError}</div>
				{/if}
				<div class="editor-actions">
					<button type="button" on:click={addItem} disabled={!!labelError}>Add</button>
					<button type="button" on:click={() => (isAdding = false)}>Cancel</button>
				</div>
			</div>
		{:else}
			<button type="button" on:click={startAdd} class="add-btn">+ Add Legend Item</button>
		{/if}
	</div>
</div>

<style>
	.legend-container {
		padding: 1rem;
		border: 2px solid #ddd;
		border-radius: 8px;
		background: #f9f9f9;
		margin-bottom: 1.5rem;
	}

	h3 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
	}

	.legend-list {
		display: grid;
		gap: 0.75rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		background: white;
		border-radius: 4px;
		border: 1px solid #e0e0e0;
	}

	.color-box {
		width: 2rem;
		height: 2rem;
		border-radius: 4px;
		border: 1px solid #999;
		flex-shrink: 0;
	}

	.label {
		flex: 1;
		font-weight: 500;
	}

	.delete-btn {
		background: #ff6b6b;
		color: white;
		border: none;
		border-radius: 4px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 1.2rem;
		line-height: 1;
	}

	.delete-btn:hover {
		background: #ff5252;
	}

	.add-btn {
		width: 100%;
		padding: 0.75rem;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
	}

	.add-btn:hover {
		background: #0056b3;
	}

	.legend-editor {
		display: grid;
		gap: 0.5rem;
		padding: 0.75rem;
		background: white;
		border: 1px dashed #ccc;
		border-radius: 4px;
	}

	.color-picker-small {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.color-option {
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid #999;
		border-radius: 4px;
		cursor: pointer;
		transition: transform 0.1s;
	}

	.color-option[aria-pressed='true'] {
		border: 3px solid #000;
		transform: scale(1.1);
	}

	.color-option:hover {
		opacity: 0.8;
	}

	input {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font: inherit;
	}

	.editor-actions {
		display: flex;
		gap: 0.5rem;
	}

	.editor-actions button {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
		font: inherit;
	}

	.editor-actions button:first-child {
		background: #007bff;
		color: white;
	}

	.editor-actions button:first-child:hover {
		background: #0056b3;
	}

	.editor-actions button:last-child {
		background: #e0e0e0;
	}

	.editor-actions button:last-child:hover {
		background: #ccc;
	}

	.error {
		color: #b00020;
		font-size: 0.9rem;
	}
</style>
