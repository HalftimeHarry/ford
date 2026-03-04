<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { TOURNAMENT_ROUNDS, REGIONS, isTeamAlive } from '$lib/types';
	import Trophy from '@lucide/svelte/icons/trophy';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Trash from '@lucide/svelte/icons/trash';
	import LeaderboardComponent from '$lib/components/Leaderboard.svelte';

	let { data, form } = $props();

	const roundLabels: Record<string, string> = {
		round_1: '1st Round (Rd of 64)',
		round_2: '2nd Round (Rd of 32)',
		round_3: '3rd Round (Sweet 16)',
		round_4: '4th Round (Elite 8)',
		semifinal: 'Semi-Final (Final Four)',
		final: 'Final (Championship)'
	};

	let selectedRound = $state<string>('round_1');

	// Teams that are still active (no eliminated_round set)
	let activeTeams = $derived(data.teams.filter((t) => isTeamAlive(t)));
</script>

<svelte:head>
	<title>Admin - Scores & Results</title>
</svelte:head>

<div class="space-y-8">
	<h1 class="flex items-center gap-3 text-3xl font-bold text-primary">
		<Trophy class="h-7 w-7" /> Tournament Results & Scoring
	</h1>

	<div class="grid gap-8 lg:grid-cols-3">
		<!-- Record Result -->
		<div class="space-y-6">
			<Card.Card class="border-primary/30">
				<Card.CardHeader>
					<Card.CardTitle>Record Game Result</Card.CardTitle>
					<Card.CardDescription>Mark a team as winning or losing a round</Card.CardDescription>
				</Card.CardHeader>
				<Card.CardContent>
					<form method="POST" action="?/recordResult" use:enhance>
						<div class="space-y-4">
							<div class="space-y-2">
								<Label for="tournament_round">Tournament Round</Label>
								<select
									id="tournament_round"
									name="tournament_round"
									bind:value={selectedRound}
									class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
									required
								>
									{#each TOURNAMENT_ROUNDS as round}
										<option value={round}>{roundLabels[round]}</option>
									{/each}
								</select>
							</div>

							<div class="space-y-2">
								<Label for="result-team">Team</Label>
								<select
									id="result-team"
									name="team"
									class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
									required
								>
									<option value="">Select team...</option>
									{#each REGIONS as region}
										<optgroup label={region}>
											{#each activeTeams.filter((t) => t.region === region) as team}
												<option value={team.id}>({team.seed}) {team.name}</option>
											{/each}
										</optgroup>
									{/each}
								</select>
							</div>

							<div class="flex gap-2">
								<Button type="submit" name="won" value="true" class="flex-1">
									Won
								</Button>
								<Button type="submit" name="won" value="false" variant="outline" class="flex-1">
									Lost (Eliminated)
								</Button>
							</div>
						</div>
					</form>
					{#if form?.resultSuccess}
						<p class="mt-2 text-sm text-accent">Result recorded!</p>
					{/if}
					{#if form?.resultError}
						<p class="mt-2 text-sm text-destructive">{form.resultError}</p>
					{/if}
				</Card.CardContent>
			</Card.Card>

			<!-- Recent Results -->
			<Card.Card>
				<Card.CardHeader>
					<Card.CardTitle class="flex items-center gap-2">
						<ChartBar class="h-4 w-4" /> Recent Results
					</Card.CardTitle>
				</Card.CardHeader>
				<Card.CardContent class="max-h-[400px] overflow-y-auto p-0">
					{#if data.results.length === 0}
						<p class="p-4 text-sm text-muted-foreground">No results recorded yet.</p>
					{:else}
						<div class="overflow-hidden rounded-b-lg">
							{#each [...data.results].reverse() as result, i}
								{@const team = result.expand?.team}
								<div class="flex items-center gap-2 px-3 py-2 text-sm {i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
									{#if result.won}
										<CircleCheck class="h-4 w-4 shrink-0 text-accent" />
									{:else}
										<CircleX class="h-4 w-4 shrink-0 text-destructive" />
									{/if}
									<span class="flex-1 truncate">({team?.seed}) {team?.name ?? '?'}</span>
									<span class="text-xs text-muted-foreground shrink-0">{roundLabels[result.tournament_round]}</span>
									<form method="POST" action="?/deleteResult" use:enhance>
										<input type="hidden" name="result_id" value={result.id} />
										<button type="submit" class="shrink-0 text-destructive hover:text-destructive/70">
											<Trash class="h-3.5 w-3.5" />
										</button>
									</form>
								</div>
							{/each}
						</div>
					{/if}
				</Card.CardContent>
			</Card.Card>
		</div>

		<!-- Leaderboard -->
		<div class="lg:col-span-2">
			<Card.Card>
				<Card.CardHeader>
					<div class="flex items-center justify-between">
						<Card.CardTitle class="flex items-center gap-2">
							<Trophy class="h-4 w-4" /> Leaderboard
						</Card.CardTitle>
						<a href="/leaderboard" target="_blank" class="text-xs text-muted-foreground hover:text-primary underline">
							Public view ↗
						</a>
					</div>
				</Card.CardHeader>
				<Card.CardContent>
					<LeaderboardComponent
						entries={data.leaderboard}
						showBreakdown={true}
					/>
				</Card.CardContent>
			</Card.Card>
		</div>
	</div>
</div>
