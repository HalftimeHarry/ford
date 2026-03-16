import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { autoPick } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam, DraftPick, DraftOrder, DraftSettings, PoolTeam, JoinRequest } from '$lib/types';

// Cached admin user id for picks where no approved participant exists
let _adminUserId = '';
async function getAdminUserId(): Promise<string> {
	if (_adminUserId) return _adminUserId;
	const users = await adminPb.collection('users').getFullList({ perPage: 50 });
	const admin = users.find((u) => (u as Record<string, unknown>).role === 'admin');
	_adminUserId = admin?.id ?? users[0]?.id ?? '';
	return _adminUserId;
}

async function resolveUserId(poolTeamId: string, joinRequests: JoinRequest[]): Promise<string> {
	const approved = joinRequests.find((r) => r.pool_team === poolTeamId && r.status === 'approved');
	if (approved?.user) return approved.user;
	return getAdminUserId();
}

export const load: PageServerLoad = async () => {
	await ensureAdminAuth();
	const [picks, results, orders, poolTeams, ncaaTeams] = await Promise.all([
		adminPb.collection('draft_picks').getFullList<DraftPick>(),
		adminPb.collection('game_results').getFullList(),
		adminPb.collection('draft_orders').getFullList<DraftOrder>(),
		adminPb.collection('pool_teams').getFullList<PoolTeam>({ sort: 'name' }),
		adminPb.collection('ncaa_teams').getFullList<NcaaTeam>()
	]);

	let draftStatus = 'none';
	try {
		const settings = await adminPb.collection('draft_settings').getFirstListItem<DraftSettings>('');
		draftStatus = settings.status;
	} catch { /* no settings */ }

	const eliminatedCount = ncaaTeams.filter((t) => t.eliminated_round).length;
	const entryCount = poolTeams.length;
	const picksPerGroup = entryCount * 2;

	const groupStatus = [1, 2, 3].map((g) => {
		const start = (g - 1) * picksPerGroup + 1;
		const end = g * picksPerGroup;
		const count = picks.filter((p) => p.pick_number >= start && p.pick_number <= end).length;
		const hasOrder = orders.filter((o) => o.round_group === g).length >= entryCount;
		return { group: g, pickCount: count, total: picksPerGroup, hasOrder, complete: count >= picksPerGroup };
	});

	return {
		pickCount: picks.length,
		resultCount: results.length,
		orderCount: orders.length,
		eliminatedCount,
		poolTeams,
		draftStatus,
		groupStatus,
		entryCount
	};
};

