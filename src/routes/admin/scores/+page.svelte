<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
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
		round_3: 'Sweet 16',
		round_4: 'Elite 8',
		semifinal: 'Final Four',
		final: 'Championship'
	};

	let selectedRound = $state<string>('round_1');

	// Teams still alive (no eliminated_round)
	let activeTeams = $derived(data.teams.filter((t) => isTeamAlive(t)));

	// Teams already with a result recorded for the selected round
	let roundResultTeamIds = $derived(
		new Set(data.results.filter((r) => r.tournament_round === selectedRound).map((r) => r.team))
	);

	// Teams eligible to record for this round (alive + no result yet for this round)
	let eligibleTeams = $derived(
		activeTeams.filter((t) => !roundResultTeamIds.has(t.id))
	);

	// Selected losers (eliminated) — checked = lost
	let selectedLosers = $state<Set<string>>(new Set());

	// Reset selections when round changes
	$effect(() => {
		selectedRound; // track
		selectedLosers = new Set();
	});

	function toggleLoser(teamId: string) {
		const next = new Set(selectedLosers);
		if (next.has(teamId)) next.delete(teamId);
		else next.add(teamId);
		selectedLosers = next;
	}

	function selectAllInRegion(region: string) {
		const next = new Set(selectedLosers);
		eligibleTeams.filter((t) => t.region === region).forEach((t) => next.add(t.id));
		selectedLosers = next;
	}

	function clearRegion(region: string) {
		const next = new Set(selectedLosers);
		eligibleTeams.filter((t) => t.region === region).forEach((t) => next.delete(t.id));
		selectedLosers = next;
	}
</script>

<svelte:head>
	<title>Admin - Tournament Results</title>
</svelte:head>

