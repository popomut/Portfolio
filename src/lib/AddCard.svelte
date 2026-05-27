<svelte:options runes={false} />

<script lang="ts">
	export let areaId: number;
	export let onAdd: (
		areaId: number,
		name: string,
		money: number,
		color?: string
	) => void | Promise<void> = () => {};

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

	let name = '';
	let money = '';
	let color = '#FFE5B4';
	let nameError = '';
	let moneyError = '';
	let error = '';

	function validate() {
		nameError = name.trim() ? '' : 'Name required';
		moneyError = Number.isNaN(Number.parseFloat(money)) ? 'Money must be a number' : '';
		return !nameError && !moneyError;
	}

	function handleInput() {
		if (nameError || moneyError) {
			validate();
		}
	}

	async function handleSubmit() {
		const trimmedName = name.trim();
		const parsedMoney = Number.parseFloat(money);

		if (!validate()) {
			return;
		}

		try {
			await onAdd(areaId, trimmedName, parsedMoney, color);
			name = '';
			money = '';
			color = '#FFE5B4';
			nameError = '';
			moneyError = '';
			error = '';
		} catch (submitError) {
			error = submitError instanceof Error ? submitError.message : 'Failed to add card';
			console.error(submitError);
		}
	}
</script>

<form class="add-card" on:submit|preventDefault={handleSubmit}>
	<input
		bind:value={name}
		placeholder="Card name"
		aria-label="Card name"
		aria-invalid={nameError ? 'true' : 'false'}
		on:input={handleInput}
	/>
	{#if nameError}
		<div class="error" role="alert">{nameError}</div>
	{/if}
	<input
		bind:value={money}
		type="number"
		step="0.01"
		placeholder="Money"
		aria-label="Card money"
		aria-invalid={moneyError ? 'true' : 'false'}
		on:input={handleInput}
	/>
	{#if moneyError}
		<div class="error" role="alert">{moneyError}</div>
	{/if}
	<div class="color-picker">
		<label for="add-color-picker">Color:</label>
		<div id="add-color-picker" class="color-options">
			{#each COLORS as c}
				<button
					type="button"
					class="color-option"
					style="background-color: {c}"
					on:click={() => (color = c)}
					title={c}
					aria-pressed={color === c}
				></button>
			{/each}
		</div>
	</div>
	<button type="submit" disabled={!!nameError || !!moneyError}>Add Card</button>
</form>

{#if error}
	<div class="error" role="alert">{error}</div>
{/if}

<style>
	.add-card {
		display: grid;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid #d6deeb;
		border-radius: 0.75rem;
		background: #ffffff;
	}

	input,
	button {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font: inherit;
	}

	input {
		width: 100%;
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
	}

	.color-picker label {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.color-option {
		width: 1.75rem;
		height: 1.75rem;
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
