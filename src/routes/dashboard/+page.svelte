<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { getUserJoinRequest, getApprovedParticipants } from '$lib/types';
	import Users from '@lucide/svelte/icons/users';
	import Trophy from '@lucide/svelte/icons/trophy';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Clock from '@lucide/svelte/icons/clock';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import Zap from '@lucide/svelte/icons/zap';
	import LeaderboardComponent from '$lib/components/Leaderboard.svelte';

	let { data } = $props();

	const roundLabels: Record<string, string> = {
		round_1: 'Rd of 64', round_2: 'Rd of 32', round_3: 'Sweet 16',
		round_4: 'Elite 8', semifinal: 'Final Four', final: 'Championship'
	};

	const myApprovedRequest = $derived(
		data.myRequests.find((r) => r.status === 'approved') ?? null
	);

	let myRank = $derived(
		data.leaderboard.findIndex((e) => e.poolTeam.id === myApprovedRequest?.pool_team) + 1
	);
</script>

<svelte:head><title>Dashboard — NCAA Pool 2026</title></svelte:head>

<div class="space-y-8">

	<!-- Pool Status Banner -->
	{#if data.draftReady}
		<div class="rounded-lg border border-accent/40 bg-accent/10 px-5 py-4 flex items-center gap-3">
			<div>
				<p class="font-bold text-accent">Pool is Draft-Ready!</p>
				<p class="text-sm text-muted-foreground">All 10 teams have at least one approved participant. The admin can start the draft.</p>
			</div>
		</div>
	{:else}
		<div class="rounded-lg border bg-muted/40 px-5 py-4">
			<p class="font-semibold text-foreground">Waiting for pool to fill</p>
			<p class="text-sm text-muted-foreground mt-0.5">
				{data.poolTeams.filter((t) => getApprovedParticipants(t.id, data.allRequests).length > 0).length}
				/ {data.poolTeams.length} teams have an approved participant.
				Draft begins once all teams are filled.
			</p>
		</div>
	{/if}

	<!-- Pool Teams -->
	<Card.Card>
		<Card.CardHeader>
			<Card.CardTitle class="flex items-center gap-2 text-xl font-bold text-primary">
				<Users class="h-5 w-5" /> Pool Teams
			</Card.CardTitle>
			<p class="text-sm text-muted-foreground">
				{#if myApprovedRequest}
					You are approved on <strong>{myApprovedRequest.expand?.pool_team?.name ?? 'a team'}</strong>.
				{:else}
					Request to join a team. The admin will approve your spot.
				{/if}
			</p>
		</Card.CardHeader>
		<Card.CardContent>
			{#if data.poolTeams.length === 0}
				<p class="text-sm text-muted-foreground py-4 text-center">No teams set up yet.</p>
			{:else}
				<div class="overflow-hidden rounded-lg border">
					{#each data.poolTeams as team, i}
						{@const approved = getApprovedParticipants(team.id, data.allRequests)}
						{@const myReq = getUserJoinRequest(data.user?.id ?? '', team.id, data.allRequests)}
						{@const isFull = approved.length >= team.slot_count}
						{@const isMyTeam = myApprovedRequest?.pool_team === team.id}

						<div class="flex items-center gap-3 px-4 py-3
							{isMyTeam ? 'border-l-4 border-accent bg-accent/5' : i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
							<div class="shrink-0">
								{#if isMyTeam}
									<UserCheck class="h-4 w-4 text-accent" />
								{:else if approved.length >= team.slot_count}
									<CircleCheck class="h-4 w-4 text-accent/50" />
								{:else if myReq?.status === 'pending'}
									<Clock class="h-4 w-4 text-orange-400" />
								{:else if myReq?.status === 'rejected'}
									<CircleX class="h-4 w-4 text-destructive" />
								{:else}
									<CircleX class="h-4 w-4 text-muted-foreground/30" />
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<p class="font-semibold truncate text-sm">{team.name}</p>
								<p class="text-xs text-muted-foreground mt-0.5">
									{approved.length}/{team.slot_count} filled
									{#if approved.length > 0}· {approved.map((r) => r.expand?.user?.name ?? '?').join(', ')}{/if}
								</p>
							</div>
							<div class="shrink-0">
								{#if isMyTeam}
									<span class="inline-flex items-center gap-1 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
										<Zap class="h-3 w-3" /> Your Team
									</span>
								{:else if myReq?.status === 'pending'}
									<div class="flex items-center gap-2">
										<span class="text-xs text-muted-foreground">Pending…</span>
										<form method="POST" action="?/withdrawRequest" use:enhance>
											<input type="hidden" name="request_id" value={myReq.id} />
											<button type="submit" class="text-xs text-destructive hover:underline">Withdraw</button>
										</form>
									</div>
								{:else if myReq?.status === 'rejected'}
									<span class="text-xs text-destructive font-medium">Rejected</span>
								{:else if myApprovedRequest}
									<span class="text-xs text-muted-foreground">—</span>
								{:else if isFull}
									<span class="text-xs text-muted-foreground">Full</span>
								{:else}
									<form method="POST" action="?/joinTeam" use:enhance>
										<input type="hidden" name="team_id" value={team.id} />
										<Button type="submit" size="sm" variant="outline">Request to Join</Button>
									</form>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card.CardContent>
	</Card.Card>

	<!-- Post-Draft content -->
	{#if data.myTeams.length > 0 || data.leaderboard.length > 0}
		<Separator />
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
					<p class="mt-1 text-4xl font-extrabold text-accent">{myRank > 0 ? `#${myRank}` : '—'}</p>
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
			<Card.Card>
				<Card.CardHeader>
					<Card.CardTitle class="flex items-center gap-2 text-xl font-bold text-primary">
						<Trophy class="h-5 w-5" /> My Roster
					</Card.CardTitle>
				</Card.CardHeader>
				<Card.CardContent class="p-0">
					<div class="overflow-hidden rounded-b-lg">
						{#each data.myTeams as entry, i}
							<div class="flex items-center gap-3 px-4 py-3 {entry.eliminated ? 'opacity-50' : ''} {i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
									{entry.team?.seed ?? '?'}
								</div>
								<div class="flex-1 min-w-0">
									<p class="font-medium truncate {entry.eliminated ? 'line-through' : ''}">{entry.team?.name ?? 'Unknown'}</p>
									<p class="text-xs text-muted-foreground">
										Round {entry.pick.draft_round}, Pick #{entry.pick.pick_number} · {entry.team?.region ?? ''} · {entry.wins} win{entry.wins !== 1 ? 's' : ''}
									</p>
								</div>
								<div class="text-right shrink-0">
									<p class="font-bold text-primary">{entry.points}</p>
									<p class="text-xs text-muted-foreground">pts</p>
								</div>
								{#if entry.eliminated}
									<span class="text-xs font-medium text-destructive shrink-0">OUT</span>
								{/if}
							</div>
						{/each}
					</div>
				</Card.CardContent>
			</Card.Card>

			<Card.Card>
				<Card.CardHeader>
					<div class="flex items-center justify-between">
						<Card.CardTitle class="flex items-center gap-2 text-xl font-bold text-primary">
							<Trophy class="h-5 w-5" /> Leaderboard
						</Card.CardTitle>
						<a href="/leaderboard" class="text-xs text-muted-foreground hover:text-primary underline">
							Full standings ↗
						</a>
					</div>
				</Card.CardHeader>
				<Card.CardContent>
					<LeaderboardComponent
						entries={data.leaderboard}
						highlightTeamId={myApprovedRequest?.pool_team ?? ''}
						showBreakdown={true}
					/>
				</Card.CardContent>
			</Card.Card>
		</div>
	{/if}
</div>
