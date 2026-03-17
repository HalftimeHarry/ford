<script lang="ts">
	import fordLogo from '$lib/assets/ford_logo.png';
	import * as Card from '$lib/components/ui/card';
	import Trophy from '@lucide/svelte/icons/trophy';
	import type { NcaaTeam } from '$lib/types';
	import { TOURNAMENT_ROUNDS } from '$lib/types';

	let { data } = $props();

	const roundLabels: Record<string, string> = {
		round_1: 'R64', round_2: 'R32', round_3: 'S16', round_4: 'E8', semifinal: 'FF', final: 'Champ'
	};
	const roundFull: Record<string, string> = {
		round_1: 'Round of 64', round_2: 'Round of 32', round_3: 'Sweet 16',
		round_4: 'Elite 8', semifinal: 'Final Four', final: 'Championship'
	};
	const regionColor: Record<string, string> = {
		East: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
		West: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
		South: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
		Midwest: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
	};
	const medals = ['🥇', '🥈', '🥉'];

	// teamId -> set of rounds won
	const wonTeamRounds = $derived.by(() => {
		const map: Record<string, Set<string>> = {};
		for (const r of data.results ?? []) {
			if (!r.won) continue;
			if (!map[r.team]) map[r.team] = new Set();
			map[r.team].add(r.tournament_round);
		}
		return map;
	});

	// set of eliminated team ids
	const eliminatedTeams = $derived.by(() => {
		const s = new Set<string>();
		for (const pick of data.picks ?? []) {
			const team = pick.expand?.team as NcaaTeam | undefined;
			if (team?.eliminated_round) s.add(team.id);
		}
		return s;
	});

	// ptId -> sorted picks with team data
	const poolTeamPicks = $derived.by(() => {
		const map: Record<string, { team: NcaaTeam; pick_number: number; draft_round: number }[]> = {};
		for (const pick of data.picks ?? []) {
			const ptId = (pick.pool_team as string) || pick.expand?.pool_team?.id;
			if (!ptId) continue;
			const team = pick.expand?.team as NcaaTeam | undefined;
			if (!team) continue;
			if (!map[ptId]) map[ptId] = [];
			map[ptId].push({ team, pick_number: pick.pick_number, draft_round: pick.draft_round });
		}
		for (const id of Object.keys(map)) map[id].sort((a, b) => a.pick_number - b.pick_number);
		return map;
	});

	function highestRound(teamId: string): string | null {
		const rounds = wonTeamRounds[teamId];
		if (!rounds || rounds.size === 0) return null;
		for (let i = TOURNAMENT_ROUNDS.length - 1; i >= 0; i--) {
			if (rounds.has(TOURNAMENT_ROUNDS[i])) return TOURNAMENT_ROUNDS[i];
		}
		return null;
	}

	function aliveCount(ptId: string): number {
		return (poolTeamPicks[ptId] ?? []).filter(p => !eliminatedTeams.has(p.team.id)).length;
	}

	// Pre-compute per-entry round breakdown for the table
	const breakdownByTeam = $derived.by(() => {
		return data.leaderboard.map(entry => {
			const byRound: Record<string, number> = {};
			for (const b of entry.breakdown) {
				byRound[b.round] = (byRound[b.round] ?? 0) + b.points;
			}
			return byRound;
		});
	});
</script>

