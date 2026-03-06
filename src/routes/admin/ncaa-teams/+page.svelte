<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { REGIONS } from '$lib/types';
	import type { NcaaTeam } from '$lib/types';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';

	let { data, form } = $props();

	// --- Edit modal state ---
	let editTeam = $state<NcaaTeam | null>(null);
	let editName = $state('');
	let editRegion = $state('');
	let editSeed = $state(1);
	let editPending = $state(false);

	function openEdit(team: NcaaTeam) {
		editTeam = team;
		editName = team.name;
		editRegion = team.region;
		editSeed = team.seed;
	}

	function closeEdit() {
		editTeam = null;
	}

	// --- Create form state ---
	let showCreate = $state(false);
	let createName = $state('');
	let createRegion = $state(REGIONS[0]);
	let createSeed = $state(1);
	let createPending = $state(false);

	function openCreate() {
		createName = '';
		createRegion = REGIONS[0];
		createSeed = 1;
		showCreate = true;
	}

	// --- Delete state ---
	let deletePending = $state<string | null>(null);

	// Group teams by region for display
	let byRegion = $derived(
		REGIONS.map((r) => ({
			region: r,
			teams: data.teams
				.filter((t: NcaaTeam) => t.region === r)
				.sort((a: NcaaTeam, b: NcaaTeam) => a.seed - b.seed)
		}))
	);

	// Close edit modal on successful update
	$effect(() => {
		if (form?.updateSuccess) closeEdit();
		if (form?.createSuccess) showCreate = false;
	});
</script>

<svelte:head>
	<title>NCAA Teams - Admin</title>
</svelte:head>

