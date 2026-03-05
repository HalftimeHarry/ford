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

	const roundOrder = TOURNAMENT_ROUNDS;

	// How many losers required per round
	const requiredLosers: Record<string, number> = {
		round_1: 32, round_2: 16, round_3: 8,
		round_4: 4, semifinal: 2, final: 1
	};

	let selectedRound = $state<string>('round_1');

	// Teams still alive (no eliminated_round)
	let activeTeams = $derived(data.teams.filter((t) => isTeamAlive(t)));

	// Results for the selected round
	let roundResults = $derived(data.results.filter((r) => r.tournament_round === selectedRound));
	let roundResultTeamIds = $derived(new Set(roundResults.map((r) => r.team)));

	// Teams eligible to record for this round (alive + no result yet)
	let eligibleTeams = $derived(activeTeams.filter((t) => !roundResultTeamIds.has(t.id)));

	// Round is complete when result count >= required losers * 2
	function isRoundComplete(round: string): boolean {
		return data.results.filter((r) => r.tournament_round === round).length >= requiredLosers[round] * 2;
	}

	// Next round after the current one
	function nextRound(round: string): string | null {
		const idx = roundOrder.indexOf(round);
		return idx >= 0 && idx < roundOrder.length - 1 ? roundOrder[idx + 1] : null;
	}

	// Selected losers
	let selectedLosers = $state<Set<string>>(new Set());
	let submitReady = $derived(selectedLosers.size === requiredLosers[selectedRound]);

	// Progress
	let submitting = $state(false);
	let submitProgress = $state(0);
	let submitSuccess = $state<string | null>(null);
	let submitError = $state<string | null>(null);
	let progressInterval: ReturnType<typeof setInterval> | null = null;

	function startProgress(total: number) {
		submitting = true;
		submitProgress = 0;
		submitSuccess = null;
		submitError = null;
		if (progressInterval) clearInterval(progressInterval);
		const stepMs = Math.max(30, Math.round(4000 / total));
		progressInterval = setInterval(() => {
			submitProgress = Math.min(submitProgress + (80 / total), 80);
			if (submitProgress >= 80 && progressInterval) {
				clearInterval(progressInterval);
				progressInterval = null;
			}
		}, stepMs);
	}

	function finishProgress(completedRound: string | null, msg: string | null, err: string | null) {
		if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
		submitProgress = 100;
		setTimeout(() => {
			submitting = false;
			submitProgress = 0;
			submitSuccess = msg;
			submitError = err;
			if (completedRound) {
				const next = nextRound(completedRound);
				if (next) selectedRound = next;
			}
		}, 600);
	}

	async function handleSubmit() {
		if (!submitReady || submitting) return;
		// Snapshot state synchronously before any async work
		const round = selectedRound;
		const losers = [...selectedLosers];
		const alive = activeTeams.map((t) => t.id);

		startProgress(requiredLosers[round] * 2);

		const fd = new FormData();
		fd.set('tournament_round', round);
		fd.set('loser_ids', losers.join(','));
		fd.set('alive_team_ids', alive.join(','));

		try {
			const res = await fetch('?/bulkRecord', {
				method: 'POST',
				body: fd,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const json = await res.json();
			// SvelteKit action response: { type: 'success'|'failure', status, data: {...} }
			const payload = json?.data ?? json;
			if (json?.type === 'success' && payload?.bulkSuccess) {
				finishProgress(round, payload.bulkSuccess, null);
			} else {
				finishProgress(null, null, payload?.bulkError ?? json?.error?.message ?? 'Failed to record results');
			}
		} catch (e) {
			finishProgress(null, null, e instanceof Error ? e.message : 'Request failed');
		}
	}

	// Tab: 'record' | 'corrections'
	let activeTab = $state<'record' | 'corrections'>('record');
	let correctionRound = $state<string>('round_1');
	let correctionResults = $derived(data.results.filter((r) => r.tournament_round === correctionRound));

	// Correction pair selection: pick the wrongly-eliminated team, then the wrongly-advancing team
	let mistakeResultId = $state<string | null>(null);     // the ❌ that should have been ✅
	let replacementResultId = $state<string | null>(null); // the ✅ that should have been ❌
	let swapping = $state(false);
	let swapMessage = $state<string | null>(null);

	$effect(() => {
		// Reset selections when round changes
		correctionRound;
		mistakeResultId = null;
		replacementResultId = null;
		swapMessage = null;
	});

	function selectCorrection(result: { id: string; won: boolean }) {
		swapMessage = null;
		if (result.won) {
			// Clicking a winner = this is the replacement (should have lost)
			replacementResultId = replacementResultId === result.id ? null : result.id;
		} else {
			// Clicking a loser = this is the mistake (should have won)
			mistakeResultId = mistakeResultId === result.id ? null : result.id;
		}
	}

	async function submitSwap() {
		if (!mistakeResultId || !replacementResultId || swapping) return;
		swapping = true;
		swapMessage = null;
		const fd = new FormData();
		fd.set('mistake_result_id', mistakeResultId);
		fd.set('replacement_result_id', replacementResultId);
		try {
			const res = await fetch('?/swapPair', {
				method: 'POST',
				body: fd,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const json = await res.json();
			const payload = json?.data ?? json;
			if (json?.type === 'success') {
				swapMessage = 'Swap applied. Refresh to see updated results.';
				mistakeResultId = null;
				replacementResultId = null;
			} else {
				swapMessage = payload?.swapError ?? 'Swap failed';
			}
		} catch (e) {
			swapMessage = e instanceof Error ? e.message : 'Request failed';
		} finally {
			swapping = false;
		}
	}

	// Reset selections when round changes
	$effect(() => {
		selectedRound;
		selectedLosers = new Set();
	});

	function toggleLoser(teamId: string) {
		const next = new Set(selectedLosers);
		if (next.has(teamId)) next.delete(teamId); else next.add(teamId);
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
			<Card.Card class="border-primary/30">
				<Card.CardHeader class="pb-3">
					<!-- Tab switcher -->
					<div class="flex gap-1 rounded-lg bg-muted p-1 w-fit">
						<button
							type="button"
							onclick={() => (activeTab = 'record')}
							class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
								{activeTab === 'record' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
						>Record Results</button>
						<button
							type="button"
							onclick={() => (activeTab = 'corrections')}
							class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
								{activeTab === 'corrections' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
						>Corrections</button>
					</div>
					{#if activeTab === 'record'}
						<Card.CardDescription class="mt-2">
							Select a round, check the teams that were <strong>eliminated</strong>, then submit.
							Winners are recorded automatically for all unchecked teams.
						</Card.CardDescription>
					{:else}
						<Card.CardDescription class="mt-2">
							Select a round to view its results. Click a team to flip its result (win ↔ loss).
						</Card.CardDescription>
					{/if}
				</Card.CardHeader>
				<Card.CardContent class="space-y-4">
					{#if activeTab === 'corrections'}
						<!-- Round selector -->
						<div class="flex flex-wrap gap-2">
							{#each TOURNAMENT_ROUNDS as round}
								{@const hasAny = data.results.some((r) => r.tournament_round === round)}
								<button type="button" onclick={() => (correctionRound = round)} disabled={!hasAny}
									class="rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-30
										{correctionRound === round ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}"
								>{roundLabels[round]}</button>
							{/each}
						</div>

						<!-- Step indicator -->
						<div class="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
							<span class="font-semibold {!mistakeResultId ? 'text-primary' : 'text-muted-foreground line-through'}">
								1. Click the ❌ team that should have advanced
							</span>
							<span class="text-muted-foreground/40">→</span>
							<span class="font-semibold {mistakeResultId && !replacementResultId ? 'text-primary' : 'text-muted-foreground'}
								{!mistakeResultId ? 'opacity-40' : ''}">
								2. Click the ✅ team that should have been eliminated
							</span>
						</div>

						<Separator />

						{#if correctionResults.length === 0}
							<p class="text-sm text-muted-foreground text-center py-4">No results recorded for this round yet.</p>
						{:else}
							<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
								{#each REGIONS as region}
									{@const regionResults = correctionResults
										.filter((r) => data.teams.find((t) => t.id === r.team)?.region === region)
										.sort((a, b) => (data.teams.find((t) => t.id === a.team)?.seed ?? 99) - (data.teams.find((t) => t.id === b.team)?.seed ?? 99))}
									{#if regionResults.length > 0}
										<div class="space-y-0.5">
											<p class="text-xs font-bold uppercase tracking-widest text-primary border-b border-primary/20 pb-1 mb-1">{region}</p>
											{#each regionResults as result}
												{@const team = data.teams.find((t) => t.id === result.team)}
												{@const isMistake = mistakeResultId === result.id}
												{@const isReplacement = replacementResultId === result.id}
												{@const canSelect = result.won ? !mistakeResultId || isReplacement : !replacementResultId || isMistake}
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div
													onclick={() => selectCorrection(result)}
													class="flex items-center gap-1.5 rounded px-1.5 py-1.5 text-xs cursor-pointer select-none transition-all
														{isMistake ? 'ring-2 ring-orange-400 bg-orange-400/10 text-orange-300'
															: isReplacement ? 'ring-2 ring-orange-400 bg-orange-400/10 text-orange-300'
															: result.won ? 'bg-accent/10 hover:bg-accent/20'
															: 'bg-destructive/10 text-destructive hover:bg-destructive/20'}
														{!canSelect ? 'opacity-40 cursor-not-allowed' : ''}"
												>
													{#if result.won}
														<CircleCheck class="h-3 w-3 shrink-0 {isReplacement ? 'text-orange-400' : 'text-accent'}" />
													{:else}
														<CircleX class="h-3 w-3 shrink-0 {isMistake ? 'text-orange-400' : 'text-destructive'}" />
													{/if}
													<span class="w-4 text-right font-mono text-muted-foreground shrink-0">{team?.seed}</span>
													<span class="flex-1 truncate font-medium">{team?.name ?? '?'}</span>
													{#if isMistake}<span class="shrink-0 text-orange-400 font-bold text-xs">MISTAKE</span>{/if}
													{#if isReplacement}<span class="shrink-0 text-orange-400 font-bold text-xs">REPLACE</span>{/if}
												</div>
											{/each}
										</div>
									{/if}
								{/each}
							</div>

							<!-- Swap confirm -->
							{#if mistakeResultId && replacementResultId}
								{@const mistakeTeam = data.teams.find((t) => t.id === correctionResults.find((r) => r.id === mistakeResultId)?.team)}
								{@const replaceTeam = data.teams.find((t) => t.id === correctionResults.find((r) => r.id === replacementResultId)?.team)}
								<div class="rounded-lg border border-orange-400/40 bg-orange-400/5 p-3 space-y-2">
									<p class="text-xs font-medium">Confirm swap:</p>
									<p class="text-xs text-muted-foreground">
										<span class="text-destructive font-medium">{mistakeTeam?.name ?? '?'}</span> ❌→✅ advances &nbsp;·&nbsp;
										<span class="text-accent font-medium">{replaceTeam?.name ?? '?'}</span> ✅→❌ eliminated
									</p>
									<div class="flex gap-2">
										<Button onclick={submitSwap} disabled={swapping} size="sm" class="flex-1">
											{swapping ? 'Swapping…' : 'Apply Swap'}
										</Button>
										<Button onclick={() => { mistakeResultId = null; replacementResultId = null; }} variant="outline" size="sm">
											Cancel
										</Button>
									</div>
								</div>
							{/if}
							{#if swapMessage}
								<p class="text-sm {swapMessage.includes('failed') || swapMessage.includes('Failed') ? 'text-destructive' : 'text-accent'}">{swapMessage}</p>
							{/if}
						{/if}
					{:else}
					<!-- Record tab content below -->
					<!-- Round tabs -->
					<div class="flex flex-wrap gap-2">
						{#each TOURNAMENT_ROUNDS as round}
							{@const complete = isRoundComplete(round)}
							{@const hasAny = data.results.some((r) => r.tournament_round === round)}
							<button
								type="button"
								onclick={() => (selectedRound = round)}
								class="rounded-full px-3 py-1 text-xs font-medium transition-colors
									{selectedRound === round
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground hover:bg-muted/70'}
									{complete ? 'ring-1 ring-accent/50' : hasAny ? 'ring-1 ring-orange-400/60' : ''}"
							>
								{roundLabels[round]}
								{#if complete}<span class="ml-1">✅</span>{:else if hasAny}<span class="ml-1 opacity-60">⏳</span>{/if}
							</button>
						{/each}
					</div>

					<Separator />

					<!-- Team grid by region -->
					{#if eligibleTeams.length === 0}
						<!-- Round complete — show recorded results so admin can delete mistakes -->
						<div class="space-y-3">
							<p class="text-sm text-accent text-center py-2 flex items-center justify-center gap-1.5">
								<CircleCheck class="h-4 w-4" /> All results recorded for this round.
							</p>
							<p class="text-xs text-muted-foreground text-center">To fix a mistake, delete the result below then re-submit.</p>
							<div class="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
								{#each REGIONS as region}
									{@const regionResults = roundResults
										.filter((r) => data.teams.find((t) => t.id === r.team)?.region === region)
										.sort((a, b) => {
											const sa = data.teams.find((t) => t.id === a.team)?.seed ?? 99;
											const sb = data.teams.find((t) => t.id === b.team)?.seed ?? 99;
											return sa - sb;
										})}
									{#if regionResults.length > 0}
										<div class="space-y-0.5">
											<p class="text-xs font-bold uppercase tracking-widest text-primary border-b border-primary/20 pb-1 mb-1">{region}</p>
											{#each regionResults as result}
												{@const team = data.teams.find((t) => t.id === result.team)}
												<div class="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs {result.won ? 'bg-accent/10' : 'bg-destructive/10'}">
													{#if result.won}
														<CircleCheck class="h-3 w-3 shrink-0 text-accent" />
													{:else}
														<CircleX class="h-3 w-3 shrink-0 text-destructive" />
													{/if}
													<span class="w-4 text-right font-mono text-muted-foreground shrink-0">{team?.seed}</span>
													<span class="flex-1 truncate font-medium">{team?.name ?? '?'}</span>
													<form method="POST" action="?/deleteResult" use:enhance>
														<input type="hidden" name="result_id" value={result.id} />
														<button type="submit" class="shrink-0 text-muted-foreground/40 hover:text-destructive" title="Delete result">
															<Trash class="h-3 w-3" />
														</button>
													</form>
												</div>
											{/each}
										</div>
									{/if}
								{/each}
							</div>
						</div>
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
						<div class="space-y-2">
							<Button onclick={handleSubmit} disabled={!submitReady || submitting} class="w-full">
								{#if submitting}
									Recording…
								{:else}
									Record {roundLabels[selectedRound]} Results
									{#if selectedLosers.size > 0}
										({selectedLosers.size} eliminated, {eligibleTeams.length - selectedLosers.size} advance)
									{/if}
								{/if}
							</Button>

							<!-- Progress bar -->
							{#if submitting}
								<div class="space-y-1">
									<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
										<div
											class="h-full rounded-full bg-primary transition-all duration-200"
											style="width: {submitProgress}%"
										></div>
									</div>
									<p class="text-xs text-center text-muted-foreground">
										Saving to PocketBase… ({Math.round(submitProgress)}%)
									</p>
								</div>
							{:else if !submitReady}
								<p class="text-xs text-center text-muted-foreground">
									Select exactly {requiredLosers[selectedRound]} eliminated team{requiredLosers[selectedRound] !== 1 ? 's' : ''} to submit
									({selectedLosers.size} / {requiredLosers[selectedRound]} selected)
								</p>
							{/if}

							{#if submitSuccess}
								<p class="flex items-center gap-1.5 text-sm text-accent">
									<CircleCheck class="h-4 w-4" /> Results recorded — {submitSuccess}
								</p>
							{/if}
							{#if submitError}
								<p class="text-sm text-destructive">{submitError}</p>
							{/if}
						</div>
					{/if}
				{/if}
				<!-- end activeTab === 'corrections' / record -->
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
