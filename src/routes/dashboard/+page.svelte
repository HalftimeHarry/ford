<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { getUserJoinRequest, getApprovedParticipants } from '$lib/types';

	let { data } = $props();

	const roundLabels: Record<string, string> = {
		round_1: 'Rd of 64', round_2: 'Rd of 32', round_3: 'Sweet 16',
		round_4: 'Elite 8', semifinal: 'Final Four', final: 'Championship'
	};

	let myRank = $derived(
		data.leaderboard.findIndex((e) => e.user.id === data.user?.id) + 1
	);

	const myApprovedRequest = $derived(
		data.myRequests.find((r) => r.status === 'approved') ?? null
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
			<Card.CardTitle class="text-xl font-bold text-primary">Pool Teams</Card.CardTitle>
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
				<div class="space-y-3">
					{#each data.poolTeams as team}
						{@const approved = getApprovedParticipants(team.id, data.allRequests)}
						{@const myReq = getUserJoinRequest(data.user?.id ?? '', team.id, data.allRequests)}
						{@const isFull = approved.length >= team.slot_count}
						{@const isMyTeam = myApprovedRequest?.pool_team === team.id}

						<div class="flex items-center gap-4 rounded-lg border p-4 {isMyTeam ? 'border-accent/50 bg-accent/5' : ''}">
							<div class="flex-1 min-w-0">
								<p class="font-semibold truncate">{team.name}</p>
								<p class="text-xs text-muted-foreground mt-0.5">
									{approved.length} / {team.slot_count} spot{team.slot_count !== 1 ? 's' : ''} filled
									{#if approved.length > 0}
										· {approved.map((r) => r.expand?.user?.name ?? '?').join(', ')}
									{/if}
								</p>
							</div>
							<div class="shrink-0">
								{#if isMyTeam}
									<span class="inline-flex items-center rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">Your Team</span>
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
					<Card.CardTitle class="text-xl font-bold text-primary">My Roster</Card.CardTitle>
				</Card.CardHeader>
				<Card.CardContent>
					<div class="space-y-2">
						{#each data.myTeams as entry}
							<div class="flex items-center gap-3 rounded-lg border p-3 {entry.eliminated ? 'opacity-50' : ''}">
								<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
									{entry.team?.seed ?? '?'}
								</div>
								<div class="flex-1">
									<p class="font-medium {entry.eliminated ? 'line-through' : ''}">{entry.team?.name ?? 'Unknown'}</p>
									<p class="text-xs text-muted-foreground">{entry.team?.region ?? ''} · {entry.wins} win{entry.wins !== 1 ? 's' : ''}</p>
								</div>
								<div class="text-right">
									<p class="font-bold text-primary">{entry.points}</p>
									<p class="text-xs text-muted-foreground">pts</p>
								</div>
								{#if entry.eliminated}
									<span class="text-xs font-medium text-destructive">OUT {entry.eliminatedRound ? `(${roundLabels[entry.eliminatedRound] ?? entry.eliminatedRound})` : ''}</span>
								{/if}
							</div>
						{/each}
					</div>
				</Card.CardContent>
			</Card.Card>

			<Card.Card>
				<Card.CardHeader>
					<Card.CardTitle class="text-xl font-bold text-primary">Leaderboard</Card.CardTitle>
				</Card.CardHeader>
				<Card.CardContent>
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
									{@const isMe = entry.user.id === data.user?.id}
									<tr class="border-b {isMe ? 'bg-primary/10 font-bold' : i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
										<td class="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
										<td class="px-4 py-2.5">{entry.user.name}{#if isMe} <span class="text-xs text-primary">(you)</span>{/if}</td>
										<td class="px-4 py-2.5 text-right font-bold {i === 0 ? 'text-primary' : ''}">{entry.total}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Card.CardContent>
			</Card.Card>
		</div>
	{/if}
</div>
