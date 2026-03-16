<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { REGIONS, TIMER_PRESETS, isPoolDraftReady } from '$lib/types';
	import type { DraftSettings } from '$lib/types';
	import Users from '@lucide/svelte/icons/users';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import Hash from '@lucide/svelte/icons/hash';
	import Zap from '@lucide/svelte/icons/zap';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Search from '@lucide/svelte/icons/search';
	import ListFilter from '@lucide/svelte/icons/list-filter';

	let { data, form } = $props();

	// Single pool — no tab switching needed
	let settings = $derived(data.draftSettings as DraftSettings | null);

	// Draft is keyed on pool teams (10 entries)
	let entryCount = $derived((data.poolTeams ?? []).length);
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
		(data.draftOrders ?? []).filter((o) => o.round_group === currentRoundGroup)
	);

	let picksInCurrentRound = $derived(entryCount > 0 ? data.picks.length % entryCount : 0);
	let isReverseRound = $derived(currentDraftRound % 2 === 0);

	// Picks remaining in the current group (each group = 2 rounds × entryCount picks)
	let picksPerGroup = $derived(entryCount * 2);
	let picksCompletedInGroup = $derived((currentDraftRound <= 2 ? data.picks.length : currentDraftRound <= 4 ? data.picks.length - picksPerGroup : data.picks.length - picksPerGroup * 2));
	let picksRemainingInGroup = $derived(picksPerGroup - picksCompletedInGroup);

	// Whether the current group has a confirmed order
	let currentGroupHasOrder = $derived(
		(data.draftOrders ?? []).filter((o) => o.round_group === currentRoundGroup).length === entryCount
	);

	// The group we need to set an order for:
	// - Current group if it has no orders (e.g. seeded all at once, or jumped into mid-draft)
	// - Next group if we're in the last round of the current group
	let pendingOrderGroup = $derived.by(() => {
		if (!isLive || draftComplete) return null;
		// Current group missing orders — must set before picks can proceed
		if (!currentGroupHasOrder) return currentRoundGroup;
		// Last round of current group — prompt for next group
		if (picksRemainingInGroup <= entryCount && currentRoundGroup < 3) return currentRoundGroup + 1;
		return null;
	});

	// Whether the pending group already has a confirmed order saved
	let nextGroupHasOrder = $derived(
		pendingOrderGroup !== null &&
		(data.draftOrders ?? []).filter((o) => o.round_group === pendingOrderGroup).length === entryCount
	);

	let showNextGroupPanel = $derived(pendingOrderGroup !== null);

	// Alias for template use
	let nextGroup = $derived(pendingOrderGroup);

	// Drag state for the next-group order panel (mirrors draftOrder for G1)
	let nextGroupOrder = $state<string[]>([]);
	let nextGroupDraggedId = $state('');
	let nextGroupDragOverIdx = $state(-1);
	let nextGroupConfirmingOrder = $state(false);

	// Initialise / sync nextGroupOrder when the panel becomes visible or pendingOrderGroup changes
	$effect(() => {
		if (!showNextGroupPanel || nextGroup === null) return;
		const existing = (data.draftOrders ?? [])
			.filter((o) => o.round_group === nextGroup)
			.sort((a, b) => a.position - b.position)
			.map((o) => o.pool_team);
		if (existing.length === entryCount) {
			nextGroupOrder = existing;
		} else {
			// Default to pool team list order (admin can drag to reorder)
			nextGroupOrder = (data.poolTeams ?? []).map((t) => t.id);
		}
	});

	function nextGroupDragStart(e: DragEvent, teamId: string) {
		nextGroupDraggedId = teamId;
		e.dataTransfer!.effectAllowed = 'move';
	}

	function nextGroupDragOver(e: DragEvent, idx: number) {
		e.preventDefault();
		nextGroupDragOverIdx = idx;
	}

	function nextGroupDrop(idx: number) {
		if (!nextGroupDraggedId) return;
		const from = nextGroupOrder.indexOf(nextGroupDraggedId);
		if (from === -1 || from === idx) { nextGroupDraggedId = ''; nextGroupDragOverIdx = -1; return; }
		const updated = [...nextGroupOrder];
		updated.splice(from, 1);
		updated.splice(idx, 0, nextGroupDraggedId);
		nextGroupOrder = updated;
		nextGroupDraggedId = '';
		nextGroupDragOverIdx = -1;
	}

	function randomizeNextGroupOrder() {
		const shuffled = [...nextGroupOrder];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		nextGroupOrder = shuffled;
	}

	// The pool team currently on the clock
	let nextPickerTeam = $derived.by(() => {
		if (currentGroupOrders.length === 0 || draftComplete) return null;
		const idx = isReverseRound ? entryCount - 1 - picksInCurrentRound : picksInCurrentRound;
		const order = currentGroupOrders.find((o) => o.position === idx + 1);
		if (!order) return null;
		return (data.poolTeams ?? []).find((t) => t.id === order.pool_team) ?? null;
	});

	// Members of the on-clock pool team (approved join requests)
	let nextPickerMembers = $derived(
		nextPickerTeam
			? (data.joinRequests ?? [])
					.filter((r) => r.pool_team === nextPickerTeam!.id && r.status === 'approved')
					.map((r) => r.expand?.user?.name ?? '?')
			: []
	);

	// Pre-start drag-to-order state: admin drags pool teams into lottery order
	let draftOrder = $state<string[]>((data.poolTeams ?? []).map((t) => t.id));
	let orderDraggedId = $state('');
	let orderDragOverIdx = $state(-1);

	function orderDragStart(e: DragEvent, teamId: string) {
		orderDraggedId = teamId;
		e.dataTransfer!.effectAllowed = 'move';
	}
	function orderDragOver(e: DragEvent, idx: number) {
		e.preventDefault();
		orderDragOverIdx = idx;
	}
	function orderDrop(idx: number) {
		if (!orderDraggedId) return;
		const from = draftOrder.indexOf(orderDraggedId);
		if (from === -1 || from === idx) { orderDraggedId = ''; orderDragOverIdx = -1; return; }
		const next = [...draftOrder];
		next.splice(from, 1);
		next.splice(idx, 0, orderDraggedId);
		draftOrder = next;
		orderDraggedId = '';
		orderDragOverIdx = -1;
	}

	function randomizeDraftOrder() {
		const shuffled = [...draftOrder];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		draftOrder = shuffled;
	}


	let confirmingOrder = $state(false);
	let startingDraft = $state(false);
	let showGroupInfo = $state(false);

	// --- Pick modal (mobile-friendly team picker) ---
	let pickModalOpen = $state(false);
	let pickModalSearch = $state('');
	let pickModalPending = $state(false);
	let pickModalRegion = $state('All');
	let pendingPickTeam = $state<{ id: string; name: string; seed: number; region: string } | null>(null);
	let pickConfirmed = $state(false);

	const PICK_REGIONS = ['All', 'East', 'West', 'South', 'Midwest'] as const;

	let pickModalTeams = $derived.by(() => {
		const q = pickModalSearch.toLowerCase().trim();
		let teams = availableTeams;
		if (pickModalRegion !== 'All') teams = teams.filter((t) => t.region === pickModalRegion);
		if (!q) return teams;
		return teams.filter(
			(t) => t.name.toLowerCase().includes(q) || t.seed.toString() === q || t.region.toLowerCase().includes(q)
		);
	});

	function openPickModal() {
		pickModalSearch = '';
		pickModalRegion = 'All';
		pendingPickTeam = null;
		pickConfirmed = false;
		pickModalOpen = true;
	}

	function pickModalSelect(team: { id: string; name: string; seed: number; region: string }) {
		if (pickPending) return;
		pendingPickTeam = team;
	}

	async function confirmPick() {
		console.debug('[PICK] confirmPick guard — nextPickerTeam:', nextPickerTeam?.name, 'pendingPickTeam:', pendingPickTeam?.name, 'pickPending:', pickPending);
		if (!nextPickerTeam || !pendingPickTeam || pickPending) {
			console.warn('[PICK] confirmPick BLOCKED — nextPickerTeam:', !!nextPickerTeam, 'pendingPickTeam:', !!pendingPickTeam, 'pickPending:', pickPending);
			return;
		}
		console.debug('[PICK] confirmPick called — team:', pendingPickTeam.name, 'for:', nextPickerTeam.name, 'pick#:', nextPickNumber, 'round:', currentDraftRound);
		pickConfirmed = false;
		await submitPick(nextPickerTeam.id, pendingPickTeam.id, currentDraftRound, nextPickNumber);
		console.debug('[PICK] submitPick returned — pickSuccess:', pickSuccess, 'pickError:', pickError);
		pickConfirmed = true;
		setTimeout(() => { pickModalOpen = false; pickConfirmed = false; pendingPickTeam = null; }, 1800);
	}

	let teamSearch = $state('');

	let filteredTeams = $derived(() => {
		const q = teamSearch.toLowerCase().trim();
		let teams = data.teams;
		if (seedFilter !== null) {
			const group = SEED_GROUPS.find((g) => g.min === seedFilter);
			if (group) teams = teams.filter((t) => t.seed >= group.min && t.seed <= group.max);
		}
		if (regionFilter !== null) teams = teams.filter((t) => t.region === regionFilter);
		if (!q) return teams;
		return teams.filter(
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
		if (!teamId || draftedTeamIds.has(teamId) || !nextPickerTeam) { draggedTeamId = ''; return; }
		draggedTeamId = '';
		// Route through confirmation modal instead of submitting directly
		const team = data.teams.find((t) => t.id === teamId);
		if (!team) return;
		pendingPickTeam = { id: team.id, name: team.name, seed: team.seed, region: team.region };
		pickModalSearch = '';
		pickConfirmed = false;
		pickModalOpen = true;
	}

	// --- Timer ---
	let timeRemaining = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	let isLive = $derived(settings?.status === 'in_progress');
	let hasTimer = $derived((settings?.timer_seconds ?? 0) > 0);

	function updateTimer() {
		if (settings?.current_pick_deadline) {
			const deadline = new Date(settings.current_pick_deadline).getTime();
			timeRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
		} else if (isLive && (settings?.timer_seconds ?? 0) > 0 && timeRemaining > 0) {
			timeRemaining = Math.max(0, timeRemaining - 1);
		}
	}

	// Snap timer immediately when deadline or live status changes
	$effect(() => {
		const deadline = settings?.current_pick_deadline;
		const live = isLive;
		const secs = settings?.timer_seconds ?? 0;

		if (deadline) {
			const computed = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
			console.debug('[TIMER] deadline from server:', deadline, '→ timeRemaining =', computed, 's');
			timeRemaining = computed;
		} else if (live && secs > 0 && timeRemaining === 0) {
			console.debug('[TIMER] no deadline yet, seeding from timer_seconds =', secs);
			timeRemaining = secs;
		} else {
			console.debug('[TIMER] $effect fired — live:', live, 'deadline:', deadline, 'secs:', secs, 'timeRemaining:', timeRemaining);
		}
	});

	onMount(() => {
		// Kick off an immediate fetch so the timer starts as soon as the page loads
		invalidateAll().then(() => updateTimer());
		timerInterval = setInterval(updateTimer, 1000);
		refreshQuickPick();
		pollInterval = setInterval(async () => {
			if (settings?.status !== 'completed') {
				await invalidateAll();
				updateTimer();
			}
		}, 2000);
	});

	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
		if (pollInterval) clearInterval(pollInterval);
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

	// --- Pick Assignment Panel ---
	// Shown when draft is live; admin drags NCAA teams onto pool team slots
	let pickAssignMode = $state(false);

	// ncaaTeamId being dragged in assign mode
	let assignDragId = $state('');
	// { poolTeamId, slot } being hovered
	let assignHoverKey = $state('');

	function assignDragStart(e: DragEvent, ncaaTeamId: string) {
		assignDragId = ncaaTeamId;
		e.dataTransfer!.effectAllowed = 'move';
		e.dataTransfer!.setData('text/plain', ncaaTeamId);
	}

	function assignDragOver(e: DragEvent, key: string) {
		e.preventDefault();
		assignHoverKey = key;
	}

	function assignDragLeave() {
		assignHoverKey = '';
	}

	// Returns picks already made for a given pool team (via user→poolTeam mapping)
	function picksForTeam(poolTeamId: string) {
		const userIds = (data.joinRequests ?? [])
			.filter((r) => r.pool_team === poolTeamId && r.status === 'approved')
			.map((r) => r.user);
		return data.picks.filter((p) => userIds.includes(p.user));
	}

	// Shared pick submission — posts directly to avoid DOM sync issues
	let pickPending = $state(false);
	let pickError = $state('');
	let pickSuccess = $state(false);
	let autoPickPending = $state(false);
	let autoPickError = $state('');

	// Quick Pick — a random available team, refreshed on demand
	let quickPickTeam = $state<typeof availableTeams[0] | null>(null);

	function refreshQuickPick() {
		if (availableTeams.length === 0) { quickPickTeam = null; return; }
		const idx = Math.floor(Math.random() * availableTeams.length);
		quickPickTeam = availableTeams[idx];
	}

	// Seed rank filter for Available Teams (null = all)
	let seedFilter = $state<number | null>(null);
	// Region filter for Available Teams (null = all)
	let regionFilter = $state<string | null>(null);

	const SEED_GROUPS = [
		{ label: '1–4', min: 1, max: 4 },
		{ label: '5–8', min: 5, max: 8 },
		{ label: '9–12', min: 9, max: 12 },
		{ label: '13–16', min: 13, max: 16 }
	] as const;

	async function submitPick(poolTeamId: string, ncaaTeamId: string, draftRound: number, pickNumber: number) {
		pickPending = true;
		pickError = '';
		pickSuccess = false;
		const fd = new FormData();
		fd.set('pool_team', poolTeamId);
		fd.set('team', ncaaTeamId);
		fd.set('draft_round', String(draftRound));
		fd.set('pick_number', String(pickNumber));
		try {
			console.debug('[PICK] fetching ?/makePick — pool_team:', poolTeamId, 'team:', ncaaTeamId, 'round:', draftRound, 'pick#:', pickNumber);
			const res = await fetch('?/makePick', {
				method: 'POST',
				body: fd,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const raw = await res.text();
			console.debug('[PICK] makePick raw response — status:', res.status, 'body:', raw);
			let json: Record<string, unknown> = {};
			try { json = JSON.parse(raw); } catch { console.error('[PICK] response was not JSON'); }

			// SvelteKit encodes action data with devalue — the `data` field may be a JSON string
			// that itself encodes the form return value as an array of [key, value] pairs.
			let actionData: Record<string, unknown> = {};
			try {
				const raw_data = json?.data;
				if (typeof raw_data === 'string') {
					// devalue compact format: parse the string then walk the array
					const parsed = JSON.parse(raw_data);
					if (Array.isArray(parsed)) {
						// flat key-value pairs: ["pickError", "msg", ...]
						for (let i = 0; i < parsed.length - 1; i += 2) {
							actionData[parsed[i]] = parsed[i + 1];
						}
					}
				} else if (raw_data && typeof raw_data === 'object') {
					actionData = raw_data as Record<string, unknown>;
				}
			} catch { /* ignore parse errors */ }

			if (json?.type === 'failure' || json?.type === 'error') {
				pickError = (actionData?.pickError as string) ?? `Pick failed (status ${res.status})`;
				console.error('[PICK] pick failed — actionData:', JSON.stringify(actionData), 'full json:', JSON.stringify(json));
			} else {
				pickSuccess = true;
				console.debug('[PICK] pick success — calling invalidateAll');
				pickModalOpen = false;
				pendingPickTeam = null;
				await invalidateAll();
				console.debug('[PICK] invalidateAll done — picks now:', data.picks.length);
			}
		} catch (e) {
			pickError = 'Network error';
			console.error('[PICK] fetch error:', e);
		} finally {
			pickPending = false;
		}
	}

	async function assignDrop(e: DragEvent, poolTeamId: string) {
		e.preventDefault();
		assignHoverKey = '';
		const ncaaTeamId = e.dataTransfer!.getData('text/plain') || assignDragId;
		assignDragId = '';
		if (!ncaaTeamId || draftedTeamIds.has(ncaaTeamId)) return;
		const teamPicks = picksForTeam(poolTeamId);
		if (teamPicks.length >= 6) return;
		const teamDraftRound = teamPicks.length + 1;
		const nextPick = data.picks.length + 1;
		await submitPick(poolTeamId, ncaaTeamId, teamDraftRound, nextPick);
	}
</script>

<svelte:head>
	<title>Admin - Draft Board</title>
</svelte:head>

<div class="space-y-6">

	<Separator />

	<!-- Draft Status Bar -->
	<div class="flex items-end gap-6">
		<div class="flex items-center gap-4 ml-auto">
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



	{#if !isLive}
	<!-- Pre-draft controls: timer + lottery order + start draft in one row -->
	{#if settings && (isNotStarted || isPaused)}
	<Card.Card>
		<Card.CardContent class="pt-4 pb-4">
			<div class="flex flex-col lg:flex-row gap-4">

				<!-- Pick Timer (compact inline) -->
				<div class="shrink-0 lg:w-48">
					<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pick Timer</p>
					<form method="POST" action="?/updateSettings" use:enhance class="space-y-1.5">
						<input type="hidden" name="settings_id" value={settings.id} />
						<input type="hidden" name="timer_seconds" value={selectedTimer} />
						<div class="flex flex-wrap gap-1.5">
							{#each TIMER_PRESETS as preset}
								<button
									type="button"
									onclick={() => (selectedTimer = preset.value)}
									class="rounded-md border px-3 py-1.5 text-sm transition-colors
										{selectedTimer === preset.value
										? 'border-primary bg-primary text-primary-foreground'
										: 'border-input hover:bg-muted'}"
								>
									{preset.label}
								</button>
							{/each}
						</div>
						<Button type="submit" variant="outline" size="sm" class="w-full mt-1">Save</Button>
						{#if form?.settingsSuccess}<p class="text-xs text-accent mt-1">Saved!</p>{/if}
					</form>
				</div>

				<div class="hidden lg:block w-px bg-border self-stretch"></div>

				<!-- Lottery Order -->
				{#if isNotStarted}
				{@const orderConfirmed = (data.draftOrders ?? []).filter((o) => o.round_group === 1).length === (data.poolTeams ?? []).length}
				<div class="flex-1 min-w-0">
					<div class="flex items-center justify-between gap-2 mb-2">
						<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
							<Shuffle class="h-3 w-3" /> Lottery Order (Group 1)
							{#if orderConfirmed}<span class="text-accent normal-case font-normal">✅ Confirmed</span>{/if}
						</p>
						<Button variant="outline" size="sm" class="h-7 px-2 text-xs gap-1 shrink-0" onclick={randomizeDraftOrder}>
							<Shuffle class="h-3 w-3" /> Randomize
						</Button>
					</div>
					<ol class="grid grid-cols-2 sm:grid-cols-5 gap-1 mb-2">
						{#each draftOrder as teamId, i}
							{@const pt = (data.poolTeams ?? []).find((t) => t.id === teamId)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<li
								draggable="true"
								ondragstart={(e) => orderDragStart(e, teamId)}
								ondragover={(e) => orderDragOver(e, i)}
								ondrop={() => orderDrop(i)}
								ondragend={() => { orderDraggedId = ''; orderDragOverIdx = -1; }}
								class="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing transition-colors
									{orderDragOverIdx === i ? 'bg-primary/20 border border-primary' : 'bg-muted/40 hover:bg-muted/70'}"
							>
								<span class="w-4 shrink-0 text-right text-muted-foreground font-mono">{i + 1}</span>
								<span class="truncate font-medium">{pt?.name ?? teamId}</span>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-muted-foreground/40 shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
								</svg>
							</li>
						{/each}
					</ol>
					<form method="POST" action="?/saveOrder" use:enhance={() => {
							confirmingOrder = true;
							return async ({ update }) => { await update(); confirmingOrder = false; };
						}}>
						<input type="hidden" name="round_group" value="1" />
						<input type="hidden" name="ordered_team_ids" value={draftOrder.join(',')} />
						<Button type="submit" variant={orderConfirmed ? 'outline' : 'default'} size="sm" class="w-full" disabled={confirmingOrder}>
							{#if confirmingOrder}<LoaderCircle class="h-3.5 w-3.5 animate-spin mr-1.5" />Saving…
							{:else}{orderConfirmed ? 'Re-confirm Order' : 'Confirm Order'}{/if}
						</Button>
						{#if form?.orderError}<p class="mt-1 text-xs text-destructive">{form.orderError}</p>{/if}
					</form>
				</div>

				<div class="hidden lg:block w-px bg-border self-stretch"></div>

				<!-- Start Draft -->
				{@const poolReady = isPoolDraftReady(data.poolTeams ?? [], data.joinRequests ?? [])}
				<div class="shrink-0 lg:w-44 flex flex-col gap-2 justify-center">
					{#if !poolReady}
						<p class="text-xs text-amber-600 dark:text-amber-400 text-center">
							⚠️ {(data.joinRequests ?? []).filter(r => r.status === 'approved').map(r => r.pool_team).filter((v, i, a) => a.indexOf(v) === i).length}/{data.poolTeams?.length ?? 0} teams approved
						</p>
					{/if}
					{#if !orderConfirmed}
						<p class="text-xs text-muted-foreground text-center">Confirm order to unlock.</p>
					{/if}
					<form method="POST" action="?/startDraft" use:enhance={() => {
							startingDraft = true;
							return async ({ update }) => { await update(); startingDraft = false; };
						}}>
						<input type="hidden" name="settings_id" value={settings.id} />
						<input type="hidden" name="timer_seconds" value={selectedTimer} />
						<input type="hidden" name="ordered_team_ids" value={draftOrder.join(',')} />
						<Button type="submit" class="w-full" disabled={!orderConfirmed || startingDraft}>
							{#if startingDraft}<LoaderCircle class="h-4 w-4 animate-spin mr-2" />Starting…
							{:else}Start Draft{/if}
						</Button>
						{#if form?.startError}<p class="mt-1 text-xs text-destructive">{form.startError}</p>{/if}
					</form>
				</div>
				{/if}

				<!-- Resume (paused state) -->
				{#if isPaused}
				<div class="shrink-0 lg:w-44 flex flex-col justify-center">
					<form method="POST" action="?/resumeDraft" use:enhance>
						<input type="hidden" name="settings_id" value={settings.id} />
						<input type="hidden" name="timer_seconds" value={selectedTimer} />
						<Button type="submit" class="w-full" size="sm">Resume Draft</Button>
					</form>
				</div>
				{/if}

			</div>
		</Card.CardContent>
	</Card.Card>
	{/if}
	{/if}

	<!-- Draft Log -->
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
				<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
					{#each [...data.picks].reverse() as pick}
						{@const team = pick.expand?.team}
						{@const pickPoolTeam = pick.expand?.pool_team ?? (data.poolTeams ?? []).find((t) => t.id === pick.pool_team)}
						{@const roundGroup = Math.ceil((pick.draft_round ?? 1) / 2)}
						{@const regionColor = team?.region === 'East' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : team?.region === 'West' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : team?.region === 'South' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}
						{@const groupColor = roundGroup === 1 ? 'bg-blue-500/15 text-blue-400' : roundGroup === 2 ? 'bg-purple-500/15 text-purple-400' : 'bg-orange-500/15 text-orange-400'}
						<div class="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5 shadow-sm">
							<!-- Pick number + group + undo -->
							<div class="flex items-center justify-between gap-1">
								<div class="flex items-center gap-1.5">
									<span class="text-xs font-mono text-muted-foreground">#{pick.pick_number}</span>
									<span class="rounded px-1 py-0.5 text-xs font-bold leading-none {groupColor}">G{roundGroup}</span>
								</div>
								<form method="POST" action="?/undoPick" use:enhance class="shrink-0">
									<input type="hidden" name="pick_id" value={pick.id} />
									<button type="submit" class="text-xs text-destructive/40 hover:text-destructive transition-colors">undo</button>
								</form>
							</div>
							<!-- Team name + seed -->
							<div class="flex items-baseline gap-1.5">
								<span class="text-lg font-bold leading-tight tabular-nums text-muted-foreground/50">#{team?.seed ?? '?'}</span>
								<span class="font-semibold text-sm leading-tight">{team?.name ?? '?'}</span>
							</div>
							<!-- Region badge + pool team -->
							<div class="flex items-center justify-between gap-1 mt-0.5">
								<span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium {regionColor}">{team?.region ?? '—'}</span>
								<span class="text-xs text-muted-foreground truncate max-w-[60%] text-right">{pickPoolTeam?.name ?? '?'}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card.CardContent>
	</Card.Card>

	<!-- Toggle between live draft view and pick assignment view -->
	{#if isLive && !draftComplete}
		<div class="flex items-center gap-3">
			<Button
				variant={pickAssignMode ? 'default' : 'outline'}
				size="sm"
				onclick={() => (pickAssignMode = !pickAssignMode)}
			>
				{pickAssignMode ? '← Back to Draft Board' : 'Assign Picks →'}
			</Button>
			{#if pickAssignMode}
				<span class="text-xs text-muted-foreground">Drag an NCAA team onto a pool team's open slot to record the pick.</span>
			{/if}
		</div>
	{/if}

	<!-- Pick Assignment Panel -->
	{#if pickAssignMode && isLive && !draftComplete}
		<div class="grid gap-4 lg:grid-cols-[1fr_1fr]">
			<!-- Left: Available NCAA teams by region -->
			<div class="space-y-3">
				<h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Available Teams</h3>
				{#each REGIONS as region}
					{@const regionTeams = availableTeams.filter((t) => t.region === region)}
					{#if regionTeams.length > 0}
						<div class="rounded-lg border overflow-hidden">
							<div class="bg-muted/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{region}</div>
							<div class="divide-y">
								{#each regionTeams.sort((a, b) => a.seed - b.seed) as ncaaTeam}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										draggable="true"
										ondragstart={(e) => assignDragStart(e, ncaaTeam.id)}
										ondragend={() => (assignDragId = '')}
										class="flex items-center gap-2 px-3 py-2 text-sm cursor-grab active:cursor-grabbing select-none transition-colors
											{assignDragId === ncaaTeam.id ? 'opacity-40' : 'hover:bg-accent/10'}"
									>
										<span class="w-5 text-right text-xs font-mono text-muted-foreground shrink-0">{ncaaTeam.seed}</span>
										<span class="flex-1 font-medium truncate">{ncaaTeam.name}</span>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
										</svg>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
				{#if availableTeams.length === 0}
					<p class="text-sm text-muted-foreground text-center py-4">All teams have been drafted.</p>
				{/if}
			</div>

			<!-- Right: Pool team rosters as drop targets -->
			<div class="space-y-3">
				<h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pool Team Rosters</h3>
				{#each (data.poolTeams ?? []) as pt}
					{@const teamPicks = picksForTeam(pt.id)}
					{@const slotsLeft = 6 - teamPicks.length}
					{@const isOnClock = nextPickerTeam?.id === pt.id}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="rounded-lg border overflow-hidden transition-all
							{isOnClock ? 'border-primary shadow-sm' : 'border-border'}
							{assignHoverKey === pt.id && slotsLeft > 0 ? 'ring-2 ring-primary bg-primary/5' : ''}"
						ondragover={(e) => slotsLeft > 0 && assignDragOver(e, pt.id)}
						ondragleave={assignDragLeave}
						ondrop={(e) => slotsLeft > 0 && assignDrop(e, pt.id)}
					>
						<div class="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
							<span class="text-xs font-semibold truncate {isOnClock ? 'text-primary' : ''}">{pt.name}</span>
							<span class="text-xs text-muted-foreground shrink-0 ml-2">{teamPicks.length}/6</span>
						</div>
						<div class="divide-y">
							{#each teamPicks as pick}
								{@const ncaaTeam = data.teams.find((t) => t.id === pick.team)}
								<div class="flex items-center gap-2 px-3 py-1.5 text-xs bg-card">
									<span class="w-4 text-right font-mono text-muted-foreground">{ncaaTeam?.seed}</span>
									<span class="flex-1 truncate">{ncaaTeam?.name ?? '?'}</span>
									<span class="text-muted-foreground/60 shrink-0">{ncaaTeam?.region}</span>
								</div>
							{/each}
							{#if slotsLeft > 0}
								<div class="flex items-center justify-center px-3 py-2 text-xs text-muted-foreground/60
									{assignHoverKey === pt.id ? 'bg-primary/10 text-primary font-medium' : 'bg-muted/20'}">
									{assignHoverKey === pt.id ? 'Drop to assign' : `${slotsLeft} slot${slotsLeft > 1 ? 's' : ''} open`}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Main Grid: Controls | Available Teams (wide) | Pick Bucket -->
	{#if !pickAssignMode}

	<!-- When live: compact controls row above the main two-column layout -->
	{#if isLive && settings}
		<div class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
			<!-- Pause -->
			<form method="POST" action="?/pauseDraft" use:enhance>
				<input type="hidden" name="settings_id" value={settings.id} />
				<Button type="submit" variant="outline" size="sm" class="h-7 text-xs">Pause</Button>
			</form>
			<!-- Group order status badges -->
			{#each [2, 3].filter((g) => g > currentRoundGroup) as group}
				{@const hasOrder = (data.draftOrders ?? []).filter((o) => o.round_group === group).length === entryCount}
				{#if hasOrder}
					<span class="text-xs rounded px-2 py-0.5 bg-muted text-muted-foreground">G{group} ✅</span>
				{/if}
			{/each}
			<!-- Current pick order (inline) -->
			{#if currentGroupOrders.length > 0}
				{@const sorted = currentGroupOrders.slice().sort((a, b) => a.position - b.position)}
				{@const row1 = sorted.slice(0, 5)}
				{@const row2 = sorted.slice(5)}
				<div class="ml-2 border-l pl-2 space-y-0.5">
					<span class="text-xs text-muted-foreground font-medium">Order:</span>
					<div class="flex flex-wrap gap-1">
						{#each row1 as order}
							{@const pt = (data.poolTeams ?? []).find((t) => t.id === order.pool_team)}
							{@const isOnClock = nextPickerTeam?.id === order.pool_team}
							<span class="text-xs rounded px-1.5 py-0.5
								{isOnClock ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'}">
								{order.position}. {pt?.name ?? '?'}
							</span>
						{/each}
					</div>
					{#if row2.length > 0}
						<div class="flex flex-wrap gap-1">
							{#each row2 as order}
								{@const pt = (data.poolTeams ?? []).find((t) => t.id === order.pool_team)}
								{@const isOnClock = nextPickerTeam?.id === order.pool_team}
								<span class="text-xs rounded px-1.5 py-0.5
									{isOnClock ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'}">
									{order.position}. {pt?.name ?? '?'}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
			<!-- Restart (right-aligned) -->
			<form method="POST" action="?/resetDraft" use:enhance class="ml-auto"
				onsubmit={(e) => { if (!confirm('Reset the entire draft? This deletes all picks and orders.')) e.preventDefault(); }}>
				<input type="hidden" name="settings_id" value={settings.id} />
				<Button type="submit" variant="destructive" size="sm" class="h-7 text-xs">Restart Draft</Button>
			</form>
			{#if form?.resetError}
				<p class="text-xs text-destructive">{form.resetError}</p>
			{/if}
		</div>
	{/if}

	<!-- Next Group Order Panel: appears during last round of current group -->
	{#if showNextGroupPanel && nextGroup !== null}
		{@const groupColors = ['', 'text-blue-600', 'text-purple-600', 'text-orange-600']}
		{@const groupBg = ['', 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30', 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30', 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30']}
		{@const badgeCls = ['', 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400', 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400']}
		<div class="rounded-xl border-2 {groupBg[nextGroup]} p-4 space-y-3">
			<div class="flex items-center justify-between gap-3 flex-wrap">
				<div class="flex items-center gap-2">
					<span class="rounded font-bold text-xs px-2 py-0.5 {badgeCls[nextGroup]}">G{nextGroup}</span>
					<div>
						<p class="font-bold text-sm {groupColors[nextGroup]}">Lottery Order (Group {nextGroup})</p>
						{#if nextGroup === currentRoundGroup}
							<p class="text-xs text-destructive font-medium">⚠️ No order set for this group — set it to resume picks</p>
						{:else}
							<p class="text-xs text-muted-foreground">{picksRemainingInGroup} pick{picksRemainingInGroup === 1 ? '' : 's'} left in Group {currentRoundGroup} — set the order before it ends</p>
						{/if}
					</div>
				</div>
				<div class="flex items-center gap-2">
					{#if nextGroupHasOrder}
						<span class="text-xs text-accent font-medium">✅ Confirmed</span>
					{/if}
					<Button variant="outline" size="sm" class="h-7 px-2 text-xs gap-1" onclick={randomizeNextGroupOrder}>
						<Shuffle class="h-3 w-3" /> Randomize
					</Button>
				</div>
			</div>

			<!-- Drag list -->
			<ol class="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
				{#each nextGroupOrder as teamId, i}
					{@const pt = (data.poolTeams ?? []).find((t) => t.id === teamId)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<li
						draggable="true"
						ondragstart={(e) => nextGroupDragStart(e, teamId)}
						ondragover={(e) => nextGroupDragOver(e, i)}
						ondrop={() => nextGroupDrop(i)}
						ondragend={() => { nextGroupDraggedId = ''; nextGroupDragOverIdx = -1; }}
						class="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs cursor-grab active:cursor-grabbing transition-colors
							{nextGroupDragOverIdx === i ? 'bg-primary/20 border-2 border-primary' : 'bg-background border border-border hover:border-primary/40'}"
					>
						<span class="w-4 text-right text-muted-foreground font-mono shrink-0">{i + 1}</span>
						<span class="flex-1 truncate font-medium">{pt?.name ?? teamId}</span>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-muted-foreground/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
						</svg>
					</li>
				{/each}
			</ol>

			<!-- Confirm button -->
			<form method="POST" action="?/saveOrder" use:enhance={() => {
					nextGroupConfirmingOrder = true;
					return async ({ update }) => {
						await update();
						nextGroupConfirmingOrder = false;
					};
				}}>
				<input type="hidden" name="round_group" value={nextGroup} />
				<input type="hidden" name="ordered_team_ids" value={nextGroupOrder.join(',')} />
				<Button type="submit" class="w-full sm:w-auto" size="sm"
					variant={nextGroupHasOrder ? 'outline' : 'default'}
					disabled={nextGroupConfirmingOrder}>
					{#if nextGroupConfirmingOrder}
						<LoaderCircle class="h-3.5 w-3.5 animate-spin mr-1.5" />Saving…
					{:else}
						{nextGroupHasOrder ? `Re-confirm Group ${nextGroup} Order` : `Confirm Group ${nextGroup} Order`}
					{/if}
				</Button>
			</form>
		</div>
	{/if}

	<div class="{isLive ? 'grid gap-6 lg:grid-cols-[1fr_320px]' : 'space-y-6'}">
		<!-- Available Teams -->
			<Card.Card>
				<Card.CardHeader class="pb-2">
					<div class="flex items-center justify-between gap-3 flex-wrap">
						<Card.CardTitle class="{isLive ? 'text-xl' : ''}">
							Available ({availableTeams.length})
						</Card.CardTitle>
						<input
							type="text"
							placeholder="Search teams..."
							bind:value={teamSearch}
							class="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring {isLive ? 'w-56' : 'w-48'}"
						/>
					</div>
					<!-- Filter chips: seed tiers + regions -->
					<div class="flex flex-wrap items-center gap-1.5 pt-2">
						<span class="text-xs text-muted-foreground mr-0.5">Seed:</span>
						{#each SEED_GROUPS as g}
							<button
								type="button"
								onclick={() => seedFilter = seedFilter === g.min ? null : g.min}
								class="rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors
									{seedFilter === g.min
										? 'bg-primary text-primary-foreground border-primary'
										: 'bg-muted/60 text-muted-foreground border-transparent hover:border-primary/40 hover:text-foreground'}"
							>#{g.label}</button>
						{/each}
						<span class="w-px bg-border mx-1 self-stretch"></span>
						<span class="text-xs text-muted-foreground mr-0.5">Region:</span>
						{#each REGIONS as r}
							<button
								type="button"
								onclick={() => regionFilter = regionFilter === r ? null : r}
								class="rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors
									{regionFilter === r
										? 'bg-accent text-accent-foreground border-accent'
										: 'bg-muted/60 text-muted-foreground border-transparent hover:border-accent/40 hover:text-foreground'}"
							>{r}</button>
						{/each}
						{#if seedFilter !== null || regionFilter !== null}
							<button
								type="button"
								onclick={() => { seedFilter = null; regionFilter = null; }}
								class="rounded-full px-2.5 py-0.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors border border-transparent"
							>✕ Clear</button>
						{/if}
					</div>
				</Card.CardHeader>
				<Card.CardContent>
					<div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
						{#each REGIONS as region}
							{@const regionTeams = filteredTeams().filter((t) => t.region === region)}
							{#if regionTeams.length > 0}
								<div>
									<p class="mb-2 font-bold uppercase tracking-widest text-primary border-b border-primary/20 pb-1 {isLive ? 'text-sm' : 'text-xs'}">
										{region}
									</p>
									<div class="{isLive ? 'space-y-1' : 'space-y-0.5'}">
										{#each regionTeams as team}
											{@const drafted = draftedTeamIds.has(team.id)}
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div
												class="flex items-center gap-1.5 rounded transition-all
													{isLive ? 'px-2 py-1.5 text-base' : 'px-2 py-1 text-sm'}
													{drafted
													? 'line-through opacity-25'
													: isLive
														? 'hover:bg-primary/10 cursor-grab active:cursor-grabbing hover:shadow-sm font-medium'
														: 'hover:bg-muted/50'}"
												draggable={!drafted && isLive}
												ondragstart={(e) => !drafted && handleDragStart(e, team.id)}
												ondragend={() => (draggedTeamId = '')}
												role={drafted ? undefined : 'listitem'}
											>
												<span class="shrink-0 rounded font-mono text-xs font-bold px-1 py-0.5
													{drafted ? 'text-muted-foreground' :
													 team.seed <= 4 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
													 team.seed <= 8 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
													 team.seed <= 12 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
													 'bg-muted text-muted-foreground'}">{team.seed}</span>
												<span class="flex-1 truncate">{team.name}</span>
												{#if !drafted && isLive}
													<!-- Drag handle: hidden on small screens -->
													<svg xmlns="http://www.w3.org/2000/svg" class="hidden sm:block h-3.5 w-3.5 text-muted-foreground/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
														<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
													</svg>
													<!-- Pick button: shown on small screens instead of drag -->
													<button
														type="button"
														class="sm:hidden shrink-0 rounded bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground hover:bg-primary/80 disabled:opacity-40"
														disabled={pickPending || !nextPickerTeam}
														onclick={() => nextPickerTeam && submitPick(
															nextPickerTeam.id,
															team.id,
															nextPickerOrder?.draft_round ?? 1,
															(data.picks.length + 1)
														)}
													>Pick</button>
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

		<!-- On the Clock + Drop Zone -->
		<div class="sticky top-4 space-y-3">
			{#if draftComplete}
				<div class="rounded-xl border-2 border-accent/30 bg-accent/5 p-8 text-center">
					<p class="text-sm font-medium text-accent">All {totalPicks} picks made!</p>
				</div>

			{:else if isLive && nextPickerTeam}
				<!-- On the Clock card -->
				<div class="rounded-xl border-2 border-primary bg-primary/5 overflow-hidden">
					<!-- Header: team name + pick info -->
					<div class="px-4 pt-4 pb-3 border-b border-primary/10">
						<p class="text-xs uppercase tracking-wider text-muted-foreground font-medium">On the Clock</p>
						<p class="text-2xl font-bold text-primary leading-tight mt-0.5">{nextPickerTeam.name}</p>
						{#if nextPickerMembers.length > 0}
							<p class="text-sm text-muted-foreground mt-0.5">{nextPickerMembers.join(' & ')}</p>
						{/if}
						<div class="flex items-center gap-3 mt-2">
							<span class="text-xs bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">
								Pick #{nextPickNumber}
							</span>
							<span class="text-xs text-muted-foreground">
								Round {currentDraftRound} · {isReverseRound ? '← reverse' : 'forward →'}
							</span>
						</div>
					</div>

					<!-- Timer -->
					{#if hasTimer}
						<div class="px-4 py-3 border-b border-primary/10 flex items-center justify-between">
							<span class="text-xs uppercase tracking-wider text-muted-foreground">Time Left</span>
							<span class="text-3xl font-mono font-bold {timeRemaining <= 10
								? 'text-destructive animate-pulse'
								: timeRemaining <= 30
									? 'text-orange-500'
									: 'text-primary'}">
								{formatTime(timeRemaining)}
							</span>
						</div>
					{/if}

					<!-- Pick Team button (always visible, opens modal) -->
					<div class="px-4 py-3 border-b border-primary/10">
						<Button onclick={openPickModal} class="w-full" disabled={pickPending}>
							<ListFilter class="h-4 w-4 mr-2" />
							Pick Team
						</Button>
					</div>

					<!-- Drop zone (desktop drag-and-drop) -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="hidden sm:flex flex-col items-center justify-center p-8 transition-colors
							{dropHover ? 'bg-primary/15' : 'bg-transparent'}"
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={handleDrop}
						role="region"
						aria-label="Drop zone for team pick"
					>
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
							<p class="text-xs text-muted-foreground mt-1">from the board on the left</p>
						{/if}
					</div>

					<!-- Quick Pick — random team button -->
					<div class="px-4 pb-4 flex flex-col gap-2">
						{#if timerExpired}
							<form method="POST" action="?/autoPick" use:enhance={() => {
									autoPickPending = true; autoPickError = '';
									return async ({ result, update }) => {
										await update();
										autoPickPending = false;
										if (result.type === 'failure') autoPickError = (result.data as Record<string,string>)?.pickError ?? 'Quick pick failed';
										else setTimeout(() => location.reload(), 600);
									};
								}}>
								<Button variant="destructive" class="w-full" disabled={autoPickPending}>
									{#if autoPickPending}
										<LoaderCircle class="h-4 w-4 animate-spin mr-2" />Picking…
									{:else}
										Quick Pick (Time Expired)
									{/if}
								</Button>
							</form>
						{/if}

						<!-- Quick Pick: shows random team, click to go to confirmation -->
						{#if quickPickTeam}
							<div class="rounded-xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
								<div class="flex items-center justify-between px-3 pt-2 pb-1">
									<span class="text-xs uppercase tracking-wider text-muted-foreground font-medium">Quick Pick</span>
									<button type="button" onclick={refreshQuickPick}
										class="text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-muted"
										title="Shuffle">↺ shuffle</button>
								</div>
								<button
									type="button"
									disabled={pickPending}
									onclick={() => { pendingPickTeam = quickPickTeam; pickModalOpen = true; pickConfirmed = false; pickModalSearch = ''; }}
									class="w-full flex items-center gap-2 px-3 pb-3 pt-1 text-left hover:bg-primary/10 active:bg-primary/20 transition-colors disabled:opacity-40"
								>
									<span class="shrink-0 rounded font-mono text-xs font-bold px-1.5 py-0.5 {quickPickTeam.seed <= 4 ? 'bg-emerald-100 text-emerald-700' : quickPickTeam.seed <= 8 ? 'bg-blue-100 text-blue-700' : quickPickTeam.seed <= 12 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}">#{quickPickTeam.seed}</span>
									<span class="font-semibold flex-1 text-sm">{quickPickTeam.name}</span>
									<span class="rounded bg-muted text-muted-foreground text-xs px-1.5 py-0.5 shrink-0">{quickPickTeam.region.slice(0,1)}</span>
									<span class="text-xs text-primary shrink-0">→</span>
								</button>
							</div>
						{:else}
							<button type="button" onclick={refreshQuickPick}
								class="w-full rounded-xl border-2 border-dashed border-primary/30 py-3 text-xs text-muted-foreground hover:text-foreground hover:border-primary/60 transition-colors">
								↺ Get a random pick suggestion
							</button>
						{/if}
					</div>

					{#if pickPending}
						<p class="px-4 pb-3 text-sm text-muted-foreground text-center">Saving pick…</p>
					{:else if pickError}
						<p class="px-4 pb-3 text-sm text-destructive text-center">{pickError}</p>
					{:else if pickSuccess}
						<p class="px-4 pb-3 text-sm text-accent text-center">Pick confirmed!</p>
					{/if}
					{#if autoPickError}
						<p class="px-4 pb-3 text-sm text-destructive text-center">{autoPickError}</p>
					{/if}
				</div>

			{:else}
				<!-- Not started: show who picks first once draft begins -->
				{@const firstOrder = (data.draftOrders ?? []).find((o) => o.round_group === 1 && o.position === 1)}
				{@const firstTeam = firstOrder ? (data.poolTeams ?? []).find((t) => t.id === firstOrder.pool_team) : null}
				{@const firstMembers = firstTeam
					? (data.joinRequests ?? []).filter((r) => r.pool_team === firstTeam.id && r.status === 'approved').map((r) => r.expand?.user?.name ?? '?')
					: []}
				<div class="rounded-xl border-2 border-dashed border-primary/30 bg-muted/20 overflow-hidden">
					<div class="px-4 py-3 border-b border-primary/10">
						<p class="text-xs uppercase tracking-wider text-muted-foreground font-medium">Picks First</p>
						{#if firstTeam}
							<p class="text-xl font-bold text-primary/70 mt-0.5">{firstTeam.name}</p>
							{#if firstMembers.length > 0}
								<p class="text-sm text-muted-foreground">{firstMembers.join(' & ')}</p>
							{/if}
						{:else}
							<p class="text-sm text-muted-foreground mt-1">Confirm lottery order to see who picks first.</p>
						{/if}
					</div>
					<div class="flex flex-col items-center justify-center p-8 text-center">
						<div class="rounded-full bg-muted p-4 mb-3">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<p class="text-sm text-muted-foreground">Waiting for draft to start</p>
						<p class="text-xs text-muted-foreground/60 mt-1">Confirm order, then Start Draft</p>
					</div>
				</div>
			{/if}
		</div>
	</div>

	{/if}
</div>

<!-- Pick Team Modal (admin) -->
{#if pickModalOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
		role="dialog"
		aria-modal="true"
		aria-label="Pick a team"
		onclick={(e) => { if (e.target === e.currentTarget) pickModalOpen = false; }}
	>
		<div class="bg-card w-full rounded-t-2xl sm:rounded-2xl sm:max-w-sm sm:mb-8 shadow-2xl flex flex-col"
			style="max-height: 85dvh;">

			<!-- Drag handle (mobile only) -->
			<div class="flex justify-center pt-2.5 pb-1 shrink-0 sm:hidden">
				<div class="w-10 h-1 rounded-full bg-muted-foreground/30"></div>
			</div>

			<!-- Header -->
			<div class="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
				<div>
					<p class="font-bold text-base leading-tight">Pick a Team</p>
					{#if nextPickerTeam}
						<p class="text-xs text-muted-foreground">{nextPickerTeam.name} · Pick #{nextPickNumber} · Round {currentDraftRound}</p>
					{/if}
				</div>
				<button type="button" onclick={() => pickModalOpen = false}
					class="rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground active:scale-95 transition-all">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Search + region tabs: only shown on team grid step -->
			{#if !pendingPickTeam && !pickConfirmed}
				<div class="px-4 pb-2 shrink-0">
					<div class="relative">
						<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
						<input
							type="search"
							placeholder="Search teams…"
							bind:value={pickModalSearch}
							class="w-full rounded-xl border border-input bg-muted/50 pl-9 pr-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
				</div>

				{#if !pickModalSearch}
					<div class="flex gap-1.5 px-4 pb-2 shrink-0 overflow-x-auto">
						{#each PICK_REGIONS as r}
							<button
								type="button"
								onclick={() => pickModalRegion = r}
								class="shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors
									{pickModalRegion === r
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
							>{r}</button>
						{/each}
					</div>
				{/if}
			{/if}

			{#if pickConfirmed}
				<!-- Success state -->
				<div class="flex flex-col items-center justify-center flex-1 px-6 py-8 gap-3">
					<div class="rounded-full bg-accent/20 p-4">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<p class="text-lg font-bold text-accent">Pick Confirmed!</p>
					{#if pendingPickTeam}
						<p class="text-center text-sm text-muted-foreground">
							<span class="font-semibold text-foreground">#{pendingPickTeam.seed} {pendingPickTeam.name}</span><br/>
							{pendingPickTeam.region} · Pick #{nextPickNumber - 1}
						</p>
					{/if}
				</div>

			{:else if pendingPickTeam}
				<!-- Confirmation step -->
				<div class="flex flex-col flex-1 px-4 pb-4 pt-1 gap-3">
					<p class="text-xs text-muted-foreground text-center">Confirm your selection</p>

					<!-- Selected team card -->
					<div class="rounded-xl border-2 border-primary bg-primary/5 px-4 py-4 text-center">
						<p class="text-xs font-mono text-muted-foreground mb-0.5">#{pendingPickTeam.seed} · {pendingPickTeam.region}</p>
						<p class="text-2xl font-bold text-primary leading-tight">{pendingPickTeam.name}</p>
						{#if nextPickerTeam}
							<p class="text-xs text-muted-foreground mt-1">for {nextPickerTeam.name} · Pick #{nextPickNumber}</p>
						{/if}
					</div>

					<div class="flex gap-2">
						<button
							type="button"
							onclick={() => pendingPickTeam = null}
							disabled={pickPending}
							class="flex-1 rounded-xl border-2 border-muted bg-muted/50 py-2.5 text-sm font-semibold text-muted-foreground
								hover:bg-muted active:scale-95 transition-all disabled:opacity-40"
						>
							← Back
						</button>
						<button
							type="button"
							onclick={confirmPick}
							disabled={pickPending}
							class="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground
								hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60
								flex items-center justify-center gap-2"
						>
							{#if pickPending}
								<LoaderCircle class="h-4 w-4 animate-spin" />
								Submitting…
							{:else}
								Confirm Pick ✓
							{/if}
						</button>
					</div>

					{#if pickError}
						<p class="text-xs text-destructive text-center">{pickError}</p>
					{/if}
				</div>

			{:else}
				<!-- Team grid -->
				<div class="overflow-y-auto flex-1 px-3 pb-6 pt-1">
					{#if pickModalTeams.length === 0}
						<p class="text-sm text-muted-foreground text-center py-12">No available teams{pickModalSearch ? ` matching "${pickModalSearch}"` : ' in this region'}.</p>
					{:else}
						<div class="grid grid-cols-2 gap-2">
							{#each pickModalTeams as team (team.id)}
								<button
									type="button"
									onclick={() => pickModalSelect(team)}
									disabled={pickPending}
									class="flex flex-col items-start gap-0.5 rounded-xl border-2 border-transparent bg-muted/50 px-3 py-3
										hover:border-primary hover:bg-primary/10 active:scale-95 active:bg-primary/20
										transition-all text-left disabled:opacity-40"
								>
									<span class="text-xs font-mono text-muted-foreground">#{team.seed} · {team.region.slice(0,1)}</span>
									<span class="font-semibold text-sm leading-tight">{team.name}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
