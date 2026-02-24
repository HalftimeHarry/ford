<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';

	let { data } = $props();

	let myRank = $derived(
		data.leaderboard.findIndex((e) => e.user.id === data.user.id) + 1
	);

	const roundLabels: Record<string, string> = {
		round_1: 'Rd of 64',
		round_2: 'Rd of 32',
		round_3: 'Sweet 16',
		round_4: 'Elite 8',
		semifinal: 'Final Four',
		final: 'Championship'
	};
</script>

<svelte:head>
	<title>My Dashboard - NCAA Pool 2026</title>
</svelte:head>

<div class="space-y-8">
	<!-- Summary -->
	<div class="grid gap-4 sm:grid-cols-3">
		<Card.Card class="text-center">
			<Card.CardContent class="pt-6">
				<p class="text-sm font-medium text-muted-foreground">My Total Points</p>
				<p class="mt-1 text-4xl font-extrabold text-primary">{data.myTotal}</p>
			</Card.CardContent>
		</Card.Card>
		<Card.Card class="text-center">
			<Card.CardContent class="pt-6">
				<p class="text-sm font-medium text-muted-foreground">My Rank</p>
				<p class="mt-1 text-4xl font-extrabold text-accent">
					{myRank > 0 ? `#${myRank}` : '—'}
				</p>
			</Card.CardContent>
		</Card.Card>
		<Card.Card class="text-center">
			<Card.CardContent class="pt-6">
				<p class="text-sm font-medium text-muted-foreground">My Teams</p>
				<p class="mt-1 text-4xl font-extrabold">{data.myTeams.length}</p>
			</Card.CardContent>
		</Card.Card>
	</div>

	<div class="grid gap-8 lg:grid-cols-2">
		<!-- My Teams -->
		<Card.Card>
			<Card.CardHeader>
				<Card.CardTitle class="text-xl font-bold text-primary">My Roster</Card.CardTitle>
			</Card.CardHeader>
			<Card.CardContent>
				{#if data.myTeams.length === 0}
					<p class="text-sm text-muted-foreground">No teams drafted yet. Check back after the draft.</p>
				{:else}
					<div class="space-y-2">
						{#each data.myTeams as entry}
							<div class="flex items-center gap-3 rounded-lg border p-3 {entry.eliminated ? 'opacity-50' : ''}">
								<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
									{entry.team?.seed ?? '?'}
								</div>
								<div class="flex-1">
									<p class="font-medium {entry.eliminated ? 'line-through' : ''}">
										{entry.team?.name ?? 'Unknown'}
									</p>
									<p class="text-xs text-muted-foreground">
										{entry.team?.region ?? ''} Region — {entry.wins} win{entry.wins !== 1 ? 's' : ''}
									</p>
								</div>
								<div class="text-right">
									<p class="font-bold text-primary">{entry.points}</p>
									<p class="text-xs text-muted-foreground">pts</p>
								</div>
								{#if entry.eliminated}
									<span class="text-xs font-medium text-destructive">
										OUT {entry.eliminatedRound ? `(${roundLabels[entry.eliminatedRound] ?? entry.eliminatedRound})` : ''}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</Card.CardContent>
		</Card.Card>

		<!-- Leaderboard -->
		<Card.Card>
			<Card.CardHeader>
				<Card.CardTitle class="text-xl font-bold text-primary">Leaderboard</Card.CardTitle>
			</Card.CardHeader>
			<Card.CardContent>
				{#if data.leaderboard.length === 0}
					<p class="text-sm text-muted-foreground">No scores yet.</p>
				{:else}
					<div class="overflow-hidden rounded-lg border">
						<table class="w-full text-sm">
							<thead>
								<tr class="bg-primary text-primary-foreground">
									<th class="px-4 py-2.5 text-left font-semibold w-12">#</th>
									<th class="px-4 py-2.5 text-left font-semibold">Participant</th>
									<th class="px-4 py-2.5 text-right font-semibold">Points</th>
								</tr>
							</thead>
							<tbody>
								{#each data.leaderboard as entry, i}
									{@const isMe = entry.user.id === data.user.id}
									<tr class="border-b {isMe ? 'bg-primary/10 font-bold' : i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
										<td class="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
										<td class="px-4 py-2.5">
											{entry.user.name}
											{#if isMe}
												<span class="text-xs text-primary">(you)</span>
											{/if}
										</td>
										<td class="px-4 py-2.5 text-right font-bold {i === 0 ? 'text-primary' : ''}">{entry.total}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</Card.CardContent>
		</Card.Card>
	</div>
</div>
