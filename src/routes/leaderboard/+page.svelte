<script lang="ts">
	import fordLogo from '$lib/assets/ford_logo.png';
	import * as Card from '$lib/components/ui/card';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Trophy from '@lucide/svelte/icons/trophy';

	let { data } = $props();
</script>

<svelte:head>
	<title>Leaderboard — Ford's Pool 2026</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<header class="border-b bg-primary px-4 py-4 text-primary-foreground">
		<div class="mx-auto flex max-w-2xl items-center gap-3">
			<img src={fordLogo} alt="Ford's Pool" class="h-9 w-9 rounded-full bg-white object-contain p-0.5" />
			<div>
				<h1 class="text-xl font-bold leading-tight">Ford's Pool 2026</h1>
				<p class="text-xs opacity-75">NCAA Basketball · Live Standings</p>
			</div>
			<a href="/" class="ml-auto text-xs opacity-75 hover:opacity-100 underline">Sign in</a>
		</div>
	</header>

	<main class="mx-auto max-w-2xl px-4 py-8">
		<Card.Card>
			<Card.CardHeader>
				<Card.CardTitle class="flex items-center gap-2 text-2xl font-bold text-primary">
					<Trophy class="h-6 w-6" /> Leaderboard
				</Card.CardTitle>
				{#if data.leaderboard.length > 0}
					<p class="text-sm text-muted-foreground">
						Click any row to see score breakdown.
					</p>
				{/if}
			</Card.CardHeader>
			<Card.CardContent>
				<Leaderboard
					entries={data.leaderboard}
					showBreakdown={true}
				/>
			</Card.CardContent>
		</Card.Card>
	</main>

	<footer class="border-t bg-muted/50 py-4 text-center text-xs text-muted-foreground">
		Ford's Pool 2026 · Scores update as results are recorded
	</footer>
</div>
