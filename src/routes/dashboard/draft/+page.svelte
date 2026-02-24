<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { REGIONS } from '$lib/types';

	let { data, form } = $props();

	let entryCount = $derived(data.entryCount || data.participants.length);
	let totalPicks = $derived(entryCount * 6);
	let draftedTeamIds = $derived(new Set(data.picks.map((p) => p.team)));
	let availableTeams = $derived(data.teams.filter((t) => !draftedTeamIds.has(t.id)));
	let nextPickNumber = $derived(data.picks.length + 1);
	let draftComplete = $derived(data.picks.length >= totalPicks);
	let currentDraftRound = $derived(
		entryCount > 0 ? Math.min(Math.floor(data.picks.length / entryCount) + 1, 6) : 1
	);
	let currentRoundGroup = $derived(Math.ceil(currentDraftRound / 2));
	let isReverseRound = $derived(currentDraftRound % 2 === 0);
	let picksInCurrentRound = $derived(entryCount > 0 ? data.picks.length % entryCount : 0);

	let currentGroupOrders = $derived(
		data.draftOrders.filter((o) => o.round_group === currentRoundGroup)
	);

	let nextPicker = $derived.by(() => {
		if (currentGroupOrders.length === 0 || draftComplete) return null;
		const idx = isReverseRound ? entryCount - 1 - picksInCurrentRound : picksInCurrentRound;
		const order = currentGroupOrders.find((o) => o.position === idx + 1);
		if (!order) return null;
		return data.participants.find((p) => p.id === order.user) ?? null;
	});

	let myPicks = $derived(data.picks.filter((p) => p.user === data.userId || p.expand?.user?.id === data.userId));

	let settings = $derived(data.draftSettings);
	let isLive = $derived(settings?.status === 'in_progress');

	// Timer
	let timeRemaining = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	function updateTimer() {
		if (!settings?.current_pick_deadline) { timeRemaining = 0; return; }
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

	function formatTime(s: number): string {
		return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
	}

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
			const form = document.getElementById('user-pick-form') as HTMLFormElement;
			if (form) form.requestSubmit();
		}
		draggedTeamId = '';
	}

	const statusLabels: Record<string, string> = {
		not_started: 'Waiting to start',
		in_progress: 'Draft is Live!',
		paused: 'Draft Paused',
		completed: 'Draft Complete'
	};
</script>

<svelte:head>
	<title>Live Draft - NCAA Pool 2026</title>
</svelte:head>

