<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { REGIONS, TIMER_PRESETS, getApprovedParticipants, getPendingRequests, isPoolDraftReady } from '$lib/types';
	import type { DraftSettings } from '$lib/types';
	import Users from '@lucide/svelte/icons/users';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Clock from '@lucide/svelte/icons/clock';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import Hash from '@lucide/svelte/icons/hash';
	import Zap from '@lucide/svelte/icons/zap';

	let { data, form } = $props();

	// Single pool — no tab switching needed
	let settings = $derived(data.draftSettings as DraftSettings | null);

	// All participants are in the pool
	let entryCount = $derived(data.participants.length);
	let totalPicks = $derived(entryCount * 6);

	let draftedTeamIds = $derived(new Set(data.picks.map((p) => p.team)));
	let availableTeams = $derived(data.teams.filter((t) => !draftedTeamIds.has(t.id)));
	let nextPickNumber = $derived(data.picks.length + 1);
	let draftComplete = $derived(data.picks.length >= totalPicks);

	let currentDraftRound = $derived(
		entryCount > 0 ? Math.min(Math.floor(data.picks.length / entryCount) + 1, 6) : 1
	);
	let currentRoundGroup = $derived(Math.ceil(currentDraftRound / 2));

	let currentGroupOrders = $derived(
		data.draftOrders.filter((o) => o.round_group === currentRoundGroup)
	);

	let picksInCurrentRound = $derived(entryCount > 0 ? data.picks.length % entryCount : 0);
	let isReverseRound = $derived(currentDraftRound % 2 === 0);

	let nextPicker = $derived.by(() => {
		if (currentGroupOrders.length === 0 || draftComplete) return null;
		const idx = isReverseRound ? entryCount - 1 - picksInCurrentRound : picksInCurrentRound;
		const order = currentGroupOrders.find((o) => o.position === idx + 1);
		if (!order) return null;
		return data.participants.find((p) => p.id === order.user) ?? null;
	});

	let selectedTeam = $state('');
	let teamSearch = $state('');

	let filteredTeams = $derived(() => {
		const q = teamSearch.toLowerCase().trim();
		if (!q) return data.teams;
		return data.teams.filter(
			(t) => t.name.toLowerCase().includes(q) || t.seed.toString() === q || t.region.toLowerCase().includes(q)
		);
	});

	// Drag-and-drop state
	let draggedTeamId = $state('');
	let dropHover = $state(false);

	function handleDragStart(e: DragEvent, teamId: string) {
		draggedTeamId = teamId;
		e.dataTransfer!.effectAllowed = 'move';
		e.dataTransfer!.setData('text/plain', teamId);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		dropHover = true;
	}

	function handleDragLeave() {
		dropHover = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dropHover = false;
		const teamId = e.dataTransfer!.getData('text/plain');
		if (teamId && !draftedTeamIds.has(teamId)) {
			selectedTeam = teamId;
			// Auto-submit the hidden form
			const form = document.getElementById('pick-form') as HTMLFormElement;
			if (form) form.requestSubmit();
		}
		draggedTeamId = '';
	}

	// --- Timer ---
	let timeRemaining = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	let isLive = $derived(settings?.status === 'in_progress');
	let hasTimer = $derived((settings?.timer_seconds ?? 0) > 0);

	function updateTimer() {
		if (!settings?.current_pick_deadline) {
			timeRemaining = 0;
			return;
		}
		const deadline = new Date(settings.current_pick_deadline).getTime();
		timeRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
	}

	onMount(() => {
		updateTimer();
		timerInterval = setInterval(updateTimer, 1000);
	});

	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
	});

	function formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	let timerExpired = $derived(
		isLive && hasTimer && timeRemaining === 0 && settings?.current_pick_deadline !== ''
	);

	// --- Timer radio state ---
	let selectedTimer = $state(600);

	$effect(() => {
		selectedTimer = settings?.timer_seconds ?? 600;
	});

	let isNotStarted = $derived(settings?.status === 'not_started');
	let isPaused = $derived(settings?.status === 'paused');
