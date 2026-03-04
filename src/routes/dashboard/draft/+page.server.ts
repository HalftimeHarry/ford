import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { draftPickSchema } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam, DraftPick, User, DraftOrder, DraftSettings } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	await ensureAdminAuth();
	const userId = locals.user!.id;

	try {
		const [teams, picks, participants, draftOrders] = await Promise.all([
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

		let draftSettings: DraftSettings | null = null;
		try {
			const list = await adminPb.collection('draft_settings').getFullList<DraftSettings>();
			draftSettings = list[0] ?? null;
		} catch {
			// no settings yet
		}

		const entryCount = participants.length;
		const totalPicks = entryCount * 6;
		const draftComplete = picks.length >= totalPicks;
		let isOnTheClock = false;

		if (!draftComplete && draftSettings?.status === 'in_progress' && entryCount > 0) {
			const draftRound = Math.min(Math.floor(picks.length / entryCount) + 1, 6);
			const pickInRound = picks.length % entryCount;
			const isReverse = draftRound % 2 === 0;
			const positionIndex = isReverse ? entryCount - 1 - pickInRound : pickInRound;
			const roundGroup = Math.ceil(draftRound / 2);
			const groupOrders = draftOrders.filter((o) => o.round_group === roundGroup);
			const order = groupOrders.find((o) => o.position === positionIndex + 1);
			if (order && order.user === userId) isOnTheClock = true;
		}

		const canPick = isOnTheClock && (draftSettings?.allow_user_pick ?? false);

		return { teams, picks, participants, draftOrders, draftSettings, userId, isOnTheClock, canPick, entryCount };
	} catch {
		return {
			teams: [], picks: [], participants: [], draftOrders: [],
			draftSettings: null, userId: '', isOnTheClock: false, canPick: false, entryCount: 0
		};
	}
};

export const actions: Actions = {
	userPick: async ({ request, locals }) => {
		await ensureAdminAuth();
		const userId = locals.user!.id;
		const formData = await request.formData();

		const [allPicks, allOrders, participants] = await Promise.all([
			adminPb.collection('draft_picks').getFullList<DraftPick>({ sort: 'pick_number' }),
			adminPb.collection('draft_orders').getFullList<DraftOrder>({ sort: 'round_group,position' }),
			adminPb.collection('users').getFullList<User>({ filter: "role = 'participant'" })
		]);

		let settings: DraftSettings | null = null;
		try {
			const list = await adminPb.collection('draft_settings').getFullList<DraftSettings>();
			settings = list[0] ?? null;
		} catch { /* */ }

		if (!settings || settings.status !== 'in_progress') {
			return fail(400, { pickError: 'Draft is not active' });
		}
		if (!settings.allow_user_pick) {
			return fail(403, { pickError: 'User picks are not enabled' });
		}

		const entryCount = participants.length;
		const totalPicks = entryCount * 6;
		if (allPicks.length >= totalPicks) return fail(400, { pickError: 'Draft is complete' });

		const draftRound = Math.min(Math.floor(allPicks.length / entryCount) + 1, 6);
		const pickInRound = allPicks.length % entryCount;
		const isReverse = draftRound % 2 === 0;
		const positionIndex = isReverse ? entryCount - 1 - pickInRound : pickInRound;
		const roundGroup = Math.ceil(draftRound / 2);
		const groupOrders = allOrders.filter((o) => o.round_group === roundGroup);
		const order = groupOrders.find((o) => o.position === positionIndex + 1);

		if (!order || order.user !== userId) {
			return fail(403, { pickError: 'It is not your turn to pick' });
		}

		const data = {
			user: userId,
			team: formData.get('team') as string,
			draft_round: draftRound,
			pick_number: allPicks.length + 1
		};

		const result = draftPickSchema.safeParse(data);
		if (!result.success) return fail(400, { pickError: result.error.issues[0].message });

		try {
			await adminPb.collection('draft_picks').create(result.data);
			if (settings.timer_seconds > 0) {
				const deadline = new Date(Date.now() + settings.timer_seconds * 1000).toISOString();
				await adminPb.collection('draft_settings').update(settings.id, { current_pick_deadline: deadline });
			}
			return { pickSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to submit pick';
			return fail(500, { pickError: message });
		}
	}
};