export const actions: Actions = {
	seedDraft: async () => {
		await ensureAdminAuth();

		try {
			const [poolTeams, joinRequests, ncaaTeams, existingPicks] = await Promise.all([
				adminPb.collection('pool_teams').getFullList<PoolTeam>({ sort: 'name' }),
				adminPb.collection('join_requests').getFullList<JoinRequest>({
					filter: "status = 'approved'"
				}),
				adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
				adminPb.collection('draft_picks').getFullList<DraftPick>()
			]);

			if (existingPicks.length >= poolTeams.length * 6) {
				return fail(400, { seedError: 'Draft already has 60 picks — reset first.' });
			}

			const entryCount = poolTeams.length; // 10

			// Create draft_orders for all 3 round groups
			const existingOrders = await adminPb.collection('draft_orders').getFullList<DraftOrder>();
			await Promise.all(existingOrders.map((o) => adminPb.collection('draft_orders').delete(o.id)));

			for (let group = 1; group <= 3; group++) {
				const groupOrder = [...poolTeams].sort(() => Math.random() - 0.5);
				await Promise.all(
					groupOrder.map((pt, i) =>
						adminPb.collection('draft_orders').create({
							pool_team: pt.id,
							position: i + 1,
							round_group: group
						})
					)
				);
			}

			// Re-fetch orders
			const allOrders = await adminPb.collection('draft_orders').getFullList<DraftOrder>({
				sort: 'round_group,position'
			});

			// Simulate all 60 picks
			const draftedIds = new Set<string>();
			const picks: Array<{ user: string; team: string; pool_team: string; draft_round: number; pick_number: number }> = [];

			for (let pickNum = 1; pickNum <= entryCount * 6; pickNum++) {
				const draftRound = Math.min(Math.floor((pickNum - 1) / entryCount) + 1, 6);
				const pickInRound = (pickNum - 1) % entryCount;
				const isReverse = draftRound % 2 === 0;
				const positionIndex = isReverse ? entryCount - 1 - pickInRound : pickInRound;
				const roundGroup = Math.ceil(draftRound / 2);

				const groupOrders = allOrders.filter((o) => o.round_group === roundGroup);
				const order = groupOrders.find((o) => o.position === positionIndex + 1);
				if (!order) continue;

				const userId = await resolveUserId(order.pool_team, joinRequests);

				const available = ncaaTeams.filter((t) => !draftedIds.has(t.id));
				const best = autoPick(available);
				if (!best) break;

				draftedIds.add(best.id);
				picks.push({ user: userId, team: best.id, pool_team: order.pool_team, draft_round: draftRound, pick_number: pickNum });
			}

			// Write all picks in parallel batches of 10
			for (let i = 0; i < picks.length; i += 10) {
				await Promise.all(picks.slice(i, i + 10).map((p) => adminPb.collection('draft_picks').create(p)));
			}

			// Set draft status to complete
			try {
				const settings = await adminPb.collection('draft_settings').getFirstListItem<DraftSettings>('');
				await adminPb.collection('draft_settings').update(settings.id, {
					status: 'complete',
					current_pick_deadline: ''
				});
			} catch { /* no settings record */ }

			return { seedSuccess: `Seeded ${picks.length} picks across ${poolTeams.length} teams.` };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Seed failed';
			return fail(500, { seedError: message });
		}
	},

	seedGroup: async ({ request }) => {
		await ensureAdminAuth();
		const fd = await request.formData();
		const group = Number(fd.get('group'));
		if (![1, 2, 3].includes(group)) return fail(400, { seedGroupError: 'Invalid group' });

		try {
			const [poolTeams, joinRequests, ncaaTeams, existingPicks, existingOrders] = await Promise.all([
				adminPb.collection('pool_teams').getFullList<PoolTeam>({ sort: 'name' }),
				adminPb.collection('join_requests').getFullList<JoinRequest>({ filter: "status = 'approved'" }),
				adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
				adminPb.collection('draft_picks').getFullList<DraftPick>({ sort: 'pick_number' }),
				adminPb.collection('draft_orders').getFullList<DraftOrder>({ sort: 'round_group,position' })
			]);

			const entryCount = poolTeams.length;
			const picksPerGroup = entryCount * 2;
			const groupStartPick = (group - 1) * picksPerGroup + 1; // 1, 21, 41
			const groupEndPick = group * picksPerGroup;              // 20, 40, 60

			// Don't re-seed picks that already exist for this group
			const existingGroupPicks = existingPicks.filter(
				(p) => p.pick_number >= groupStartPick && p.pick_number <= groupEndPick
			);
			if (existingGroupPicks.length >= picksPerGroup) {
				return fail(400, { seedGroupError: `Group ${group} already has ${existingGroupPicks.length} picks — reset first.` });
			}

			// Ensure draft orders exist for this group — create random ones if missing
			const groupOrders = existingOrders.filter((o) => o.round_group === group);
			let ordersToUse = groupOrders;
			if (groupOrders.length < entryCount) {
				const shuffled = [...poolTeams].sort(() => Math.random() - 0.5);
				await Promise.all(
					shuffled.map((pt, i) =>
						adminPb.collection('draft_orders').create({
							pool_team: pt.id,
							position: i + 1,
							round_group: group
						})
					)
				);
				ordersToUse = await adminPb
					.collection('draft_orders')
					.getFullList<DraftOrder>({ filter: `round_group = ${group}`, sort: 'position' });
			}

			// Already-drafted team ids (from all existing picks)
			const draftedIds = new Set(existingPicks.map((p) => p.team));

			// Simulate picks for this group only
			const newPicks: Array<{
				user: string; team: string; pool_team: string;
				round_group: number; draft_round: number; pick_number: number;
			}> = [];

			for (let pickNum = groupStartPick; pickNum <= groupEndPick; pickNum++) {
				const draftRound = Math.min(Math.floor((pickNum - 1) / entryCount) + 1, 6);
				const pickInRound = (pickNum - 1) % entryCount;
				const isReverse = draftRound % 2 === 0;
				const positionIndex = isReverse ? entryCount - 1 - pickInRound : pickInRound;

				const order = ordersToUse.find((o) => o.position === positionIndex + 1);
				if (!order) continue;

				const userId = await resolveUserId(order.pool_team, joinRequests);

				const available = ncaaTeams.filter((t) => !draftedIds.has(t.id));
				const best = autoPick(available);
				if (!best) break;

				draftedIds.add(best.id);
				newPicks.push({
					user: userId,
					team: best.id,
					pool_team: order.pool_team,
					round_group: group,
					draft_round: draftRound,
					pick_number: pickNum
				});
			}

			// Write picks sequentially to avoid rate limits
			for (let i = 0; i < newPicks.length; i += 10) {
				await Promise.all(newPicks.slice(i, i + 10).map((p) => adminPb.collection('draft_picks').create(p)));
			}

			// Update draft status: in_progress after G1/G2, complete after G3
			try {
				const settings = await adminPb.collection('draft_settings').getFirstListItem<DraftSettings>('');
				await adminPb.collection('draft_settings').update(settings.id, {
					status: group === 3 ? 'complete' : 'in_progress',
					current_pick_deadline: ''
				});
			} catch { /* no settings */ }

			return { seedGroupSuccess: `Group ${group} seeded — ${newPicks.length} picks added.` };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Seed failed';
			return fail(500, { seedGroupError: message });
		}
	},

	resetAll: async () => {
		await ensureAdminAuth();

		try {
			const [picks, results, orders, ncaaTeams] = await Promise.all([
				adminPb.collection('draft_picks').getFullList<DraftPick>(),
				adminPb.collection('game_results').getFullList(),
				adminPb.collection('draft_orders').getFullList<DraftOrder>(),
				adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ filter: 'eliminated_round != ""' })
			]);

			// Delete in parallel batches
			const deleteAll = (items: { id: string }[], col: string) =>
				Promise.all(items.map((item) => adminPb.collection(col).delete(item.id)));

			await Promise.all([
				deleteAll(picks, 'draft_picks'),
				deleteAll(results, 'game_results'),
				deleteAll(orders, 'draft_orders')
			]);

			// Clear eliminated_round on all teams
			await Promise.all(
				ncaaTeams.map((t) => adminPb.collection('ncaa_teams').update(t.id, { eliminated_round: '' }))
			);

			// Reset draft settings
			try {
				const settings = await adminPb.collection('draft_settings').getFirstListItem<DraftSettings>('');
				await adminPb.collection('draft_settings').update(settings.id, {
					status: 'not_started',
					current_pick_deadline: ''
				});
			} catch { /* no settings */ }

			return {
				resetSuccess: `Deleted ${picks.length} picks, ${results.length} results, ${orders.length} orders. ${ncaaTeams.length} teams cleared.`
			};
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Reset failed';
			return fail(500, { resetError: message });
		}
	}
};
