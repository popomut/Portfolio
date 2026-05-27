<svelte:options runes={false} />

<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';

	type Card = {
		id: number;
		name: string;
		money: number;
		color?: string;
	};

	export let card: Card;
	export let draggable = true;
	export let onDelete: (() => void | Promise<void>) | undefined = undefined;
	export let onEdit: (name: string, money: number, color?: string) => void | Promise<void> = () => {};

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

	const dispatch = createEventDispatcher<{
		edited: Card;
		deleted: { id: number };
	}>();

	let editing = false;
	let editName = card.name;
	let editMoney = card.money;
	let editColor = card.color || '#FFE5B4';
	let nameError = '';
	let moneyError = '';
	let error = '';
	let nameInput: HTMLInputElement;

	$: if (!editing) {
		editName = card.name;
		editMoney = card.money;
		editColor = card.color || '#FFE5B4';
	}

	function validate() {
		nameError = editName.trim() ? '' : 'Name required';
		moneyError = Number.isNaN(Number.parseFloat(String(editMoney))) ? 'Money must be a number' : '';
		return !nameError && !moneyError;
	}

	function handleEditInput() {
		if (nameError || moneyError) {
			validate();
		}
	}

	async function toggleEdit() {
		if (editing) {
			await saveEdit();
			return;
		}

		nameError = '';
		moneyError = '';
		editing = true;
		await tick();
		nameInput?.focus();
		nameInput?.select();
	}

	async function saveEdit() {
		if (!editing) {
			return;
		}

		if (!validate()) {
			return;
		}

		const nextName = editName.trim();
		const nextMoney = Number.parseFloat(String(editMoney));

		try {
			await onEdit(nextName, nextMoney, editColor);
			dispatch('edited', {
				...card,
				name: nextName,
				money: nextMoney,
				color: editColor
			});
			nameError = '';
			moneyError = '';
			error = '';
			editing = false;
		} catch (editError) {
			error = editError instanceof Error ? editError.message : 'Failed to update card';
			console.error(editError);
		}
	}

	function cancelEdit() {
		nameError = '';
		moneyError = '';
		editing = false;
	}

	function handleEditorBlur(event: FocusEvent) {
		const nextTarget = event.relatedTarget;
		if (nextTarget instanceof Node && event.currentTarget instanceof HTMLElement) {
			if (event.currentTarget.contains(nextTarget)) {
				return;
			}
		}

		// Don't auto-save, wait for explicit Save button
		// void saveEdit();
	}

	function handleEditKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void saveEdit();
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			cancelEdit();
		}
	}

	function handleCardKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void toggleEdit();
		}
	}

	async function deleteCard() {
		try {
			await onDelete?.();
			dispatch('deleted', { id: card.id });
			error = '';
		} catch (deleteError) {
			error = deleteError instanceof Error ? deleteError.message : 'Failed to delete card';
			console.error(deleteError);
		}
	}
</script>

{#if error}
	<div class="error" role="alert">{error}</div>
{/if}

<div class="card" {draggable} style="background-color: {card.color || '#FFE5B4'}">
	{#if editing}
		<div class="editor" on:focusout={handleEditorBlur}>
			<input
				bind:this={nameInput}
				bind:value={editName}
				aria-label="Card name"
				aria-invalid={nameError ? 'true' : 'false'}
				on:input={handleEditInput}
				on:keydown={handleEditKeydown}
			/>
			{#if nameError}
				<div class="error" role="alert">{nameError}</div>
			{/if}
			<input
				bind:value={editMoney}
				aria-label="Card money"
				aria-invalid={moneyError ? 'true' : 'false'}
				type="number"
				step="0.01"
				on:input={handleEditInput}
				on:keydown={handleEditKeydown}
			/>
			{#if moneyError}
				<div class="error" role="alert">{moneyError}</div>
			{/if}
			<div class="color-picker">
				<label for="card-color-picker">Color:</label>
				<div id="card-color-picker" class="color-options">
					{#each COLORS as c}
						<button
							type="button"
							class="color-option"
							style="background-color: {c}"
							on:click|preventDefault={() => (editColor = c)}
							title={c}
							aria-pressed={editColor === c}
						></button>
					{/each}
				</div>
			</div>
			<div class="actions">
				<button type="button" on:click={toggleEdit} disabled={!!nameError || !!moneyError}>
					Save
				</button>
				<button type="button" on:click={cancelEdit}>Cancel</button>
			</div>
		</div>
	{:else}
		<div
			class="content"
			role="button"
			tabindex="0"
			on:click={toggleEdit}
			on:keydown={handleCardKeydown}
		>
			<div>
				<strong>{card.name}</strong>
			</div>
			<div>${card.money.toLocaleString()}</div>
		</div>
		<div class="actions">
			<button type="button" on:click={deleteCard}>Delete</button>
		</div>
	{/if}
</div>

<style>
	.card {
		border: 1px solid #bbb;
		padding: 0.75rem;
		margin: 0.5rem 0;
		border-radius: 4px;
		background: white;
		cursor: move;
		transition:
			opacity 0.2s,
			transform 0.2s,
			box-shadow 0.2s;
		display: grid;
		gap: 0.5rem;
		box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
	}

	.card:hover {
		opacity: 0.8;
		transform: translateY(-1px);
	}

	:global(.card.dragging),
	:global(#dnd-action-dragged-el.dragging) {
		opacity: 0.5;
		cursor: grabbing;
		box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
	}

	.content,
	.editor {
		display: grid;
		gap: 0.5rem;
	}

	.content {
		cursor: pointer;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	input,
	button {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font: inherit;
	}

	button {
		background: #007bff;
		color: white;
		cursor: pointer;
	}

	button:hover {
		background: #0056b3;
	}

	.error {
		color: #b00020;
	}

	.color-picker {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		margin: 0.5rem 0;
	}

	.color-picker label {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.color-options {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.color-option {
		width: 2rem;
		height: 2rem;
		border: 2px solid #999;
		border-radius: 4px;
		cursor: pointer;
		transition: transform 0.1s;
		background: white;
		padding: 0;
	}

	.color-option[aria-pressed='true'] {
		border: 3px solid #000;
		transform: scale(1.1);
	}

	.color-option:hover {
		opacity: 0.8;
	}

	.color-picker {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		margin: 0.5rem 0;
	}

	.color-picker label {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.color-option {
		width: 2rem;
		height: 2rem;
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
</style>
