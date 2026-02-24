<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { TOURNAMENT_ROUNDS, REGIONS, isTeamAlive } from '$lib/types';

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
	<h1 class="text-3xl font-bold text-primary">Tournament Results & Scoring</h1>

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
					<Card.CardTitle>Recent Results</Card.CardTitle>
				</Card.CardHeader>
				<Card.CardContent class="max-h-[400px] overflow-y-auto">
					{#if data.results.length === 0}
						<p class="text-sm text-muted-foreground">No results recorded yet.</p>
					{:else}
						<div class="space-y-1">
							{#each [...data.results].reverse() as result}
								{@const team = result.expand?.team}
								<div class="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
									<span class="font-medium {result.won ? 'text-accent' : 'text-destructive'}">
										{result.won ? 'W' : 'L'}
									</span>
									<span>({team?.seed}) {team?.name ?? '?'}</span>
									<span class="ml-auto text-xs text-muted-foreground">{roundLabels[result.tournament_round]}</span>
									<form method="POST" action="?/deleteResult" use:enhance>
										<input type="hidden" name="result_id" value={result.id} />
										<button type="submit" class="text-xs text-destructive hover:underline">del</button>
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
					<Card.CardTitle>Leaderboard</Card.CardTitle>
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
										<tr class="border-b {i === 0 ? 'bg-primary/10 font-bold' : i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
											<td class="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
											<td class="px-4 py-2.5">{entry.user.name}</td>
											<td class="px-4 py-2.5 text-right font-bold {i === 0 ? 'text-primary' : ''}">{entry.total}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<Separator class="my-6" />

						<!-- Score Breakdown -->
						{#each data.leaderboard as entry}
							{#if entry.breakdown.length > 0}
								<div class="mb-4">
									<p class="mb-2 font-semibold">{entry.user.name} — {entry.total} pts</p>
									<div class="space-y-0.5 text-sm text-muted-foreground">
										{#each entry.breakdown as b}
											<div class="flex gap-2 px-2">
												<span class="w-24">{roundLabels[b.round]}</span>
												<span>{b.team}</span>
												<span class="ml-auto font-medium text-foreground">+{b.points}</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					{/if}
				</Card.CardContent>
			</Card.Card>
		</div>
	</div>
</div>
