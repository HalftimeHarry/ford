import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { draftPickSchema } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam, DraftPick, DraftOrder, DraftSettings, PoolTeam, JoinRequest } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	await ensureAdminAuth();
	const userId = locals.user!.id;

	try {
		const [teams, picks, poolTeams, joinRequests, draftOrders] = await Promise.all([
			adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
			adminPb.collection('draft_picks').getFullList<DraftPick>({
				sort: 'pick_number',
				expand: 'user,team,pool_team'
			}),
			adminPb.collection('pool_teams').getFullList<PoolTeam>({ sort: 'name' }),
			adminPb.collection('join_requests').getFullList<JoinRequest>({ expand: 'user,pool_team' }),
			adminPb.collection('draft_orders').getFullList<DraftOrder>({
				sort: 'round_group,position',
				expand: 'pool_team'
			})
		]);

		let draftSettings: DraftSettings | null = null;
		try {
			const list = await adminPb.collection('draft_settings').getFullList<DraftSettings>();
			draftSettings = list[0] ?? null;
		} catch {
			// no settings yet
		}

		// Find this user's pool team (approved join request)
		const myRequest = joinRequests.find((r) => r.user === userId && r.status === 'approved');
		const myPoolTeamId = myRequest?.pool_team ?? null;

		const entryCount = poolTeams.length;
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
			if (order && myPoolTeamId && order.pool_team === myPoolTeamId) isOnTheClock = true;
		}

		const canPick = isOnTheClock && (draftSettings?.allow_user_pick ?? false);

		return {
			teams, picks, poolTeams, joinRequests, draftOrders, draftSettings,
			userId, myPoolTeamId, isOnTheClock, canPick, entryCount
		};
	} catch {
		return {
			teams: [], picks: [], poolTeams: [], joinRequests: [], draftOrders: [],
			draftSettings: null, userId: '', myPoolTeamId: null,
			isOnTheClock: false, canPick: false, entryCount: 0
		};
	}
};

export const actions: Actions = {
	userPick: async ({ request, locals }) => {
		await ensureAdminAuth();
		const userId = locals.user!.id;
		const formData = await request.formData();

		const [allPicks, allOrders, poolTeams, joinRequests] = await Promise.all([
			adminPb.collection('draft_picks').getFullList<DraftPick>({ sort: 'pick_number' }),
			adminPb.collection('draft_orders').getFullList<DraftOrder>({ sort: 'round_group,position' }),
			adminPb.collection('pool_teams').getFullList<PoolTeam>(),
			adminPb.collection('join_requests').getFullList<JoinRequest>({
				filter: `user = "${userId}" && status = "approved"`
			})
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

		const myPoolTeamId = joinRequests[0]?.pool_team ?? null;
		if (!myPoolTeamId) return fail(403, { pickError: 'You are not on an approved pool team' });

		const entryCount = poolTeams.length;
		const totalPicks = entryCount * 6;
		if (allPicks.length >= totalPicks) return fail(400, { pickError: 'Draft is complete' });

		const draftRound = Math.min(Math.floor(allPicks.length / entryCount) + 1, 6);
		const pickInRound = allPicks.length % entryCount;
		const isReverse = draftRound % 2 === 0;
		const positionIndex = isReverse ? entryCount - 1 - pickInRound : pickInRound;
		const roundGroup = Math.ceil(draftRound / 2);
		const groupOrders = allOrders.filter((o) => o.round_group === roundGroup);
		const order = groupOrders.find((o) => o.position === positionIndex + 1);

		if (!order || order.pool_team !== myPoolTeamId) {
			return fail(403, { pickError: 'It is not your turn to pick' });
		}

		try {
			await adminPb.collection('draft_picks').create({
				user: userId,
				team: formData.get('team') as string,
				pool_team: myPoolTeamId,
				draft_round: draftRound,
				pick_number: allPicks.length + 1
			});
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
