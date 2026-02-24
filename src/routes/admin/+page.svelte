<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { REGIONS, TIMER_PRESETS } from '$lib/types';
	import type { Pool, DraftSettings } from '$lib/types';

	let { data, form } = $props();

	// --- Pool tab state ---
	let defaultPoolId = $derived(data.pools[0]?.id ?? '');
	let _activePoolId = $state('');
	let activePoolId = $derived(_activePoolId || defaultPoolId);

	let activePool = $derived(data.pools.find((p) => p.id === activePoolId));
	let settings = $derived(data.allSettings.find((s) => s.pool === activePoolId) ?? null);

	// Filter data by active pool
	let poolParticipants = $derived(
		data.poolEntries
			.filter((e) => e.pool === activePoolId)
			.map((e) => data.participants.find((p) => p.id === e.user))
			.filter(Boolean)
	);
	let poolParticipantIds = $derived(new Set(poolParticipants.map((p) => p!.id)));

	let poolPicks = $derived(data.picks.filter((p) => poolParticipantIds.has(p.user)));
	let poolOrders = $derived(data.draftOrders.filter((o) => poolParticipantIds.has(o.user)));

	// --- Derived draft state ---
	let draftedTeamIds = $derived(new Set(poolPicks.map((p) => p.team)));
	let availableTeams = $derived(data.teams.filter((t) => !draftedTeamIds.has(t.id)));
	let nextPickNumber = $derived(poolPicks.length + 1);
	let entryCount = $derived(poolParticipants.length);
	let totalPicks = $derived(entryCount * 6);
	let draftComplete = $derived(poolPicks.length >= totalPicks);

	let currentDraftRound = $derived(
		entryCount > 0 ? Math.min(Math.floor(poolPicks.length / entryCount) + 1, 6) : 1
	);
	let currentRoundGroup = $derived(Math.ceil(currentDraftRound / 2));

	let currentGroupOrders = $derived(
		poolOrders.filter((o) => o.round_group === currentRoundGroup)
	);

	let picksInCurrentRound = $derived(entryCount > 0 ? poolPicks.length % entryCount : 0);
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
	let selectedTimer = $state(60);

	$effect(() => {
		selectedTimer = settings?.timer_seconds ?? 60;
	});

	let isNotStarted = $derived(settings?.status === 'not_started');
	let isPaused = $derived(settings?.status === 'paused');
</script>

<svelte:head>
	<title>Admin - Draft Board</title>
</svelte:head>

<div class="space-y-6">
	<!-- Pool Tabs + Timer + Status -->
	<div class="flex items-end gap-6">
		<div class="flex gap-1 rounded-lg border bg-muted p-1">
			{#each data.pools as pool}
				<button
					class="rounded-md px-4 py-2 text-sm font-medium transition-colors
						{activePoolId === pool.id
						? 'bg-background text-primary shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => {
						_activePoolId = pool.id;
						selectedTeam = '';
						teamSearch = '';
					}}
				>
					{pool.name}
				</button>
			{/each}
		</div>
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

	<div>
		<h1 class="text-3xl font-bold text-primary">
			Draft Board — {activePool?.name ?? ''}
		</h1>
		<p class="text-muted-foreground">
			{entryCount} entries — Round {currentDraftRound} of 6 — Pick #{nextPickNumber} of {totalPicks}
		</p>
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
						<input type="hidden" name="pool_id" value={activePoolId} />
						<Button variant="destructive">Auto-Pick (Time Expired)</Button>
					</form>
				{/if}
				<form method="POST" action="?/autoPick" use:enhance>
					<input type="hidden" name="pool_id" value={activePoolId} />
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
			<input type="hidden" name="pool_id" value={activePoolId} />
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
										{#if preset.value === 60}
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
				<Card.Card class="border-primary/30">
					<Card.CardContent class="pt-6">
						<form method="POST" action="?/startDraft" use:enhance>
							<input type="hidden" name="pool_id" value={activePoolId} />
							<input type="hidden" name="settings_id" value={settings.id} />
							<input type="hidden" name="timer_seconds" value={selectedTimer} />
							<Button type="submit" class="w-full">Draw Lottery & Start Draft</Button>
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
							{@const hasOrder = poolOrders.some((o) => o.round_group === group)}
							<form method="POST" action="?/generateOrder" use:enhance class="mb-2">
								<input type="hidden" name="round_group" value={group} />
								<input type="hidden" name="pool_id" value={activePoolId} />
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
						<Card.CardTitle class="text-sm">Order (Group {currentRoundGroup})</Card.CardTitle>
					</Card.CardHeader>
					<Card.CardContent>
						<ol class="space-y-0.5 text-sm">
							{#each currentGroupOrders.sort((a, b) => a.position - b.position) as order}
								{@const user = data.participants.find((p) => p.id === order.user)}
								<li
									class="flex items-center gap-2 rounded px-2 py-0.5 {nextPicker?.id === order.user
										? 'bg-primary/10 font-bold text-primary'
										: ''}"
								>
									<span class="w-5 text-right text-muted-foreground text-xs">{order.position}.</span>
									<span class="text-xs">{user?.name ?? 'Unknown'}</span>
									{#if nextPicker?.id === order.user}
										<span class="ml-auto text-[10px] text-primary">picking</span>
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
			<Card.CardTitle>Draft Log ({poolPicks.length}/{totalPicks})</Card.CardTitle>
		</Card.CardHeader>
		<Card.CardContent>
			{#if poolPicks.length === 0}
				<p class="text-sm text-muted-foreground">No picks yet.</p>
			{:else}
				<div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each [...poolPicks].reverse() as pick}
						{@const user = pick.expand?.user}
						{@const team = pick.expand?.team}
						<div class="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-muted">
							<span class="w-6 text-right font-mono text-muted-foreground">{pick.pick_number}.</span>
							<span class="font-medium">{user?.name ?? '?'}</span>
							<span class="text-muted-foreground">—</span>
							<span>({team?.seed}) {team?.name ?? '?'}</span>
							<span class="ml-auto text-xs text-muted-foreground">R{pick.draft_round}</span>
							<form method="POST" action="?/undoPick" use:enhance>
								<input type="hidden" name="pick_id" value={pick.id} />
								<button type="submit" class="text-xs text-destructive hover:underline">undo</button>
							</form>
						</div>
					{/each}
				</div>
			{/if}
		</Card.CardContent>
	</Card.Card>
</div>
