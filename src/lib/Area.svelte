<svelte:options runes={false} />

<script lang="ts">
	import { flip } from 'svelte/animate';
	import { tick } from 'svelte';
	import { dndzone as dnd, type DndEvent } from 'svelte-dnd-action';
	import Card from './Card.svelte';

	const COLORS = [
		'#FFE5B4', // Peach
		'#87CEEB', // Sky Blue
		'#FFB6C1', // Light Pink
		'#90EE90', // Light Green
		'#FFD700', // Gold
		'#DDA0DD', // Plum
		'#F08080', // Light Coral
		'#20B2AA'  // Light Sea Green
	];

	type CardData = {
		id: number;
		name: string;
		money: number;
		[key: string]: unknown;
	};

	type AreaData = {
		id: number;
		name: string;
		cards: CardData[];
	};

	export let area: AreaData;
	export let onDelete: () => void | Promise<void> = () => {};
	export let onEditName: (newName: string) => void | Promise<void> = () => {};
	export let onCardsChange: (cards: CardData[]) => void | Promise<void> = () => {};
	export let onDeleteCard: (cardId: number) => void | Promise<void> = () => {};
	export let onEditCard: (
		cardId: number,
		name: string,
		money: number,
		color?: string
	) => void | Promise<void> = () => {};

	let items: CardData[] = [];
	let editing = false;
	let editName = area.name;
	let nameError = '';
	let error = '';
	let editInput: HTMLInputElement;

	$: items = area.cards;
	$: total = items.reduce((sum, card) => sum + card.money, 0);
	$: if (!editing) editName = area.name;

	function validate() {
		nameError = editName.trim() ? '' : 'Name required';
		return !nameError;
	}

	function handleNameInput() {
		if (nameError) {
			validate();
		}
	}

	function handleConsider(event: CustomEvent<DndEvent<CardData>>) {
		items = event.detail.items;
	}

	async function handleFinalize(event: CustomEvent<DndEvent<CardData>>) {
		const previousCards = area.cards;
		const cards = event.detail.items;
		area = { ...area, cards };
		items = cards;

		try {
			await onCardsChange(cards);
			error = '';
		} catch (cardsError) {
			error = cardsError instanceof Error ? cardsError.message : 'Failed to update cards';
			console.error(cardsError);
			area = { ...area, cards: previousCards };
			items = previousCards;
		}
	}

	function transformDraggedCard(element?: HTMLElement) {
		element?.classList.add('dragging');
	}

	async function startEdit() {
		editName = area.name;
		nameError = '';
		editing = true;
		await tick();
		editInput?.focus();
		editInput?.select();
	}

	async function submitEdit() {
		if (!editing) return;
		if (!validate()) return;

		const newName = editName.trim();
		editName = newName;

		if (newName === area.name) {
			editing = false;
			nameError = '';
			error = '';
			return;
		}

		try {
			await onEditName(newName);
			editing = false;
			nameError = '';
			error = '';
		} catch (editError) {
			error = editError instanceof Error ? editError.message : 'Failed to update area';
			console.error(editError);
		}
	}

	function cancelEdit() {
		editing = false;
		editName = area.name;
		nameError = '';
		error = '';
	}

	function handleEditKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void submitEdit();
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			cancelEdit();
		}
	}

	async function handleDeleteArea() {
		try {
			await onDelete();
			error = '';
		} catch (deleteError) {
			error = deleteError instanceof Error ? deleteError.message : 'Failed to delete area';
			console.error(deleteError);
		}
	}
</script>

{#if error}
	<div class="error" role="alert">{error}</div>
{/if}

<div class="area">
	<div class="area-header">
		<div class="area-title">
			{#if editing}
				<div class="name-editor">
					<input
						bind:this={editInput}
						bind:value={editName}
						on:blur={() => void submitEdit()}
						on:input={handleNameInput}
						on:keydown={handleEditKeydown}
						aria-label="Edit area name"
						aria-invalid={nameError ? 'true' : 'false'}
					/>
					<button type="button" on:click={() => void submitEdit()} disabled={!!nameError}>
						Save
					</button>
				</div>
				{#if nameError}
					<div class="error" role="alert">{nameError}</div>
				{/if}
			{:else}
				<button class="title-button" type="button" on:click={() => void startEdit()}>
					{area.name}
				</button>
			{/if}
			<p>Total: ${total.toLocaleString()}</p>
		</div>
		<button type="button" on:click={() => void handleDeleteArea()}>Delete Area</button>
	</div>
	<div
		use:dnd={{
			items,
			type: 'card',
			flipDurationMs: 200,
			dropTargetClasses: ['cards-hover'],
			transformDraggedElement: transformDraggedCard
		}}
		on:consider={handleConsider}
		on:finalize={handleFinalize}
		aria-label={`${area.name} cards`}
		class="cards"
	>
		{#each items as card (card.id)}
			<div animate:flip={{ duration: 200 }}>
				<Card
					{card}
					draggable={false}
					onDelete={() => onDeleteCard(card.id)}
					onEdit={(name, money, color) => onEditCard(card.id, name, money, color)}
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.area {
		border: 2px solid #ddd;
		padding: 1rem;
		margin: 1rem 0;
		border-radius: 8px;
		background: #f9f9f9;
		display: grid;
		gap: 0.75rem;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
	}

	.title-button {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		font-size: 1.5rem;
		font-weight: 700;
		cursor: pointer;
		text-align: left;
		color: #1f2933;
	}

	.name-editor {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.name-editor input {
		flex: 1;
	}

	.name-editor input,
	.name-editor button,
	.area-header > button {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font: inherit;
	}

	.name-editor button,
	.area-header > button {
		background: #007bff;
		color: white;
		cursor: pointer;
		transition: background 0.2s;
	}

	.name-editor button:hover,
	.area-header > button:hover {
		background: #0056b3;
	}

	.error {
		color: #b00020;
	}

	.area-header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 0.75rem;
	}

	.area-title {
		display: grid;
		gap: 0.25rem;
	}

	.cards {
		min-height: 6rem;
		display: grid;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 2px dashed #cbd5e1;
		border-radius: 0.75rem;
		background: #fff;
		transition:
			background-color 0.2s,
			border-color 0.2s,
			box-shadow 0.2s;
	}

	:global(.cards-hover) {
		background: #eef6ff;
		border-color: #60a5fa;
		box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.3);
	}
</style>
