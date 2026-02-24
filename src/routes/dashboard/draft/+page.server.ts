import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { draftPickSchema } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam, DraftPick, User, DraftOrder, DraftSettings, PoolEntry } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	await ensureAdminAuth();
	const userId = locals.user!.id;

	try {
		// Find user's pool
		const userEntries = await adminPb.collection('pool_entries').getFullList<PoolEntry>({
			filter: `user = "${userId}"`
		});
		const userPoolId = userEntries[0]?.pool ?? '';

		// Get all pool participants
		const poolEntries = userPoolId
			? await adminPb.collection('pool_entries').getFullList<PoolEntry>({
					filter: `pool = "${userPoolId}"`
				})
			: [];
		const poolParticipantIds = new Set(poolEntries.map((e) => e.user));

		const [teams, allPicks, participants, allOrders] = await Promise.all([
			adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
			adminPb.collection('draft_picks').getFullList<DraftPick>({
				sort: 'pick_number',
				expand: 'user,team'
			}),
			adminPb.collection('users').getFullList<User>({ filter: "role = 'participant'", sort: 'name' }),
			adminPb.collection('draft_orders').getFullList<DraftOrder>({
				sort: 'round_group,position',
				expand: 'user'
			})
		]);

		// Filter to pool
		const picks = allPicks.filter((p) => poolParticipantIds.has(p.user));
		const draftOrders = allOrders.filter((o) => poolParticipantIds.has(o.user));
		const poolParticipants = participants.filter((p) => poolParticipantIds.has(p.id));

		// Find draft settings for this pool
		let draftSettings: DraftSettings | null = null;
		try {
			const settingsList = await adminPb.collection('draft_settings').getFullList<DraftSettings>();
			draftSettings = settingsList.find((s) => s.pool === userPoolId) ?? null;
		} catch {
			// no settings
		}

		// Determine if this user is on the clock
		const entryCount = poolParticipants.length;
		const totalPicks = entryCount * 6;
		const draftComplete = picks.length >= totalPicks;
		let isOnTheClock = false;

		if (!draftComplete && draftSettings?.status === 'in_progress' && entryCount > 0) {
			const nextPickNumber = picks.length + 1;
			const draftRound = Math.min(Math.floor(picks.length / entryCount) + 1, 6);
			const pickInRound = picks.length % entryCount;
			const isReverse = draftRound % 2 === 0;
			const positionIndex = isReverse ? entryCount - 1 - pickInRound : pickInRound;
			const roundGroup = Math.ceil(draftRound / 2);
			const groupOrders = draftOrders.filter((o) => o.round_group === roundGroup);
			const order = groupOrders.find((o) => o.position === positionIndex + 1);
			if (order && order.user === userId) {
				isOnTheClock = true;
			}
		}

		const canPick = isOnTheClock && (draftSettings?.allow_user_pick ?? false);

		return {
			teams, picks, participants: poolParticipants, draftOrders,
			draftSettings, userId, isOnTheClock, canPick, entryCount
		};
	} catch {
		return {
			teams: [], picks: [], participants: [], draftOrders: [],
			draftSettings: null, userId: '', isOnTheClock: false, canPick: false, entryCount: 0
		};
	}
};

export const actions: Actions = {
	userPick: async ({ request, locals }) => {
		const userId = locals.user!.id;
		const formData = await request.formData();

		// Find user's pool
		const userEntries = await adminPb.collection('pool_entries').getFullList<PoolEntry>({
			filter: `user = "${userId}"`
		});
		const userPoolId = userEntries[0]?.pool ?? '';

		// Get pool participants
		const poolEntries = await adminPb.collection('pool_entries').getFullList<PoolEntry>({
			filter: `pool = "${userPoolId}"`
		});
		const poolParticipantIds = new Set(poolEntries.map((e) => e.user));

		const [allPicks, allOrders] = await Promise.all([
			adminPb.collection('draft_picks').getFullList<DraftPick>({ sort: 'pick_number' }),
			adminPb.collection('draft_orders').getFullList<DraftOrder>({ sort: 'round_group,position' })
		]);

		const picks = allPicks.filter((p) => poolParticipantIds.has(p.user));
		const draftOrders = allOrders.filter((o) => poolParticipantIds.has(o.user));

		let settingsList: DraftSettings[] = [];
		try {
			settingsList = await adminPb.collection('draft_settings').getFullList<DraftSettings>();
		} catch { /* */ }
		const settings = settingsList.find((s) => s.pool === userPoolId);

		if (!settings || settings.status !== 'in_progress') {
			return fail(400, { pickError: 'Draft is not active' });
		}
		if (!settings.allow_user_pick) {
			return fail(403, { pickError: 'User picks are not enabled' });
		}

		const entryCount = poolEntries.length;
		const totalPicks = entryCount * 6;
		const nextPickNumber = picks.length + 1;
		if (picks.length >= totalPicks) return fail(400, { pickError: 'Draft is complete' });

		const draftRound = Math.min(Math.floor(picks.length / entryCount) + 1, 6);
		const pickInRound = picks.length % entryCount;
		const isReverse = draftRound % 2 === 0;
		const positionIndex = isReverse ? entryCount - 1 - pickInRound : pickInRound;
		const roundGroup = Math.ceil(draftRound / 2);
		const groupOrders = draftOrders.filter((o) => o.round_group === roundGroup);
		const order = groupOrders.find((o) => o.position === positionIndex + 1);

		if (!order || order.user !== userId) {
			return fail(403, { pickError: 'It is not your turn to pick' });
		}

		const data = {
			user: userId,
			team: formData.get('team') as string,
			draft_round: draftRound,
			pick_number: nextPickNumber
		};

		const result = draftPickSchema.safeParse(data);
		if (!result.success) {
			return fail(400, { pickError: result.error.issues[0].message });
		}

		try {
			await adminPb.collection('draft_picks').create(result.data);

			// Advance deadline
			if (settings.timer_seconds > 0) {
				const deadline = new Date(Date.now() + settings.timer_seconds * 1000).toISOString();
				await adminPb.collection('draft_settings').update(settings.id, {
					current_pick_deadline: deadline
				});
			}

			return { pickSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to submit pick';
			return fail(500, { pickError: message });
		}
	}
};
