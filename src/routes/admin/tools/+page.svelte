<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import Wrench from '@lucide/svelte/icons/wrench';
	import Zap from '@lucide/svelte/icons/zap';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	let { data, form } = $props();

	let seedPending = $state(false);
	let resetPending = $state(false);
</script>

<svelte:head><title>Admin — Tools</title></svelte:head>

<div class="space-y-8 max-w-2xl">
	<h1 class="flex items-center gap-3 text-3xl font-bold text-primary">
		<Wrench class="h-7 w-7" /> Testing Tools
	</h1>
	<p class="text-sm text-muted-foreground">
		These tools exist for testing only. Use <strong>Seed Draft</strong> to simulate a completed
		draft, then manually run eliminations on the Scores page. Use <strong>Reset All</strong> to
		wipe test data before going live.
	</p>

	<!-- Workflow -->
	<Card.Card class="border-muted">
		<Card.CardHeader class="pb-2">
			<Card.CardTitle class="text-base">Testing Workflow</Card.CardTitle>
		</Card.CardHeader>
		<Card.CardContent>
			<ol class="space-y-2 text-sm text-muted-foreground list-none">
				{#each [
					{ step: '1', href: '/admin/tools', label: 'Tools', action: 'Seed Draft', desc: '60 picks created across all 10 teams' },
					{ step: '2', href: '/admin/scores', label: 'Scores', action: 'Record eliminations', desc: 'Run each round manually, marking losers in bulk' },
					{ step: '3', href: '/leaderboard', label: 'Leaderboard', action: 'Verify scoring', desc: 'Confirm points are calculating correctly' },
					{ step: '4', href: '/admin/tools', label: 'Tools', action: 'Reset All', desc: 'Clean slate — ready to go live' },
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

	<!-- Seed Draft -->
	<Card.Card class="border-primary/30">
		<Card.CardHeader>
			<Card.CardTitle class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-primary" /> Seed Draft
			</Card.CardTitle>
			<Card.CardDescription class="space-y-1">
				<p>Simulates a complete draft across all 10 pool teams.</p>
			</Card.CardDescription>
		</Card.CardHeader>
		<Card.CardContent class="space-y-4">
			<ul class="space-y-1.5 text-sm text-muted-foreground">
				<li class="flex items-start gap-2"><span class="mt-0.5 text-primary shrink-0">•</span>Generates a random snake order for all 3 round groups</li>
				<li class="flex items-start gap-2"><span class="mt-0.5 text-primary shrink-0">•</span>Simulates all 60 picks using best-available by seed in proper snake order</li>
				<li class="flex items-start gap-2"><span class="mt-0.5 text-primary shrink-0">•</span>Writes picks in batches of 10 to stay within rate limits</li>
				<li class="flex items-start gap-2"><span class="mt-0.5 text-primary shrink-0">•</span>Sets <code class="text-xs bg-muted px-1 py-0.5 rounded">draft_settings.status = complete</code></li>
				<li class="flex items-start gap-2"><span class="mt-0.5 text-primary shrink-0">•</span>Disabled if 60 picks already exist — reset first for a fresh run</li>
			</ul>
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
					{seedPending ? 'Seeding…' : data.pickCount >= 60 ? 'Draft already complete' : 'Seed Draft (60 picks)'}
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
				Run this before going live to ensure a clean slate.
			</Card.CardDescription>
		</Card.CardHeader>
		<Card.CardContent class="space-y-4">
			<ul class="space-y-1.5 text-sm text-muted-foreground">
				<li class="flex items-start gap-2"><span class="mt-0.5 text-destructive shrink-0">•</span>Requires a confirmation prompt before running</li>
				<li class="flex items-start gap-2"><span class="mt-0.5 text-destructive shrink-0">•</span>Deletes all <code class="text-xs bg-muted px-1 py-0.5 rounded">draft_picks</code>, <code class="text-xs bg-muted px-1 py-0.5 rounded">game_results</code>, and <code class="text-xs bg-muted px-1 py-0.5 rounded">draft_orders</code></li>
				<li class="flex items-start gap-2"><span class="mt-0.5 text-destructive shrink-0">•</span>Clears <code class="text-xs bg-muted px-1 py-0.5 rounded">eliminated_round</code> on every NCAA team</li>
				<li class="flex items-start gap-2"><span class="mt-0.5 text-destructive shrink-0">•</span>Resets <code class="text-xs bg-muted px-1 py-0.5 rounded">draft_settings.status = not_started</code></li>
				<li class="flex items-start gap-2"><span class="mt-0.5 text-destructive shrink-0">•</span>Reports exactly what was deleted in the success message</li>
			</ul>
			<div class="rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm space-y-1">
				<p><strong>Picks to delete:</strong> {data.pickCount}</p>
				<p><strong>Game results to delete:</strong> {data.resultCount}</p>
				<p><strong>Draft orders to delete:</strong> {data.orderCount}</p>
				<p><strong>Teams with eliminated_round:</strong> {data.eliminatedCount}</p>
			</div>
			<form method="POST" action="?/resetAll" use:enhance={() => {
				if (!confirm('This will permanently delete all picks, results, and draft orders. Continue?')) {
					return ({ cancel }) => cancel();
				}
				resetPending = true;
				return async ({ update }) => { await update(); resetPending = false; };
			}}>
				<Button type="submit" variant="destructive" disabled={resetPending} class="w-full">
					{resetPending ? 'Resetting…' : 'Reset All Data'}
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
