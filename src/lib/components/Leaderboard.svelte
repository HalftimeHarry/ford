<script lang="ts">
	import type { LeaderboardEntry } from '$lib/pocketbase';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';

	interface Props {
		entries: LeaderboardEntry[];
		/** Highlight this pool team id */
		highlightTeamId?: string;
		/** Show score breakdown rows (expandable per entry) */
		showBreakdown?: boolean;
		/** Limit visible rows; 0 = show all */
		limit?: number;
		/** Compact mode: smaller padding, no breakdown */
		compact?: boolean;
	}

	let {
		entries,
		highlightTeamId = '',
		showBreakdown = false,
		limit = 0,
		compact = false
	}: Props = $props();

	const roundLabels: Record<string, string> = {
		round_1: 'Rd of 64',
		round_2: 'Rd of 32',
		round_3: 'Sweet 16',
		round_4: 'Elite 8',
		semifinal: 'Final Four',
		final: 'Championship'
	};

	const medals = ['🥇', '🥈', '🥉'];

	let expanded = $state<Set<string>>(new Set());

	function toggle(teamId: string) {
		const next = new Set(expanded);
		if (next.has(teamId)) next.delete(teamId);
		else next.add(teamId);
		expanded = next;
	}

	let visible = $derived(limit > 0 ? entries.slice(0, limit) : entries);
	let hasMore = $derived(limit > 0 && entries.length > limit);
</script>

{#if entries.length === 0}
	<p class="py-6 text-center text-sm text-muted-foreground">
		No scores yet — check back once the tournament begins.
	</p>
{:else}
	<div class="overflow-hidden rounded-lg border">
		<table class="w-full text-sm">
			<thead>
				<tr class="bg-primary text-primary-foreground">
					<th class="{compact ? 'px-3 py-2' : 'px-4 py-2.5'} w-10 text-center font-semibold">#</th>
					<th class="{compact ? 'px-3 py-2' : 'px-4 py-2.5'} text-left font-semibold">Team</th>
					<th class="{compact ? 'px-3 py-2' : 'px-4 py-2.5'} text-right font-semibold">Pts</th>
					{#if showBreakdown}
						<th class="w-8"></th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each visible as entry, i}
					{@const isHighlighted = entry.poolTeam.id === highlightTeamId}
					{@const isFirst = i === 0}
					<tr
						class="border-b transition-colors
							{isHighlighted
								? 'bg-primary/10 font-semibold'
								: isFirst
									? 'bg-accent/10'
									: i % 2 === 0
										? 'bg-card'
										: 'bg-muted/50'}
							{showBreakdown && entry.breakdown.length > 0 ? 'cursor-pointer hover:bg-muted/70' : ''}"
						onclick={() => showBreakdown && entry.breakdown.length > 0 && toggle(entry.poolTeam.id)}
					>
						<td class="{compact ? 'px-3 py-1.5' : 'px-4 py-2.5'} text-center">
							{#if i < 3}
								<span class="text-base leading-none">{medals[i]}</span>
							{:else}
								<span class="text-muted-foreground">{i + 1}</span>
							{/if}
						</td>
						<td class="{compact ? 'px-3 py-1.5' : 'px-4 py-2.5'}">
							{entry.poolTeam.name}
						</td>
						<td class="{compact ? 'px-3 py-1.5' : 'px-4 py-2.5'} text-right font-bold
							{isFirst ? 'text-accent' : ''}">
							{entry.total}
						</td>
						{#if showBreakdown}
							<td class="pr-2 text-center text-muted-foreground">
								{#if entry.breakdown.length > 0}
									{#if expanded.has(entry.poolTeam.id)}
										<ChevronUp class="inline h-3.5 w-3.5" />
									{:else}
										<ChevronDown class="inline h-3.5 w-3.5" />
									{/if}
								{/if}
							</td>
						{/if}
					</tr>
					{#if showBreakdown && expanded.has(entry.poolTeam.id)}
						{#each entry.breakdown as b, bi}
							<tr class="border-b text-xs {bi % 2 === 0 ? 'bg-muted/30' : 'bg-muted/10'}">
								<td></td>
								<td class="px-4 py-1.5 pl-8 text-muted-foreground">
									<span class="font-medium text-foreground">({b.seed}) {b.team}</span>
									<span class="ml-2">{roundLabels[b.round] ?? b.round}</span>
								</td>
								<td class="px-4 py-1.5 text-right font-medium text-accent">+{b.points}</td>
								<td></td>
							</tr>
						{/each}
					{/if}
				{/each}
			</tbody>
		</table>
		{#if hasMore}
			<div class="border-t bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
				Showing top {limit} of {entries.length} teams
			</div>
		{/if}
	</div>
{/if}
