<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import Wrench from '@lucide/svelte/icons/wrench';
	import Zap from '@lucide/svelte/icons/zap';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	let { data, form } = $props();

	let seedPending = $state(false);
	let resetPending = $state(false);
	let seedGroupPending = $state<number | null>(null);

	const groupBadge = [
		'',
		'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
		'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
		'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
	];
	const groupBorder = [
		'',
		'border-blue-200 dark:border-blue-800',
		'border-purple-200 dark:border-purple-800',
		'border-orange-200 dark:border-orange-800'
	];
</script>

<svelte:head><title>Admin — Tools</title></svelte:head>

<div class="space-y-8 max-w-2xl">
	<h1 class="flex items-center gap-3 text-3xl font-bold text-primary">
		<Wrench class="h-7 w-7" /> Testing Tools
	</h1>
	<p class="text-sm text-muted-foreground">
		Use <strong>Seed Group</strong> buttons to simulate the draft one group at a time — this lets
		you test the Group 2/3 order panels and scoring as the draft progresses. Use
		<strong>Seed Draft</strong> to jump straight to a completed draft. Use
		<strong>Reset All</strong> to wipe test data before going live.
	</p>

	<!-- Workflow -->
	<Card.Card class="border-muted">
		<Card.CardHeader class="pb-2">
			<Card.CardTitle class="text-base">Testing Workflow</Card.CardTitle>
		</Card.CardHeader>
		<Card.CardContent>
			<ol class="space-y-2 text-sm text-muted-foreground list-none">
				{#each [
					{ step: '1', href: '/admin/tools', label: 'Tools', action: 'Seed Group 1', desc: 'Simulates picks 1–20, sets draft to in_progress' },
					{ step: '2', href: '/admin', label: 'Draft', action: 'Set Group 2 order', desc: 'The order panel appears in the last round of G1' },
					{ step: '3', href: '/admin/tools', label: 'Tools', action: 'Seed Group 2', desc: 'Simulates picks 21–40' },
					{ step: '4', href: '/admin', label: 'Draft', action: 'Set Group 3 order', desc: 'Same panel appears in the last round of G2' },
					{ step: '5', href: '/admin/tools', label: 'Tools', action: 'Seed Group 3', desc: 'Simulates picks 41–60, sets draft to complete' },
					{ step: '6', href: '/admin/scores', label: 'Scores', action: 'Record eliminations', desc: 'Run each round manually' },
					{ step: '7', href: '/leaderboard', label: 'Leaderboard', action: 'Verify scoring', desc: 'Confirm points are calculating correctly' },
					{ step: '8', href: '/admin/tools', label: 'Tools', action: 'Reset All', desc: 'Clean slate — ready to go live' },
				] as item}
					<li class="flex items-start gap-3">
						<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{item.step}</span>
						<span>
							<a href={item.href} class="font-medium text-foreground hover:text-primary hover:underline">{item.label}</a>
							<span class="mx-1 text-muted-foreground/50">→</span>
							<strong class="text-foreground">{item.action}</strong>
							<span class="text-muted-foreground"> — {item.desc}</span>
						</span>
					</li>
				{/each}
			</ol>
		</Card.CardContent>
	</Card.Card>

	<Separator />

	<!-- Seed by Group -->
	<div class="space-y-3">
		<div>
			<h2 class="text-base font-semibold flex items-center gap-2">
				<Zap class="h-4 w-4 text-primary" /> Seed by Group
			</h2>
			<p class="text-sm text-muted-foreground mt-0.5">
				Simulate one group at a time to test the full draft flow including the Group 2/3 order panels.
			</p>
		</div>

		<div class="grid gap-3 sm:grid-cols-3">
			{#each data.groupStatus as gs}
				<Card.Card class="border-2 {groupBorder[gs.group]}">
					<Card.CardContent class="pt-4 pb-4 space-y-3">
						<div class="flex items-center justify-between">
							<span class="rounded font-bold text-xs px-2 py-0.5 {groupBadge[gs.group]}">G{gs.group}</span>
							{#if gs.complete}
								<span class="text-xs text-accent font-medium">✅ Done</span>
							{:else if gs.pickCount > 0}
								<span class="text-xs text-amber-600">{gs.pickCount}/{gs.total} picks</span>
							{:else}
								<span class="text-xs text-muted-foreground">0/{gs.total} picks</span>
							{/if}
						</div>

						<div class="text-xs text-muted-foreground space-y-0.5">
							<p>Rounds {gs.group * 2 - 1}–{gs.group * 2}</p>
							<p>Picks {(gs.group - 1) * gs.total + 1}–{gs.group * gs.total}</p>
							<p>Order: {gs.hasOrder ? '✅ set' : '⚠️ will auto-generate'}</p>
						</div>

						<form method="POST" action="?/seedGroup" use:enhance={() => {
							seedGroupPending = gs.group;
							return async ({ update }) => {
								await update();
								seedGroupPending = null;
							};
						}}>
							<input type="hidden" name="group" value={gs.group} />
							<Button
								type="submit"
								size="sm"
								class="w-full"
								variant={gs.complete ? 'outline' : 'default'}
								disabled={seedGroupPending !== null || gs.complete}
							>
								{#if seedGroupPending === gs.group}
									<LoaderCircle class="h-3.5 w-3.5 animate-spin mr-1.5" />Seeding…
								{:else if gs.complete}
									Already seeded
								{:else}
									Seed Group {gs.group}
								{/if}
							</Button>
						</form>
					</Card.CardContent>
				</Card.Card>
			{/each}
		</div>

		{#if form?.seedGroupSuccess}
			<p class="text-sm text-accent">{form.seedGroupSuccess}</p>
		{/if}
		{#if form?.seedGroupError}
			<p class="text-sm text-destructive">{form.seedGroupError}</p>
		{/if}
	</div>

	<Separator />

	<!-- Seed Draft (full) -->
	<Card.Card class="border-primary/30">
		<Card.CardHeader>
			<Card.CardTitle class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-primary" /> Seed Draft (Full)
			</Card.CardTitle>
			<Card.CardDescription>
				Simulates all 60 picks at once and sets draft to complete. Use this to skip straight to scoring tests.
			</Card.CardDescription>
		</Card.CardHeader>
		<Card.CardContent class="space-y-4">
			<div class="rounded-md bg-muted/40 px-4 py-3 text-sm space-y-1">
				<p><strong>Pool teams:</strong> {data.poolTeams.length}</p>
				<p><strong>Existing picks:</strong> {data.pickCount}</p>
				<p><strong>Draft status:</strong> <code>{data.draftStatus ?? 'none'}</code></p>
			</div>
			{#if data.pickCount > 0}
				<p class="text-sm text-amber-600 flex items-center gap-1.5">
					<CircleAlert class="h-4 w-4 shrink-0" />
					{data.pickCount} picks already exist — reset first if you want a fresh seed.
				</p>
			{/if}
			<form method="POST" action="?/seedDraft" use:enhance={() => {
				seedPending = true;
				return async ({ update }) => { await update(); seedPending = false; };
			}}>
				<Button type="submit" disabled={seedPending || data.pickCount >= 60} class="w-full">
					{#if seedPending}
						<LoaderCircle class="h-4 w-4 animate-spin mr-2" />Seeding…
					{:else if data.pickCount >= 60}
						Draft already complete
					{:else}
						Seed Draft (60 picks)
					{/if}
				</Button>
			</form>
			{#if form?.seedSuccess}
				<p class="text-sm text-accent">{form.seedSuccess}</p>
			{/if}
			{#if form?.seedError}
				<p class="text-sm text-destructive">{form.seedError}</p>
			{/if}
		</Card.CardContent>
	</Card.Card>

	<!-- Reset All -->
	<Card.Card class="border-destructive/40">
		<Card.CardHeader>
			<Card.CardTitle class="flex items-center gap-2 text-destructive">
				<Trash2 class="h-5 w-5" /> Reset All
			</Card.CardTitle>
			<Card.CardDescription>
				Wipes all picks, game results, draft orders, and resets draft status to
				<code>not_started</code>. Also clears <code>eliminated_round</code> on all NCAA teams.
			</Card.CardDescription>
		</Card.CardHeader>
		<Card.CardContent class="space-y-4">
			<div class="rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm space-y-1">
				<p><strong>Picks to delete:</strong> {data.pickCount}</p>
				<p><strong>Game results to delete:</strong> {data.resultCount}</p>
				<p><strong>Draft orders to delete:</strong> {data.orderCount}</p>
				<p><strong>Teams with eliminated_round:</strong> {data.eliminatedCount}</p>
			</div>
			<form method="POST" action="?/resetAll" use:enhance={() => {
				if (!confirm('This will permanently delete all picks, results, and draft orders. Continue?')) {
					return ({ cancel }: { cancel: () => void }) => cancel();
				}
				resetPending = true;
				return async ({ update }: { update: () => Promise<void> }) => { await update(); resetPending = false; };
			}}>
				<Button type="submit" variant="destructive" disabled={resetPending} class="w-full">
					{#if resetPending}
						<LoaderCircle class="h-4 w-4 animate-spin mr-2" />Resetting…
					{:else}
						Reset All Data
					{/if}
				</Button>
			</form>
			{#if form?.resetSuccess}
				<p class="text-sm text-accent">{form.resetSuccess}</p>
			{/if}
			{#if form?.resetError}
				<p class="text-sm text-destructive">{form.resetError}</p>
			{/if}
		</Card.CardContent>
	</Card.Card>
</div>
