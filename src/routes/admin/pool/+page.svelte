<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Users from '@lucide/svelte/icons/users';

	let { data, form } = $props();

	const pending = $derived(data.joinRequests.filter((r) => r.status === 'pending'));
	const resolved = $derived(data.joinRequests.filter((r) => r.status !== 'pending'));
</script>

<svelte:head><title>Admin — Pool</title></svelte:head>

<div class="mx-auto max-w-xl space-y-6">
	<div>
		<h1 class="flex items-center gap-3 text-3xl font-bold text-primary">
			<Users class="h-7 w-7" /> Pool Admin
		</h1>
		<p class="mt-2 text-sm text-muted-foreground max-w-xl">
			Manage participant access to the pool. When someone requests to join a team, their request
			appears here as pending. Approve to grant them access to the draft and scoring pages;
			reject to deny entry. All approved members appear in the leaderboard under their team name.
		</p>
	</div>

	<Card.Card>
		<Card.CardHeader>
			<Card.CardTitle class="flex items-center gap-2 text-lg font-bold text-primary">
				<UserPlus class="h-4 w-4" /> Join Requests
			</Card.CardTitle>
			<p class="text-sm text-muted-foreground">{pending.length} pending</p>
		</Card.CardHeader>
		<Card.CardContent>
			{#if pending.length === 0}
				<p class="py-4 text-center text-sm text-muted-foreground">No pending requests.</p>
			{:else}
				<div class="space-y-2">
					{#each pending as req}
						<div class="flex items-center gap-3 rounded-lg border p-3">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">{req.expand?.user?.name ?? req.user}</p>
								<p class="text-xs text-muted-foreground">→ {req.expand?.pool_team?.name ?? req.pool_team}</p>
							</div>
							<div class="flex shrink-0 gap-2">
								<form method="POST" action="?/approveRequest" use:enhance>
									<input type="hidden" name="request_id" value={req.id} />
									<Button type="submit" size="sm" class="h-7 px-3 text-xs">Approve</Button>
								</form>
								<form method="POST" action="?/rejectRequest" use:enhance>
									<input type="hidden" name="request_id" value={req.id} />
									<Button type="submit" size="sm" variant="destructive" class="h-7 px-3 text-xs">Reject</Button>
								</form>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if resolved.length > 0}
				<Separator class="my-3" />
				<p class="mb-2 text-xs font-semibold text-muted-foreground">Resolved</p>
				<div class="overflow-hidden rounded-lg border">
					{#each resolved as req, i}
						<div class="flex items-center gap-2 px-3 py-2 text-xs {i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
							{#if req.status === 'approved'}
								<CircleCheck class="h-3.5 w-3.5 shrink-0 text-accent" />
							{:else}
								<CircleX class="h-3.5 w-3.5 shrink-0 text-destructive" />
							{/if}
							<span class="font-medium">{req.expand?.user?.name ?? req.user}</span>
							<span class="text-muted-foreground">→ {req.expand?.pool_team?.name ?? req.pool_team}</span>
						</div>
					{/each}
				</div>
			{/if}
		</Card.CardContent>
	</Card.Card>
</div>