<div class="space-y-8">
	<h1 class="flex items-center gap-3 text-3xl font-bold text-primary">
		<Trophy class="h-7 w-7" /> Tournament Results
	</h1>

	<div class="grid gap-8 lg:grid-cols-[1fr_340px]">
		<!-- Left: Bulk elimination -->
		<div class="space-y-6">
			<!-- Round selector -->
			<Card.Card class="border-primary/30">
				<Card.CardHeader class="pb-3">
					<Card.CardTitle>Record Round Results</Card.CardTitle>
					<Card.CardDescription>
						Select a round, check the teams that were <strong>eliminated</strong>, then submit.
						Winners are recorded automatically for all unchecked teams.
					</Card.CardDescription>
				</Card.CardHeader>
				<Card.CardContent class="space-y-4">
					<!-- Round tabs -->
					<div class="flex flex-wrap gap-2">
						{#each TOURNAMENT_ROUNDS as round}
							{@const hasResults = data.results.some((r) => r.tournament_round === round)}
							<button
								type="button"
								onclick={() => (selectedRound = round)}
								class="rounded-full px-3 py-1 text-xs font-medium transition-colors
									{selectedRound === round
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground hover:bg-muted/70'}
									{hasResults ? 'ring-1 ring-accent/50' : ''}"
							>
								{roundLabels[round]}
								{#if hasResults}<span class="ml-1 opacity-70">✅</span>{/if}
							</button>
						{/each}
					</div>

					<Separator />

					<!-- Team grid by region -->
					{#if eligibleTeams.length === 0}
						<p class="text-sm text-muted-foreground text-center py-4">
							All teams have results recorded for this round.
						</p>
					{:else}
						<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
							{#each REGIONS as region}
								{@const regionTeams = eligibleTeams.filter((t) => t.region === region)}
								{#if regionTeams.length > 0}
									<div class="space-y-1">
										<div class="flex items-center justify-between mb-2">
											<p class="text-xs font-bold uppercase tracking-widest text-primary border-b border-primary/20 pb-1 flex-1">
												{region}
											</p>
											<div class="flex gap-1 ml-2">
												<button type="button" onclick={() => selectAllInRegion(region)}
													class="text-xs text-muted-foreground hover:text-destructive px-1">all</button>
												<button type="button" onclick={() => clearRegion(region)}
													class="text-xs text-muted-foreground hover:text-foreground px-1">none</button>
											</div>
										</div>
										{#each regionTeams.sort((a, b) => a.seed - b.seed) as team}
											{@const isLoser = selectedLosers.has(team.id)}
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div
												onclick={() => toggleLoser(team.id)}
												class="flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer select-none transition-colors
													{isLoser
														? 'bg-destructive/10 border border-destructive/30 text-destructive'
														: 'bg-muted/30 hover:bg-muted/60 border border-transparent'}"
											>
												<span class="w-5 text-right font-mono text-xs text-muted-foreground shrink-0">{team.seed}</span>
												<span class="flex-1 text-sm font-medium truncate">{team.name}</span>
												{#if isLoser}
													<CircleX class="h-4 w-4 shrink-0 text-destructive" />
												{:else}
													<CircleCheck class="h-4 w-4 shrink-0 text-muted-foreground/30" />
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							{/each}
						</div>

						<Separator />

						<!-- Submit -->
						<form method="POST" action="?/bulkRecord" use:enhance>
							<input type="hidden" name="tournament_round" value={selectedRound} />
							<input type="hidden" name="loser_ids" value={[...selectedLosers].join(',')} />
							<input type="hidden" name="all_eligible_ids" value={eligibleTeams.map((t) => t.id).join(',')} />
							<div class="flex items-center gap-4">
								<Button type="submit" disabled={eligibleTeams.length === 0} class="flex-1">
									Record {roundLabels[selectedRound]} Results
									{#if selectedLosers.size > 0}
										({selectedLosers.size} eliminated, {eligibleTeams.length - selectedLosers.size} advance)
									{/if}
								</Button>
							</div>
						</form>

						{#if form?.bulkSuccess}
							<p class="text-sm text-accent">Results recorded — {form.bulkSuccess}</p>
						{/if}
						{#if form?.bulkError}
							<p class="text-sm text-destructive">{form.bulkError}</p>
						{/if}
					{/if}
				</Card.CardContent>
			</Card.Card>

			<!-- Recent Results log -->
			<Card.Card>
				<Card.CardHeader class="pb-2">
					<Card.CardTitle class="flex items-center gap-2 text-base">
						<ChartBar class="h-4 w-4" /> Results Log
					</Card.CardTitle>
				</Card.CardHeader>
				<Card.CardContent class="p-0 max-h-72 overflow-y-auto">
					{#if data.results.length === 0}
						<p class="p-4 text-sm text-muted-foreground">No results recorded yet.</p>
					{:else}
						<div class="overflow-hidden rounded-b-lg">
							{#each [...data.results].reverse() as result, i}
								{@const team = result.expand?.team}
								<div class="flex items-center gap-2 px-3 py-1.5 text-sm {i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
									{#if result.won}
										<CircleCheck class="h-3.5 w-3.5 shrink-0 text-accent" />
									{:else}
										<CircleX class="h-3.5 w-3.5 shrink-0 text-destructive" />
									{/if}
									<span class="flex-1 truncate">({team?.seed}) {team?.name ?? '?'}</span>
									<span class="text-xs text-muted-foreground shrink-0">{roundLabels[result.tournament_round]}</span>
									<form method="POST" action="?/deleteResult" use:enhance>
										<input type="hidden" name="result_id" value={result.id} />
										<button type="submit" class="shrink-0 text-destructive/60 hover:text-destructive">
											<Trash class="h-3 w-3" />
										</button>
									</form>
								</div>
							{/each}
						</div>
					{/if}
				</Card.CardContent>
			</Card.Card>
		</div>

		<!-- Right: Leaderboard -->
		<div>
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
					<LeaderboardComponent entries={data.leaderboard} showBreakdown={true} />
				</Card.CardContent>
			</Card.Card>
		</div>
	</div>
</div>