</script>

<svelte:head>
	<title>Admin - Draft Board</title>
</svelte:head>

<div class="space-y-6">

	<!-- Pool Teams & Join Requests -->
	<div class="grid gap-6 lg:grid-cols-2">

		<!-- Team Roster Management -->
		<Card.Card>
			<Card.CardHeader>
				<Card.CardTitle class="flex items-center gap-2 text-lg font-bold text-primary">
					<Users class="h-4 w-4" /> Pool Teams
				</Card.CardTitle>
				<p class="text-sm text-muted-foreground">
					{#if isPoolDraftReady(data.poolTeams ?? [], data.joinRequests ?? [])}
						<span class="font-semibold text-accent">All teams filled — pool is draft-ready.</span>
					{:else}
						{(data.poolTeams ?? []).filter((t) => getApprovedParticipants(t.id, data.joinRequests ?? []).length > 0).length}
						/ {(data.poolTeams ?? []).length} teams have an approved participant.
					{/if}
				</p>
			</Card.CardHeader>
			<Card.CardContent class="space-y-3">
				<div class="overflow-hidden rounded-lg border">
					{#each (data.poolTeams ?? []) as team, i}
						{@const approved = getApprovedParticipants(team.id, data.joinRequests ?? [])}
						{@const pending = getPendingRequests(team.id, data.joinRequests ?? [])}
						<div class="flex items-start gap-3 px-3 py-2.5 {i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
							<div class="mt-0.5 shrink-0">
								{#if approved.length >= team.slot_count}
									<CircleCheck class="h-4 w-4 text-accent" />
								{:else if pending.length > 0}
									<Clock class="h-4 w-4 text-orange-400" />
								{:else}
									<CircleX class="h-4 w-4 text-muted-foreground/40" />
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center justify-between gap-2">
									<p class="font-medium text-sm truncate">{team.name}</p>
									<span class="text-xs text-muted-foreground shrink-0">{approved.length}/{team.slot_count}</span>
								</div>
								{#if approved.length > 0}
									<p class="text-xs text-accent mt-0.5 flex items-center gap-1">
										<UserCheck class="h-3 w-3" />{approved.map((r) => r.expand?.user?.name ?? '?').join(', ')}
									</p>
								{/if}
								{#if pending.length > 0}
									<p class="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
										<Clock class="h-3 w-3" />Pending: {pending.map((r) => r.expand?.user?.name ?? '?').join(', ')}
									</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- Add team form -->
				<Separator class="my-2" />
				<form method="POST" action="?/createTeam" use:enhance class="space-y-2">
					<div class="flex gap-2">
						<input
							name="name"
							type="text"
							placeholder="Team name (e.g. Doan & JK)"
							required
							class="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						/>
						<select
							name="slot_count"
							class="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						>
							<option value="1">1 slot</option>
							<option value="2">2 slots</option>
						</select>
						<Button type="submit" size="sm">Add</Button>
					</div>
					{#if form?.teamError}
						<p class="text-xs text-destructive">{form.teamError}</p>
					{/if}
				</form>
			</Card.CardContent>
		</Card.Card>

		<!-- Pending Join Requests -->
		<Card.Card>
			<Card.CardHeader>
				<Card.CardTitle class="flex items-center gap-2 text-lg font-bold text-primary">
					<UserPlus class="h-4 w-4" /> Join Requests
				</Card.CardTitle>
				<p class="text-sm text-muted-foreground">
					{(data.joinRequests ?? []).filter((r) => r.status === 'pending').length} pending
				</p>
			</Card.CardHeader>
			<Card.CardContent>
				{#if (data.joinRequests ?? []).filter((r) => r.status === 'pending').length === 0}
					<p class="text-sm text-muted-foreground py-4 text-center">No pending requests.</p>
				{:else}
					<div class="space-y-2">
						{#each (data.joinRequests ?? []).filter((r) => r.status === 'pending') as req}
							<div class="flex items-center gap-3 rounded-lg border p-3">
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium truncate">{req.expand?.user?.name ?? req.user}</p>
									<p class="text-xs text-muted-foreground">→ {req.expand?.pool_team?.name ?? req.pool_team}</p>
								</div>
								<div class="flex gap-2 shrink-0">
									<form method="POST" action="?/approveRequest" use:enhance>
										<input type="hidden" name="request_id" value={req.id} />
										<Button type="submit" size="sm" variant="default" class="h-7 px-3 text-xs">Approve</Button>
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

				<!-- Recently resolved -->
				{#if (data.joinRequests ?? []).filter((r) => r.status !== 'pending').length > 0}
					<Separator class="my-3" />
					<p class="text-xs font-semibold text-muted-foreground mb-2">Resolved</p>
					<div class="overflow-hidden rounded-lg border">
						{#each (data.joinRequests ?? []).filter((r) => r.status !== 'pending') as req, i}
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

	<Separator />

	<!-- Draft Status Bar -->
	<div class="flex items-end gap-6">
		<div class="flex items-center gap-4 ml-auto">
			{#if isLive && hasTimer && !draftComplete}
				<div class="text-center">
					<p class="text-xs uppercase text-muted-foreground">Time Left</p>
					<p
						class="text-3xl font-mono font-bold {timeRemaining <= 10
							? 'text-destructive animate-pulse'
							: timeRemaining <= 30
								? 'text-orange-500'
								: 'text-primary'}"
					>
						{formatTime(timeRemaining)}
					</p>
				</div>
			{/if}
			{#if settings}
				<div
					class="rounded-lg px-3 py-1.5 text-sm font-semibold
					{settings.status === 'in_progress'
						? 'bg-accent/20 text-accent'
						: settings.status === 'paused'
							? 'bg-orange-100 text-orange-700'
							: settings.status === 'completed'
								? 'bg-muted text-muted-foreground'
								: 'bg-muted text-muted-foreground'}"
				>
					{settings.status === 'in_progress'
						? 'Live'
						: settings.status === 'paused'
							? 'Paused'
							: settings.status === 'completed'
								? 'Complete'
								: 'Not Started'}
				</div>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-3">
		<Trophy class="h-7 w-7 text-primary" />
		<div>
			<h1 class="text-3xl font-bold text-primary">Draft Board</h1>
			<p class="text-muted-foreground">
				{entryCount} entries — Round {currentDraftRound} of 6 — Pick #{nextPickNumber} of {totalPicks}
			</p>
		</div>
	</div>

	{#if draftComplete}
		<div class="rounded-lg border-2 border-accent bg-accent/10 p-6 text-center">
			<p class="text-2xl font-bold text-accent">Draft Complete!</p>
			<p class="text-muted-foreground">All {totalPicks} picks have been made.</p>
		</div>
	{/if}

	<!-- On the Clock Banner -->
	{#if nextPicker && !draftComplete && isLive}
		<div class="rounded-lg border-2 border-primary bg-primary/5 p-4 flex items-center justify-between">
			<div>
				<p class="text-xs uppercase tracking-wider text-muted-foreground">On the Clock</p>
				<p class="text-2xl font-bold text-primary">{nextPicker.name}</p>
				<p class="text-sm text-muted-foreground">
					Pick #{nextPickNumber} — Round {currentDraftRound} ({isReverseRound ? 'reverse' : 'forward'})
				</p>
			</div>
			<div class="flex gap-2">
				{#if timerExpired}
					<form method="POST" action="?/autoPick" use:enhance>
						
						<Button variant="destructive">Auto-Pick (Time Expired)</Button>
					</form>
				{/if}
				<form method="POST" action="?/autoPick" use:enhance>
					
					<Button variant="outline">Auto-Pick Best Available</Button>
				</form>
			</div>
		</div>
	{/if}

	<!-- Hidden form for drag-and-drop submission -->
	{#if !draftComplete && nextPicker && isLive}
		<form method="POST" action="?/makePick" use:enhance id="pick-form" class="hidden">
			<input type="hidden" name="user" value={nextPicker.id} />
			<input type="hidden" name="draft_round" value={currentDraftRound} />
			<input type="hidden" name="pick_number" value={nextPickNumber} />
			
			<input type="hidden" name="team" value={selectedTeam} />
		</form>
	{/if}

	<!-- Main Grid: Controls | Available Teams (wide) | Pick Bucket -->
	<div class="grid gap-6 lg:grid-cols-[280px_1fr_300px]">
		<!-- Column 1: Controls -->
		<div class="space-y-4">
			<!-- Draft Settings (before start or when paused) -->
			{#if settings && (isNotStarted || isPaused)}
				<Card.Card>
					<Card.CardHeader class="pb-3">
						<Card.CardTitle>Draft Settings</Card.CardTitle>
					</Card.CardHeader>
					<Card.CardContent>
						<form method="POST" action="?/updateSettings" use:enhance>
							<input type="hidden" name="settings_id" value={settings.id} />
							<input type="hidden" name="timer_seconds" value={selectedTimer} />
							<div class="space-y-3">
								<Label class="text-xs uppercase tracking-wider text-muted-foreground">Pick Timer</Label>
								{#each TIMER_PRESETS as preset}
									<label
										class="flex items-center gap-3 rounded-md border px-3 py-1.5 cursor-pointer transition-colors text-sm
											{selectedTimer === preset.value
											? 'border-primary bg-primary/5'
											: 'border-input hover:bg-muted'}"
									>
										<input
											type="radio"
											name="timer_radio"
											value={preset.value}
											checked={selectedTimer === preset.value}
											onchange={() => (selectedTimer = preset.value)}
											class="h-3.5 w-3.5 accent-primary"
										/>
										<span>{preset.label}</span>
										{#if preset.value === 600}
											<span class="ml-auto text-xs text-muted-foreground">default</span>
										{/if}
									</label>
								{/each}
								<Button type="submit" variant="outline" class="w-full" size="sm">Save Settings</Button>
							</div>
						</form>
						{#if form?.settingsSuccess}
							<p class="mt-2 text-xs text-accent">Settings saved!</p>
						{/if}
					</Card.CardContent>
				</Card.Card>
			{/if}

			<!-- Start Draft -->
			{#if settings && isNotStarted}
				{@const poolReady = isPoolDraftReady(data.poolTeams ?? [], data.joinRequests ?? [])}
				<Card.Card class="border-primary/30">
					<Card.CardContent class="pt-6 space-y-3">
						{#if !poolReady}
							<p class="text-xs text-muted-foreground text-center">
								Draft locked until all 10 teams have an approved participant.
							</p>
						{/if}
						<form method="POST" action="?/startDraft" use:enhance>
							
							<input type="hidden" name="settings_id" value={settings.id} />
							<input type="hidden" name="timer_seconds" value={selectedTimer} />
							<Button type="submit" class="w-full" disabled={!poolReady}>Draw Lottery & Start Draft</Button>
						</form>
						{#if form?.startError}
							<p class="mt-2 text-xs text-destructive">{form.startError}</p>
						{/if}
					</Card.CardContent>
				</Card.Card>
			{/if}

			<!-- Pause / Resume -->
			{#if settings && isLive}
				<form method="POST" action="?/pauseDraft" use:enhance>
					<input type="hidden" name="settings_id" value={settings.id} />
					<Button type="submit" variant="outline" class="w-full" size="sm">Pause Draft</Button>
				</form>
			{/if}
			{#if settings && isPaused}
				<form method="POST" action="?/resumeDraft" use:enhance>
					<input type="hidden" name="settings_id" value={settings.id} />
					<input type="hidden" name="timer_seconds" value={selectedTimer} />
					<Button type="submit" class="w-full" size="sm">Resume Draft</Button>
				</form>
			{/if}

			<!-- Future round group lotteries -->
			{#if settings && isLive && currentRoundGroup < 3}
				<Card.Card>
					<Card.CardHeader class="pb-2">
						<Card.CardTitle class="text-sm">Next Round Group</Card.CardTitle>
					</Card.CardHeader>
					<Card.CardContent>
						{#each [2, 3].filter((g) => g > currentRoundGroup) as group}
							{@const hasOrder = data.draftOrders.some((o) => o.round_group === group)}
							<form method="POST" action="?/generateOrder" use:enhance class="mb-2">
								<input type="hidden" name="round_group" value={group} />
								
								<Button type="submit" variant="outline" class="w-full text-xs" size="sm" disabled={hasOrder}>
									{hasOrder ? `Group ${group} drawn` : `Draw Group ${group}`}
								</Button>
							</form>
						{/each}
					</Card.CardContent>
				</Card.Card>
			{/if}

			<!-- Current Order -->
			{#if currentGroupOrders.length > 0}
				<Card.Card>
					<Card.CardHeader class="pb-2">
						<Card.CardTitle class="flex items-center gap-1.5 text-sm">
							<Shuffle class="h-3.5 w-3.5" /> Order (Group {currentRoundGroup})
						</Card.CardTitle>
					</Card.CardHeader>
					<Card.CardContent>
						<ol class="overflow-hidden rounded-lg border text-sm">
							{#each currentGroupOrders.sort((a, b) => a.position - b.position) as order, i}
								{@const user = data.participants.find((p) => p.id === order.user)}
								<li class="flex items-center gap-2 px-2 py-1.5
									{nextPicker?.id === order.user
										? 'bg-primary/10 font-bold text-primary'
										: i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
									<Hash class="h-3 w-3 shrink-0 text-muted-foreground" />
									<span class="w-4 text-right text-muted-foreground text-xs">{order.position}</span>
									<span class="flex-1 text-xs">{user?.name ?? 'Unknown'}</span>
									{#if nextPicker?.id === order.user}
										<Zap class="h-3 w-3 text-primary" />
									{/if}
								</li>
							{/each}
						</ol>
					</Card.CardContent>
				</Card.Card>
			{/if}
		</div>

		<!-- Column 2: Available Teams (wide, 4-region grid) -->
		<div>
			<Card.Card>
				<Card.CardHeader class="pb-3">
					<div class="flex items-center justify-between gap-4">
						<Card.CardTitle>Available ({availableTeams.length})</Card.CardTitle>
						<input
							type="text"
							placeholder="Search teams..."
							bind:value={teamSearch}
							class="flex h-8 w-64 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						/>
					</div>
				</Card.CardHeader>
				<Card.CardContent>
					<div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
						{#each REGIONS as region}
							{@const regionTeams = filteredTeams().filter((t) => t.region === region)}
							{#if regionTeams.length > 0 || !teamSearch}
								<div>
									<p class="mb-2 text-xs font-bold uppercase tracking-widest text-primary border-b border-primary/20 pb-1">
										{region}
									</p>
									<div class="space-y-0.5">
										{#each (teamSearch ? regionTeams : data.teams.filter((t) => t.region === region)) as team}
											{@const drafted = draftedTeamIds.has(team.id)}
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div
												class="flex items-center gap-1.5 rounded px-2 py-1 text-sm transition-all
													{drafted
													? 'line-through opacity-30'
													: isLive
														? 'hover:bg-primary/10 cursor-grab active:cursor-grabbing hover:shadow-sm'
														: 'hover:bg-muted/50'}"
												draggable={!drafted && isLive}
												ondragstart={(e) => !drafted && handleDragStart(e, team.id)}
												ondragend={() => (draggedTeamId = '')}
												role={drafted ? undefined : 'listitem'}
											>
												<span class="w-5 text-right font-mono text-xs text-muted-foreground">{team.seed}</span>
												<span class="flex-1 truncate">{team.name}</span>
												{#if !drafted && isLive}
													<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-muted-foreground/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
														<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
													</svg>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				</Card.CardContent>
			</Card.Card>
		</div>

		<!-- Column 3: Pick Bucket (drop zone) -->
		<div>
			{#if !draftComplete && nextPicker && isLive}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="sticky top-4 rounded-xl border-2 transition-all
						{dropHover
						? 'border-primary bg-primary/10 shadow-xl scale-[1.02]'
						: 'border-dashed border-primary/40 bg-muted/30'}"
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
					role="region"
					aria-label="Drop zone for team pick"
				>
					<div class="p-4 text-center border-b border-primary/10">
						<p class="text-xs uppercase tracking-wider text-muted-foreground">Picking for</p>
						<p class="text-lg font-bold text-primary">{nextPicker.name}</p>
						<p class="text-xs text-muted-foreground">Pick #{nextPickNumber} — R{currentDraftRound}</p>
					</div>
					<div class="flex flex-col items-center justify-center p-8">
						{#if dropHover}
							<div class="rounded-full bg-primary/20 p-4 mb-3">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							</div>
							<p class="text-lg font-bold text-primary">Drop to pick!</p>
						{:else}
							<div class="rounded-full bg-muted p-4 mb-3">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
								</svg>
							</div>
							<p class="text-sm font-medium text-muted-foreground">Drag a team here</p>
							<p class="text-xs text-muted-foreground mt-1">from the board</p>
						{/if}
					</div>
					{#if form?.pickError}
						<p class="px-4 pb-3 text-sm text-destructive text-center">{form.pickError}</p>
					{/if}
					{#if form?.pickSuccess}
						<p class="px-4 pb-3 text-sm text-accent text-center">Pick confirmed!</p>
					{/if}
				</div>
			{:else if !isLive && !draftComplete}
				<div class="rounded-xl border-2 border-dashed border-muted p-8 text-center">
					<p class="text-sm text-muted-foreground">Start the draft to begin picking</p>
				</div>
			{:else if draftComplete}
				<div class="rounded-xl border-2 border-accent/30 bg-accent/5 p-8 text-center">
					<p class="text-sm font-medium text-accent">All picks made</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Draft Log (full width, below) -->
	<Card.Card>
		<Card.CardHeader class="pb-3">
			<Card.CardTitle class="flex items-center gap-2">
				<ChartBar class="h-4 w-4" /> Draft Log ({data.picks.length}/{totalPicks})
			</Card.CardTitle>
		</Card.CardHeader>
		<Card.CardContent>
			{#if data.picks.length === 0}
				<p class="text-sm text-muted-foreground">No picks yet.</p>
			{:else}
				<div class="overflow-hidden rounded-lg border">
					{#each [...data.picks].reverse() as pick, i}
						{@const user = pick.expand?.user}
						{@const team = pick.expand?.team}
						<div class="flex items-center gap-2 px-3 py-1.5 text-sm {i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
							<Hash class="h-3 w-3 shrink-0 text-muted-foreground" />
							<span class="w-5 text-right font-mono text-xs text-muted-foreground">{pick.pick_number}</span>
							<span class="font-medium truncate">{user?.name ?? '?'}</span>
							<span class="text-muted-foreground">—</span>
							<span class="flex-1 truncate">({team?.seed}) {team?.name ?? '?'}</span>
							<span class="text-xs text-muted-foreground shrink-0">R{pick.draft_round}</span>
							<form method="POST" action="?/undoPick" use:enhance>
								<input type="hidden" name="pick_id" value={pick.id} />
								<button type="submit" class="text-xs text-destructive hover:underline shrink-0">undo</button>
							</form>
						</div>
					{/each}
				</div>
			{/if}
		</Card.CardContent>
	</Card.Card>
</div>
