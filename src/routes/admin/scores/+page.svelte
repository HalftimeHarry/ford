<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { TOURNAMENT_ROUNDS, REGIONS, isTeamAlive } from '$lib/types';
	import Trophy from '@lucide/svelte/icons/trophy';
	import ChartBar from '@lucide/svelte/icons/bar-chart';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Trash from '@lucide/svelte/icons/trash';
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
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
	const requiredLosers: Record<string, number> = {
		round_1: 32, round_2: 16, round_3: 8, round_4: 4, semifinal: 2, final: 1
	};

	// ── Record tab ────────────────────────────────────────────────────────────
	let activeTab = $state<'record' | 'corrections'>('record');
	let selectedRound = $state<string>('round_1');
	// Track which rounds are locally known to be complete (survives invalidateAll)
	let completedRounds = $state<Set<string>>(new Set());

	let activeTeams = $derived(data.teams.filter((t) => isTeamAlive(t)));
	let roundResultTeamIds = $derived(new Set(data.results.filter((r) => r.tournament_round === selectedRound).map((r) => r.team)));
	let eligibleTeams = $derived(activeTeams.filter((t) => !roundResultTeamIds.has(t.id)));

	function isRoundComplete(round: string): boolean {
		return completedRounds.has(round) ||
			data.results.filter((r) => r.tournament_round === round).length >= requiredLosers[round] * 2;
	}
	function nextRound(round: string): string | null {
		const idx = roundOrder.indexOf(round);
		return idx >= 0 && idx < roundOrder.length - 1 ? roundOrder[idx + 1] : null;
	}

	// Explicit round change — resets selections
	function changeRound(round: string) {
		selectedRound = round;
		selectedLosers = new Set();
		submitSuccess = null;
		submitError = null;
	}

	let selectedLosers = $state<Set<string>>(new Set());
	let submitReady = $derived(selectedLosers.size === requiredLosers[selectedRound]);
	let submitting = $state(false);
	let submitProgress = $state(0);
	let submitSuccess = $state<string | null>(null);
	let submitError = $state<string | null>(null);
	let progressInterval: ReturnType<typeof setInterval> | null = null;

	function startProgress(total: number) {
		submitting = true; submitProgress = 5; submitSuccess = null; submitError = null;
		if (progressInterval) clearInterval(progressInterval);
		const stepMs = Math.max(40, Math.round(5000 / total));
		progressInterval = setInterval(() => {
			submitProgress = Math.min(submitProgress + (75 / total), 80);
			if (submitProgress >= 80 && progressInterval) { clearInterval(progressInterval); progressInterval = null; }
		}, stepMs);
	}

	async function handleSubmit() {
		if (!submitReady || submitting) return;
		// Snapshot all reactive state synchronously before any async work
		const round = selectedRound;
		const losers = [...selectedLosers];
		const alive = activeTeams.map((t) => t.id);

		startProgress(requiredLosers[round] * 2);

		const fd = new FormData();
		fd.set('tournament_round', round);
		fd.set('loser_ids', losers.join(','));
		fd.set('alive_team_ids', alive.join(','));

		try {
			const res = await fetch('?/bulkRecord', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
			const json = await res.json();
			const payload = json?.data ?? json;

			if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
			submitProgress = 100;

			if (json?.type === 'success' && payload?.bulkSuccess) {
				// Mark round complete locally immediately (before invalidateAll)
				completedRounds = new Set([...completedRounds, round]);
				// Reload data in background
				await invalidateAll();
				submitSuccess = payload.bulkSuccess;
				submitting = false;
				submitProgress = 0;
				// Advance to next round
				const next = nextRound(round);
				if (next) {
					selectedRound = next;
					selectedLosers = new Set();
				}
			} else {
				submitting = false;
				submitProgress = 0;
				submitError = payload?.bulkError ?? 'Failed to record results';
			}
		} catch (e) {
			if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
			submitting = false;
			submitProgress = 0;
			submitError = e instanceof Error ? e.message : 'Request failed';
		}
	}

	function toggleLoser(id: string) {
		const next = new Set(selectedLosers);
		if (next.has(id)) next.delete(id); else next.add(id);
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

	// ── Corrections tab ───────────────────────────────────────────────────────
	let correctionRound = $state<string>('round_1');
	let correctionResults = $derived(
		data.results
			.filter((r) => r.tournament_round === correctionRound)
			.sort((a, b) => (data.teams.find((t) => t.id === a.team)?.seed ?? 99) - (data.teams.find((t) => t.id === b.team)?.seed ?? 99))
	);

	// Modal
	let modalOpen = $state(false);
	let mistakeResult = $state<(typeof data.results)[0] | null>(null);
	let replacementResult = $state<(typeof data.results)[0] | null>(null);
	let swapping = $state(false);
	let swapMessage = $state<string | null>(null);
	let swapError = $state<string | null>(null);

	// Show only teams with the opposite result — if mistake was advanced (✅), show eliminated (❌) and vice versa
	let modalResults = $derived(
		mistakeResult
			? correctionResults.filter((r) => r.id !== mistakeResult!.id && r.won !== mistakeResult!.won)
			: []
	);

	function openModal(result: (typeof data.results)[0]) {
		mistakeResult = result; replacementResult = null; swapMessage = null; swapError = null; modalOpen = true;
	}
	function closeModal() { modalOpen = false; mistakeResult = null; replacementResult = null; }
	$effect(() => { correctionRound; closeModal(); });

	async function submitSwap() {
		if (!mistakeResult || !replacementResult || swapping) return;
		swapping = true; swapMessage = null; swapError = null;
		const fd = new FormData();
		fd.set('mistake_result_id', mistakeResult.id);
		fd.set('replacement_result_id', replacementResult.id);
		try {
			const res = await fetch('?/swapPair', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
			const json = await res.json();
			const payload = json?.data ?? json;
			if (json?.type === 'success') {
				swapMessage = 'Swap applied successfully.';
				await invalidateAll();
				setTimeout(closeModal, 1200);
			} else {
				swapError = payload?.swapError ?? 'Swap failed — please try again';
			}
		} catch (e) {
			swapError = e instanceof Error ? e.message : 'Request failed';
		} finally {
			swapping = false;
		}
	}
</script>

<svelte:head><title>Admin — Scores</title></svelte:head>

<!-- ── Swap Modal ─────────────────────────────────────────────────────────── -->
{#if modalOpen && mistakeResult}
	{@const mistakeTeam = data.teams.find((t) => t.id === mistakeResult!.team)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onclick={closeModal}></div>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div class="w-full max-w-lg rounded-xl border bg-card shadow-2xl flex flex-col max-h-[90vh]">

			<!-- Header -->
			<div class="flex items-start justify-between border-b px-5 py-4 shrink-0">
				<div>
					<h2 class="font-bold text-base text-primary flex items-center gap-2">
						<ArrowLeftRight class="h-4 w-4" /> Correct a Result
					</h2>
					<p class="text-xs text-muted-foreground mt-1">
						Correcting: <span class="font-semibold text-foreground">{mistakeTeam?.name ?? '?'}</span>
						(#{mistakeTeam?.seed}, {mistakeTeam?.region}) — currently marked
						<span class="{mistakeResult!.won ? 'text-accent' : 'text-destructive'} font-medium">
							{mistakeResult!.won ? '✅ advanced' : '❌ eliminated'}
						</span>
					</p>
					<p class="text-xs text-muted-foreground mt-0.5">
						Select the {mistakeResult!.won ? 'eliminated ❌' : 'advancing ✅'} team that should swap with them:
					</p>
				</div>
				<button onclick={closeModal} class="text-muted-foreground hover:text-foreground ml-4 shrink-0 text-lg leading-none">✕</button>
			</div>

			<!-- Results list -->
			<div class="overflow-y-auto flex-1 px-5 py-4 space-y-4">
				{#if modalResults.length === 0}
					<p class="text-sm text-muted-foreground text-center py-4">
						No {mistakeResult!.won ? 'eliminated' : 'advancing'} teams recorded for this round.
					</p>
				{/if}
				{#each REGIONS as region}
					{@const regionResults = modalResults.filter((r) => data.teams.find((t) => t.id === r.team)?.region === region)}
					{#if regionResults.length > 0}
						<div class="space-y-0.5">
							<p class="text-xs font-bold uppercase tracking-widest text-primary border-b border-primary/20 pb-0.5 mb-1">{region}</p>
							{#each regionResults as result}
								{@const team = data.teams.find((t) => t.id === result.team)}
								{@const selected = replacementResult?.id === result.id}
								<button
									type="button"
									onclick={() => (replacementResult = selected ? null : result)}
									class="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-left transition-all
										{selected
											? 'ring-2 ring-primary bg-primary/10 font-semibold'
											: result.won
												? 'bg-accent/10 hover:bg-accent/20'
												: 'bg-destructive/10 text-destructive hover:bg-destructive/20'}"
								>
									{#if result.won}
										<CircleCheck class="h-3.5 w-3.5 shrink-0 text-accent" />
									{:else}
										<CircleX class="h-3.5 w-3.5 shrink-0 text-destructive" />
									{/if}
									<span class="w-5 text-right font-mono text-muted-foreground shrink-0">#{team?.seed}</span>
									<span class="flex-1 truncate font-medium">{team?.name ?? '?'}</span>
									<span class="shrink-0 text-muted-foreground/70 text-xs">{result.won ? 'advanced ✅' : 'eliminated ❌'}</span>
									{#if selected}<span class="shrink-0 text-primary font-bold text-xs ml-1">← swap</span>{/if}
								</button>
							{/each}
						</div>
					{/if}
				{/each}
			</div>

			<!-- Footer -->
			<div class="border-t px-5 py-4 space-y-3 shrink-0">
				{#if replacementResult}
					{@const replaceTeam = data.teams.find((t) => t.id === replacementResult!.team)}
					<div class="rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-1">
						<p class="font-semibold">Confirm swap:</p>
						<p class="text-muted-foreground">
							<span class="text-foreground font-medium">{mistakeTeam?.name}</span>
							→ {mistakeResult!.won ? '❌ eliminated' : '✅ advances'}
							&nbsp;&nbsp;
							<span class="text-foreground font-medium">{replaceTeam?.name}</span>
							→ {replacementResult!.won ? '❌ eliminated' : '✅ advances'}
						</p>
					</div>
				{/if}
				{#if swapMessage}
					<p class="text-sm text-accent flex items-center gap-1.5"><CircleCheck class="h-4 w-4" />{swapMessage}</p>
				{/if}
				{#if swapError}
					<p class="text-sm text-destructive">{swapError}</p>
				{/if}
				<div class="flex gap-2">
					<Button onclick={submitSwap} disabled={!replacementResult || swapping} class="flex-1">
						{swapping ? 'Applying…' : 'Apply Swap'}
					</Button>
					<Button onclick={closeModal} variant="outline">Cancel</Button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- ── Page ───────────────────────────────────────────────────────────────── -->
<div class="space-y-8">
	<h1 class="flex items-center gap-3 text-3xl font-bold text-primary">
		<ChartBar class="h-7 w-7" /> Tournament Scoring
	</h1>

	<div class="grid gap-6 xl:grid-cols-[1fr_380px]">

		<!-- Left -->
		<div class="space-y-6">
			<Card.Card class="border-primary/30">
				<Card.CardHeader class="pb-3">
					<div class="flex gap-1 rounded-lg bg-muted p-1 w-fit">
						<button type="button" onclick={() => (activeTab = 'record')}
							class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
								{activeTab === 'record' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}">
							Record Results
						</button>
						<button type="button" onclick={() => (activeTab = 'corrections')}
							class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
								{activeTab === 'corrections' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}">
							Corrections
						</button>
					</div>
					<Card.CardDescription class="mt-2">
						{#if activeTab === 'record'}
							Check the <strong>eliminated</strong> teams for the round, then submit. Winners are recorded automatically.
						{:else}
							Click any team result to open the swap modal and correct a mistake.
						{/if}
					</Card.CardDescription>
				</Card.CardHeader>

				<Card.CardContent class="space-y-4">

					{#if activeTab === 'corrections'}
						<!-- Round selector -->
						<div class="flex flex-wrap gap-2">
							{#each TOURNAMENT_ROUNDS as round}
								{@const hasAny = data.results.some((r) => r.tournament_round === round)}
								<button type="button" onclick={() => (correctionRound = round)} disabled={!hasAny}
									class="rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-30
										{correctionRound === round ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}">
									{roundLabels[round]}
								</button>
							{/each}
						</div>
						<Separator />
						{#if correctionResults.length === 0}
							<p class="text-sm text-muted-foreground text-center py-4">No results recorded for this round yet.</p>
						{:else}
							<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
								{#each REGIONS as region}
									{@const regionResults = correctionResults.filter((r) => data.teams.find((t) => t.id === r.team)?.region === region)}
									{#if regionResults.length > 0}
										<div class="space-y-0.5">
											<p class="text-xs font-bold uppercase tracking-widest text-primary border-b border-primary/20 pb-1 mb-1">{region}</p>
											{#each regionResults as result}
												{@const team = data.teams.find((t) => t.id === result.team)}
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div onclick={() => openModal(result)}
													class="flex items-center gap-1.5 rounded px-1.5 py-1.5 text-xs cursor-pointer transition-all group
														{result.won ? 'bg-accent/10 hover:bg-accent/20' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'}"
													title="Click to correct">
													{#if result.won}
														<CircleCheck class="h-3 w-3 shrink-0 text-accent" />
													{:else}
														<CircleX class="h-3 w-3 shrink-0" />
													{/if}
													<span class="w-4 text-right font-mono text-muted-foreground shrink-0">{team?.seed}</span>
													<span class="flex-1 truncate font-medium">{team?.name ?? '?'}</span>
													<ArrowLeftRight class="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
												</div>
											{/each}
										</div>
									{/if}
								{/each}
							</div>
							<p class="text-xs text-muted-foreground text-center pt-1">Click any team to open the swap modal.</p>
						{/if}

					{:else}
						<!-- Round tabs -->
						<div class="flex flex-wrap gap-2">
							{#each TOURNAMENT_ROUNDS as round}
								{@const complete = isRoundComplete(round)}
								{@const hasAny = data.results.some((r) => r.tournament_round === round)}
								<button type="button" onclick={() => changeRound(round)}
									class="rounded-full px-3 py-1 text-xs font-medium transition-colors
										{selectedRound === round ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}
										{complete ? 'ring-1 ring-accent/50' : hasAny ? 'ring-1 ring-orange-400/60' : ''}">
									{roundLabels[round]}
									{#if complete}<span class="ml-1">✅</span>{:else if hasAny}<span class="ml-1 opacity-60">⏳</span>{/if}
								</button>
							{/each}
						</div>

						{#if eligibleTeams.length === 0}
							<p class="text-sm text-accent text-center py-3 flex items-center justify-center gap-1.5">
								<CircleCheck class="h-4 w-4" /> All results recorded. Use Corrections tab to fix any mistakes.
							</p>
						{:else}
							<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
								{#each REGIONS as region}
									{@const regionTeams = eligibleTeams.filter((t) => t.region === region)}
									{#if regionTeams.length > 0}
										<div class="space-y-1">
											<div class="flex items-center justify-between mb-2">
												<p class="text-xs font-bold uppercase tracking-widest text-primary border-b border-primary/20 pb-1 flex-1">{region}</p>
												<div class="flex gap-1 ml-2 shrink-0">
													<button type="button" onclick={() => selectAllInRegion(region)} class="text-xs text-muted-foreground hover:text-foreground px-1">all</button>
													<button type="button" onclick={() => clearRegion(region)} class="text-xs text-muted-foreground hover:text-foreground px-1">none</button>
												</div>
											</div>
											{#each regionTeams as team}
												{@const isLoser = selectedLosers.has(team.id)}
												<button type="button" onclick={() => toggleLoser(team.id)}
													class="flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors
														{isLoser ? 'bg-destructive/20 text-destructive ring-1 ring-destructive/40' : 'bg-muted/50 hover:bg-muted'}">
													{#if isLoser}
														<CircleX class="h-3 w-3 shrink-0 text-destructive" />
													{:else}
														<CircleCheck class="h-3 w-3 shrink-0 text-muted-foreground/40" />
													{/if}
													<span class="w-4 text-right font-mono text-muted-foreground shrink-0">{team.seed}</span>
													<span class="flex-1 truncate text-left font-medium">{team.name}</span>
												</button>
											{/each}
										</div>
									{/if}
								{/each}
							</div>
						{/if}

						<div class="space-y-2 pt-2">
							<Button onclick={handleSubmit} disabled={!submitReady || submitting} class="w-full">
								{#if submitting}Recording…{:else}
									Record {roundLabels[selectedRound]} Results
									{#if selectedLosers.size > 0}({selectedLosers.size} eliminated, {eligibleTeams.length - selectedLosers.size} advance){/if}
								{/if}
							</Button>
							{#if submitting}
								<div class="space-y-1">
									<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
										<div class="h-full rounded-full bg-primary transition-all duration-200" style="width: {submitProgress}%"></div>
									</div>
									<p class="text-xs text-center text-muted-foreground">Saving… ({Math.round(submitProgress)}%)</p>
								</div>
							{:else if !submitReady && eligibleTeams.length > 0}
								<p class="text-xs text-center text-muted-foreground">
									Select exactly {requiredLosers[selectedRound]} eliminated teams
									({selectedLosers.size} / {requiredLosers[selectedRound]})
								</p>
							{/if}
							{#if submitSuccess}
								<p class="flex items-center gap-1.5 text-sm text-accent"><CircleCheck class="h-4 w-4" /> Results recorded — {submitSuccess}</p>
							{/if}
							{#if submitError}
								<p class="text-sm text-destructive">{submitError}</p>
							{/if}
						</div>
					{/if}

				</Card.CardContent>
			</Card.Card>

			<!-- Results log -->
			<Card.Card>
				<Card.CardHeader class="pb-2">
					<Card.CardTitle class="flex items-center gap-2 text-base">
						<ChartBar class="h-4 w-4" /> Results Log
					</Card.CardTitle>
				</Card.CardHeader>
				<Card.CardContent>
					{#if data.results.length === 0}
						<p class="text-sm text-muted-foreground py-4 text-center">No results recorded yet.</p>
					{:else}
						<div class="space-y-1 max-h-64 overflow-y-auto">
							{#each [...data.results].reverse() as result}
								{@const team = data.teams.find((t) => t.id === result.team)}
								<div class="flex items-center gap-2 rounded px-2 py-1.5 text-xs {result.won ? 'bg-accent/5' : 'bg-destructive/5'}">
									{#if result.won}
										<CircleCheck class="h-3.5 w-3.5 shrink-0 text-accent" />
									{:else}
										<CircleX class="h-3.5 w-3.5 shrink-0 text-destructive" />
									{/if}
									<span class="flex-1 font-medium truncate">{team?.name ?? result.team}</span>
									<span class="text-muted-foreground shrink-0">{roundLabels[result.tournament_round]}</span>
									<form method="POST" action="?/deleteResult" use:enhance>
										<input type="hidden" name="result_id" value={result.id} />
										<button type="submit" class="text-muted-foreground/30 hover:text-destructive" title="Delete">
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
				<Card.CardHeader class="pb-2">
					<div class="flex items-center justify-between">
						<Card.CardTitle class="flex items-center gap-2">
							<Trophy class="h-4 w-4" /> Leaderboard
						</Card.CardTitle>
						<a href="/leaderboard" target="_blank" class="text-xs text-muted-foreground hover:text-primary underline">Public view ↗</a>
					</div>
				</Card.CardHeader>
				<Card.CardContent>
					<LeaderboardComponent entries={data.leaderboard} showBreakdown={true} />
				</Card.CardContent>
			</Card.Card>
		</div>

	</div>
</div>