<div class="space-y-6">
	<Separator />

	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold">NCAA Teams</h1>
			<p class="text-sm text-muted-foreground mt-0.5">{data.teams.length} teams · edit name/seed or add new teams</p>
		</div>
		<Button size="sm" onclick={openCreate}>
			<Plus class="h-3.5 w-3.5 mr-1.5" />
			New Team
		</Button>
	</div>

	{#if form?.deleteError}
		<p class="text-sm text-destructive">{form.deleteError}</p>
	{/if}

	<!-- Teams by region -->
	<div class="grid gap-4 sm:grid-cols-2">
		{#each byRegion as { region, teams }}
			<Card.Card>
				<Card.CardHeader class="pb-2 pt-4 px-4">
					<Card.CardTitle class="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{region}</Card.CardTitle>
				</Card.CardHeader>
				<Card.CardContent class="px-4 pb-4 space-y-1">
					{#each teams as team (team.id)}
						<div class="flex items-center gap-2 rounded px-2 py-1.5 text-sm
							{team.eliminated_round ? 'opacity-50' : ''}
							odd:bg-muted/40 even:bg-card hover:bg-muted/70 transition-colors">
							<span class="w-5 text-right font-mono text-xs text-muted-foreground shrink-0">#{team.seed}</span>
							<span class="flex-1 truncate font-medium">{team.name}</span>
							{#if team.eliminated_round}
								<span class="text-xs text-muted-foreground shrink-0">out R{team.eliminated_round}</span>
							{/if}
							<button
								type="button"
								onclick={() => openEdit(team)}
								class="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
								title="Edit"
							>
								<Pencil class="h-3 w-3" />
							</button>
							<form method="POST" action="?/delete" use:enhance={() => {
								deletePending = team.id;
								return async ({ update }) => {
									await update();
									deletePending = null;
								};
							}}>
								<input type="hidden" name="id" value={team.id} />
								<button
									type="submit"
									disabled={deletePending === team.id}
									class="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
									title="Delete"
									onclick={(e) => { if (!confirm(`Delete ${team.name}?`)) e.preventDefault(); }}
								>
									{#if deletePending === team.id}
										<LoaderCircle class="h-3 w-3 animate-spin" />
									{:else}
										<Trash2 class="h-3 w-3" />
									{/if}
								</button>
							</form>
						</div>
					{:else}
						<p class="text-xs text-muted-foreground px-2 py-1">No teams in this region.</p>
					{/each}
				</Card.CardContent>
			</Card.Card>
		{/each}
	</div>
</div>

<!-- Edit modal -->
{#if editTeam}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-label="Edit team"
	>
		<div class="bg-card rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
			<div class="flex items-center justify-between">
				<h2 class="font-semibold">Edit Team</h2>
				<button type="button" onclick={closeEdit} class="text-muted-foreground hover:text-foreground">
					<X class="h-4 w-4" />
				</button>
			</div>

			<form method="POST" action="?/update" use:enhance={() => {
				editPending = true;
				return async ({ update }) => {
					await update();
					editPending = false;
				};
			}} class="space-y-3">
				<input type="hidden" name="id" value={editTeam.id} />

				<div class="space-y-1">
					<label for="edit-name" class="text-sm font-medium">Name</label>
					<input
						id="edit-name"
						name="name"
						type="text"
						bind:value={editName}
						required
						class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div class="space-y-1">
					<label for="edit-region" class="text-sm font-medium">Region</label>
					<select
						id="edit-region"
						name="region"
						bind:value={editRegion}
						class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						{#each REGIONS as r}
							<option value={r}>{r}</option>
						{/each}
					</select>
				</div>

				<div class="space-y-1">
					<label for="edit-seed" class="text-sm font-medium">Seed</label>
					<input
						id="edit-seed"
						name="seed"
						type="number"
						min="1"
						max="16"
						bind:value={editSeed}
						required
						class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				{#if form?.updateError}
					<p class="text-xs text-destructive">{form.updateError}</p>
				{/if}

				<div class="flex gap-2 pt-1">
					<Button type="button" variant="outline" class="flex-1" onclick={closeEdit}>Cancel</Button>
					<Button type="submit" class="flex-1" disabled={editPending}>
						{#if editPending}
							<LoaderCircle class="h-3.5 w-3.5 animate-spin mr-1.5" />
							Saving…
						{:else}
							Save
						{/if}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Create modal -->
{#if showCreate}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-label="Create team"
	>
		<div class="bg-card rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
			<div class="flex items-center justify-between">
				<h2 class="font-semibold">New NCAA Team</h2>
				<button type="button" onclick={() => showCreate = false} class="text-muted-foreground hover:text-foreground">
					<X class="h-4 w-4" />
				</button>
			</div>

			<form method="POST" action="?/create" use:enhance={() => {
				createPending = true;
				return async ({ update }) => {
					await update();
					createPending = false;
				};
			}} class="space-y-3">

				<div class="space-y-1">
					<label for="create-name" class="text-sm font-medium">Name</label>
					<input
						id="create-name"
						name="name"
						type="text"
						bind:value={createName}
						placeholder="e.g. Duke"
						required
						class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div class="space-y-1">
					<label for="create-region" class="text-sm font-medium">Region</label>
					<select
						id="create-region"
						name="region"
						bind:value={createRegion}
						class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						{#each REGIONS as r}
							<option value={r}>{r}</option>
						{/each}
					</select>
				</div>

				<div class="space-y-1">
					<label for="create-seed" class="text-sm font-medium">Seed</label>
					<input
						id="create-seed"
						name="seed"
						type="number"
						min="1"
						max="16"
						bind:value={createSeed}
						required
						class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				{#if form?.createError}
					<p class="text-xs text-destructive">{form.createError}</p>
				{/if}

				<div class="flex gap-2 pt-1">
					<Button type="button" variant="outline" class="flex-1" onclick={() => showCreate = false}>Cancel</Button>
					<Button type="submit" class="flex-1" disabled={createPending}>
						{#if createPending}
							<LoaderCircle class="h-3.5 w-3.5 animate-spin mr-1.5" />
							Creating…
						{:else}
							Create Team
						{/if}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
