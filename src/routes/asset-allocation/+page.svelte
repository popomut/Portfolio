<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import Area from '$lib/Area.svelte';
	import AddArea from '$lib/AddArea.svelte';
	import AddCard from '$lib/AddCard.svelte';
	import Legend from '$lib/Legend.svelte';

	type CardData = {
		id: number;
		name: string;
		money: number;
		color?: string;
	};

	type AreaData = {
		id: number;
		name: string;
		cards: CardData[];
	};

	type DataPayload = {
		areas: AreaData[];
		nextIdArea: number;
		nextIdCard: number;
		legend?: Array<{ id: number; color: string; label: string }>;
		nextIdLegend?: number;
	};

	let data: DataPayload | null = null;
	let error = '';
	let loading = true;

	onMount(() => {
		void loadData();
	});

	async function loadData() {
		loading = true;
		error = '';

		try {
			const response = await fetch('/api/asset-allocation/data');
			if (!response.ok) {
				throw new Error('Failed to load data');
			}

			data = (await response.json()) as DataPayload;
		} catch (loadError) {
			error = loadError instanceof Error ? loadError.message : 'Failed to load data';
			console.error(loadError);
		} finally {
			loading = false;
		}
	}

	function cloneData(payload: DataPayload) {
		return JSON.parse(JSON.stringify(payload)) as DataPayload;
	}

	async function saveData(payload: DataPayload) {
		try {
			const response = await fetch('/api/asset-allocation/data', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				throw new Error('Failed to save data');
			}

			data = (await response.json()) as DataPayload;
			error = '';
		} catch (saveError) {
			error = saveError instanceof Error ? saveError.message : 'Failed to save data';
			console.error(saveError);
			throw saveError instanceof Error ? saveError : new Error('Failed to save data');
		}
	}

	async function updateData(transform: (current: DataPayload) => DataPayload) {
		if (!data) {
			return;
		}

		const previousData = cloneData(data);
		const nextData = transform(cloneData(data));
		data = nextData;
		error = '';

		try {
			await saveData(nextData);
		} catch (saveError) {
			data = previousData;
			throw saveError;
		}
	}

	async function handleAddArea(name: string) {
		await updateData((current) => ({
			...current,
			nextIdArea: current.nextIdArea + 1,
			areas: [...current.areas, { id: current.nextIdArea, name, cards: [] }]
		}));
	}

	async function handleAddCard(areaId: number, name: string, money: number, color?: string) {
		await updateData((current) => ({
			...current,
			nextIdCard: current.nextIdCard + 1,
			areas: current.areas.map((area) =>
				area.id === areaId
					? {
							...area,
							cards: [
								...area.cards,
								{ id: current.nextIdCard, name, money, color: color || '#FFE5B4' }
							]
						}
					: area
			)
		}));
	}

	async function handleCardsChange(areaId: number, cards: CardData[]) {
		await updateData((current) => ({
			...current,
			areas: current.areas.map((area) => (area.id === areaId ? { ...area, cards } : area))
		}));
	}

	async function handleAreaNameEdit(areaId: number, name: string) {
		await updateData((current) => ({
			...current,
			areas: current.areas.map((area) => (area.id === areaId ? { ...area, name } : area))
		}));
	}

	async function handleDeleteArea(areaId: number) {
		await updateData((current) => ({
			...current,
			areas: current.areas.filter((area) => area.id !== areaId)
		}));
	}

	async function handleEditCard(
		areaId: number,
		cardId: number,
		name: string,
		money: number,
		color?: string
	) {
		await updateData((current) => ({
			...current,
			areas: current.areas.map((area) =>
				area.id === areaId
					? {
							...area,
							cards: area.cards.map((card) =>
								card.id === cardId ? { ...card, name, money, color: color || card.color } : card
							)
						}
					: area
			)
		}));
	}

	async function handleDeleteCard(areaId: number, cardId: number) {
		await updateData((current) => ({
			...current,
			areas: current.areas.map((area) =>
				area.id === areaId
					? { ...area, cards: area.cards.filter((card) => card.id !== cardId) }
					: area
			)
		}));
	}

	async function handleEditLegend(
		legendItems: Array<{ id: number; color: string; label: string }>
	) {
		await updateData((current) => ({
			...current,
			legend: legendItems
		}));
	}
</script>

<svelte:head>
	<title>PlanMoney</title>
</svelte:head>

{#if loading}
	<p>Loading...</p>
{:else if error}
	<p class="error">{error}</p>
{/if}

{#if data}
	<div class="page">
		<h1>PlanMoney</h1>
		<AddArea onAdd={handleAddArea} />
		<Legend legend={data.legend || []} onUpdate={handleEditLegend} />

		<div class="areas">
			{#each data.areas as area (area.id)}
				<section class="area-block">
					<Area
						{area}
						onCardsChange={(cards) => handleCardsChange(area.id, cards)}
						onDelete={() => handleDeleteArea(area.id)}
						onEditName={(name) => handleAreaNameEdit(area.id, name)}
						onEditCard={(cardId, name, money, color) =>
							handleEditCard(area.id, cardId, name, money, color)}
						onDeleteCard={(cardId) => handleDeleteCard(area.id, cardId)}
					/>
					<AddCard areaId={area.id} onAdd={handleAddCard} />
				</section>
			{/each}
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: Arial, sans-serif;
		background: #eef3f8;
		color: #1f2933;
	}

	.page {
		display: grid;
		gap: 1.5rem;
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 2.75rem);
	}

	.areas {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1.5rem;
		align-items: start;
	}

	.area-block {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
		border: 1px solid #d6deeb;
		border-radius: 1rem;
		background: linear-gradient(180deg, #ffffff 0%, #f6f8fb 100%);
		box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
	}

	.error {
		color: #b00020;
		padding: 1rem 1.5rem 0;
	}
</style>