<svelte:head>
	<title>Leaderboard — Ford's Pool 2026</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<header class="border-b bg-primary px-4 py-4 text-primary-foreground">
		<div class="mx-auto flex max-w-6xl items-center gap-3">
			<img src={fordLogo} alt="Ford's Pool" class="h-9 w-9 rounded-full bg-white object-contain p-0.5" />
			<div>
				<h1 class="text-xl font-bold leading-tight">Ford's Pool 2026</h1>
				<p class="text-xs opacity-75">NCAA Basketball · Live Standings</p>
			</div>
			<a href="/" class="ml-auto text-xs opacity-75 hover:opacity-100 underline">Sign in</a>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-4 py-8 space-y-6">
		<div class="flex items-center gap-2">
			<Trophy class="h-5 w-5 text-primary" />
			<h2 class="text-xl font-bold">Standings</h2>
			{#if data.leaderboard.length > 0}
				<span class="text-sm text-muted-foreground ml-2">· scores update as results are recorded</span>
			{/if}
		</div>

		{#if data.leaderboard.length === 0}
			<Card.Card>
				<Card.CardContent class="py-12 text-center text-muted-foreground">
					No scores yet — check back once the tournament begins.
				</Card.CardContent>
			</Card.Card>
		{:else}
			<!-- Pool team cards -->
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
				{#each data.leaderboard as entry, i}
					{@const ptId = entry.poolTeam.id}
					{@const picks = poolTeamPicks[ptId] ?? []}
					{@const alive = aliveCount(ptId)}
					<Card.Card class="flex flex-col {i === 0 ? 'ring-2 ring-primary' : ''}">
						<Card.CardHeader class="pb-2 pt-3 px-3">
							<div class="flex items-start justify-between gap-1">
								<div class="flex items-center gap-1.5 min-w-0">
									<span class="text-base leading-none shrink-0">
										{#if i < 3}{medals[i]}{:else}<span class="text-sm font-bold text-muted-foreground">{i + 1}</span>{/if}
									</span>
									<span class="text-sm font-bold leading-tight truncate">{entry.poolTeam.name}</span>
								</div>
								<span class="text-lg font-black tabular-nums text-primary shrink-0">{entry.total}</span>
							</div>
							<div class="flex items-center gap-2 mt-1">
								<span class="text-xs text-muted-foreground">{alive}/{picks.length} alive</span>
								{#if alive === picks.length && picks.length > 0}
									<span class="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded px-1.5 py-0.5 font-medium">All alive</span>
								{:else if alive === 0 && picks.length > 0}
									<span class="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded px-1.5 py-0.5 font-medium">All out</span>
								{/if}
							</div>
						</Card.CardHeader>
						<Card.CardContent class="px-3 pb-3 pt-0 flex-1">
							<div class="flex flex-col divide-y divide-border">
								{#each picks as { team }}
									{@const isElim = eliminatedTeams.has(team.id)}
									{@const adv = highestRound(team.id)}
									{@const rc = regionColor[team.region] ?? 'bg-muted text-muted-foreground'}
									<div class="py-1.5 flex items-center gap-1.5 {isElim ? 'opacity-40' : ''}">
										<span class="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground/70">#{team.seed}</span>
										<span class="flex-1 text-xs font-medium truncate {isElim ? 'line-through' : ''}">{team.name}</span>
										<span class="shrink-0 rounded px-1 py-0.5 text-xs leading-none {rc}">{team.region.slice(0,1)}</span>
										{#if adv}
											<span class="shrink-0 rounded px-1 py-0.5 text-xs font-bold leading-none bg-accent/20 text-accent" title={roundFull[adv]}>{roundLabels[adv]}</span>
										{/if}
										{#if isElim}
											<span class="shrink-0 text-xs text-destructive/60">✕</span>
										{/if}
									</div>
								{/each}
								{#if picks.length === 0}
									<p class="py-2 text-xs text-muted-foreground italic">No picks</p>
								{/if}
							</div>
						</Card.CardContent>
					</Card.Card>
				{/each}
			</div>

			<!-- Score breakdown table -->
			<div>
				<h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Score Breakdown by Round</h3>
				<div class="overflow-x-auto rounded-lg border">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-primary text-primary-foreground">
								<th class="px-4 py-2.5 w-10 text-center font-semibold">#</th>
								<th class="px-4 py-2.5 text-left font-semibold">Team</th>
								{#each TOURNAMENT_ROUNDS as round}
									<th class="px-2 py-2.5 text-center font-semibold text-xs" title={roundFull[round]}>{roundLabels[round]}</th>
								{/each}
								<th class="px-4 py-2.5 text-right font-semibold">Total</th>
							</tr>
						</thead>
						<tbody>
							{#each data.leaderboard as entry, i}
								{@const byRound = breakdownByTeam[i]}
								<tr class="border-b {i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}">
									<td class="px-4 py-2 text-center text-muted-foreground">{i + 1}</td>
									<td class="px-4 py-2 font-medium truncate max-w-[160px]">{entry.poolTeam.name}</td>
									{#each TOURNAMENT_ROUNDS as round}
										<td class="px-2 py-2 text-center tabular-nums text-xs {byRound[round] ? 'font-bold text-accent' : 'text-muted-foreground/40'}">
											{byRound[round] ?? '—'}
										</td>
									{/each}
									<td class="px-4 py-2 text-right font-black tabular-nums text-primary">{entry.total}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</main>

	<footer class="border-t bg-muted/50 py-4 text-center text-xs text-muted-foreground">
		Ford's Pool 2026 · Scores update as results are recorded
	</footer>
</div>