<div class="space-y-6">
	<!-- Status Banner -->
	<div class="flex items-center justify-between rounded-lg border-2 p-4
		{isLive ? 'border-accent bg-accent/5' : 'border-muted bg-muted/50'}">
		<div>
			<p class="text-lg font-bold {isLive ? 'text-accent' : 'text-muted-foreground'}">
				{statusLabels[settings?.status ?? 'not_started']}
			</p>
			<p class="text-sm text-muted-foreground">
				Round {currentDraftRound} — Pick #{nextPickNumber} of {totalPicks}
			</p>
		</div>
		{#if isLive && settings?.timer_seconds && settings.timer_seconds > 0}
			<p class="text-3xl font-mono font-bold {timeRemaining <= 10 ? 'text-destructive animate-pulse' : 'text-primary'}">
				{formatTime(timeRemaining)}
			</p>
		{/if}
	</div>

	<!-- On the Clock -->
	{#if nextPicker && !draftComplete}
		<div class="rounded-lg border-2 p-4 {data.isOnTheClock ? 'border-primary bg-primary/10' : 'border-muted'}">
			<p class="text-xs uppercase tracking-wider text-muted-foreground">On the Clock</p>
			<p class="text-2xl font-bold {data.isOnTheClock ? 'text-primary' : ''}">
				{nextPicker.name}
				{#if data.isOnTheClock}
					<span class="text-base font-normal text-accent"> — That's you!</span>
				{/if}
			</p>
		</div>
	{/if}

	<!-- Hidden form for drag-and-drop submission -->
	{#if data.canPick && !draftComplete}
		<form method="POST" action="?/userPick" use:enhance id="user-pick-form" class="hidden">
			<input type="hidden" name="team" value={selectedTeam} />
		</form>
	{/if}

	<!-- Main Grid: Available Teams (wide) | Pick Bucket -->
	<div class="grid gap-6 lg:grid-cols-[1fr_300px]">
		<!-- Available Teams (4-region grid with search) -->
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
										{@const canDrag = !drafted && data.canPick}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class="flex items-center gap-1.5 rounded px-2 py-1 text-sm transition-all
												{drafted
												? 'line-through opacity-30'
												: canDrag
													? 'hover:bg-primary/10 cursor-grab active:cursor-grabbing hover:shadow-sm'
													: 'hover:bg-muted/50'}"
											draggable={canDrag}
											ondragstart={(e) => canDrag && handleDragStart(e, team.id)}
											ondragend={() => (draggedTeamId = '')}
											role={canDrag ? 'listitem' : undefined}
										>
											<span class="w-5 text-right font-mono text-xs text-muted-foreground">{team.seed}</span>
											<span class="flex-1 truncate">{team.name}</span>
											{#if canDrag}
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

		<!-- Pick Bucket (drop zone) -->
		<div>
			{#if data.canPick && !draftComplete}
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
					aria-label="Drop zone for your pick"
				>
					<div class="p-4 text-center border-b border-primary/10">
						<p class="text-xs uppercase tracking-wider text-muted-foreground">Your Pick</p>
						<p class="text-lg font-bold text-primary">Pick #{nextPickNumber}</p>
						<p class="text-xs text-muted-foreground">Round {currentDraftRound}</p>
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
						{/if}
					</div>
					{#if form?.pickError}
						<p class="px-4 pb-3 text-sm text-destructive text-center">{form.pickError}</p>
					{/if}
					{#if form?.pickSuccess}
						<p class="px-4 pb-3 text-sm text-accent text-center">Pick submitted!</p>
					{/if}
				</div>
			{:else if !draftComplete}
				<div class="rounded-xl border-2 border-dashed border-muted p-8 text-center">
					<p class="text-sm text-muted-foreground">
						{data.isOnTheClock ? 'Waiting...' : 'Not your turn'}
					</p>
				</div>
			{/if}

			<!-- My Roster (below pick bucket) -->
			<Card.Card class="mt-4">
				<Card.CardHeader class="pb-2">
					<Card.CardTitle class="text-sm">My Roster ({myPicks.length}/6)</Card.CardTitle>
				</Card.CardHeader>
				<Card.CardContent>
					{#if myPicks.length === 0}
						<p class="text-xs text-muted-foreground">No picks yet.</p>
					{:else}
						<div class="space-y-1.5">
							{#each myPicks as pick}
								{@const team = pick.expand?.team}
								<div class="flex items-center gap-2 rounded-lg border p-2">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
										{team?.seed ?? '?'}
									</div>
									<span class="text-sm font-medium">{team?.name ?? '?'}</span>
									<span class="ml-auto text-xs text-muted-foreground">{team?.region}</span>
								</div>
							{/each}
						</div>
					{/if}
				</Card.CardContent>
			</Card.Card>
		</div>
	</div>

	<!-- Draft Log (full width, below) -->
	<Card.Card>
		<Card.CardHeader class="pb-3">
			<Card.CardTitle>Draft Log ({data.picks.length}/{totalPicks})</Card.CardTitle>
		</Card.CardHeader>
		<Card.CardContent>
			{#if data.picks.length === 0}
				<p class="text-sm text-muted-foreground">Waiting for first pick...</p>
			{:else}
				<div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each [...data.picks].reverse() as pick}
						{@const user = pick.expand?.user}
						{@const team = pick.expand?.team}
						{@const isMe = (pick.user === data.userId || user?.id === data.userId)}
						<div class="flex items-center gap-2 rounded px-3 py-1.5 text-sm {isMe ? 'bg-primary/10 font-medium' : 'hover:bg-muted'}">
							<span class="w-5 text-right font-mono text-muted-foreground">{pick.pick_number}.</span>
							<span>{user?.name ?? '?'}</span>
							<span class="text-muted-foreground">—</span>
							<span>({team?.seed}) {team?.name ?? '?'}</span>
							<span class="ml-auto text-xs text-muted-foreground">R{pick.draft_round}</span>
						</div>
					{/each}
				</div>
			{/if}
		</Card.CardContent>
	</Card.Card>
</div>
