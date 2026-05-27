<svelte:options runes={false} />

<script lang="ts">
	export let onAdd: (name: string) => void | Promise<void> = () => {};

	let name = '';
	let nameError = '';
	let error = '';

	function validate() {
		nameError = name.trim() ? '' : 'Name required';
		return !nameError;
	}

	function handleNameInput() {
		if (nameError) {
			validate();
		}
	}

	async function handleSubmit() {
		const trimmedName = name.trim();

		if (!validate()) {
			return;
		}

		try {
			await onAdd(trimmedName);
			name = '';
			nameError = '';
			error = '';
		} catch (submitError) {
			error = submitError instanceof Error ? submitError.message : 'Failed to add area';
			console.error(submitError);
		}
	}
</script>

<form class="add-area" on:submit|preventDefault={handleSubmit}>
	<input
		bind:value={name}
		placeholder="Area name"
		aria-label="Area name"
		aria-invalid={nameError ? 'true' : 'false'}
		on:input={handleNameInput}
	/>
	{#if nameError}
		<div class="error" role="alert">{nameError}</div>
	{/if}
	<button type="submit" disabled={!!nameError}>Add Area</button>
</form>

{#if error}
	<div class="error" role="alert">{error}</div>
{/if}

<style>
	.add-area {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
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
		flex: 1 1 14rem;
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
</style>
