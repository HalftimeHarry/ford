import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { draftPickSchema, autoPick } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam, DraftPick, DraftOrder, DraftSettings, PoolTeam, JoinRequest } from '$lib/types';

export const load: PageServerLoad = async () => {
	await ensureAdminAuth();
	try {
		const [teams, picks, draftOrders, poolTeams, joinRequests] = await Promise.all([
			adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
			adminPb.collection('draft_picks').getFullList<DraftPick>({
				sort: 'pick_number',
				expand: 'user,team,pool_team'
			}),
			adminPb.collection('draft_orders').getFullList<DraftOrder>({
				sort: 'round_group,position',
				expand: 'pool_team'
			}),
			adminPb.collection('pool_teams').getFullList<PoolTeam>({ sort: 'name' }),
			adminPb.collection('join_requests').getFullList<JoinRequest>({
				expand: 'user,pool_team'
			})
		]);

		let draftSettings: DraftSettings | null = null;
		try {
			const list = await adminPb.collection('draft_settings').getFullList<DraftSettings>();
			draftSettings = list[0] ?? null;
		} catch {
			// no settings yet
		}

		return { teams, picks, draftOrders, poolTeams, joinRequests, draftSettings };
	} catch (err) {
		console.error('Admin load error:', err);
		return {
			teams: [], picks: [], draftOrders: [],
			poolTeams: [], joinRequests: [], draftSettings: null
		};
	}
};

/** All pool team ids (one entry per team in the draft) */
async function getAllPoolTeamIds(): Promise<string[]> {
	const teams = await adminPb.collection('pool_teams').getFullList<PoolTeam>({ sort: 'name' });
	return teams.map((t) => t.id);
}

// Cached admin user id — resolved once, reused for all admin picks
let _adminUserId = '';
async function getAdminUserId(): Promise<string> {
	if (_adminUserId) return _adminUserId;
	const users = await adminPb.collection('users').getFullList({ perPage: 50 });
	const admin = users.find((u) => (u as Record<string,unknown>).role === 'admin');
	_adminUserId = admin?.id ?? users[0]?.id ?? '';
	return _adminUserId;
}

/** Resolve a user id for a pool team — approved member if exists, else pool admin fallback */
async function resolveUserId(poolTeamId: string): Promise<string> {
	const requests = await adminPb.collection('join_requests').getFullList<JoinRequest>({
		filter: `pool_team = "${poolTeamId}" && status = "approved"`
	});
	if (requests[0]?.user) return requests[0].user;
	return getAdminUserId();
}

export const actions: Actions = {
	startDraft: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const settingsId = formData.get('settings_id') as string;
		const timerSeconds = Number(formData.get('timer_seconds'));

		// Accept an explicit ordered list of pool_team ids if provided (drag-to-order)
		const orderedTeamIds = (formData.get('ordered_team_ids') as string | null)
			?.split(',')
			.filter(Boolean) ?? [];

		try {
			const allTeamIds = await getAllPoolTeamIds();
			if (allTeamIds.length === 0) {
				return fail(400, { startError: 'No pool teams found' });
			}

			// Use provided order if valid, otherwise shuffle
			const teamIds =
				orderedTeamIds.length === allTeamIds.length &&
				orderedTeamIds.every((id) => allTeamIds.includes(id))
					? orderedTeamIds
					: [...allTeamIds].sort(() => Math.random() - 0.5);

			// Clear existing group 1 orders
			const existingOrders = await adminPb.collection('draft_orders').getFullList<DraftOrder>({
				filter: `round_group = 1`
			});
			for (const order of existingOrders) {
				await adminPb.collection('draft_orders').delete(order.id);
			}

			await Promise.all(
				teamIds.map((teamId, i) =>
					adminPb.collection('draft_orders').create({
						pool_team: teamId,
						position: i + 1,
						round_group: 1
					})
				)
			);

			const updateData: Record<string, unknown> = {
				status: 'in_progress',
				timer_seconds: timerSeconds,
				pick_mode: 'admin',
				allow_user_pick: true
			};
			if (timerSeconds > 0) {
				updateData.current_pick_deadline = new Date(Date.now() + timerSeconds * 1000).toISOString();
			}

			await adminPb.collection('draft_settings').update(settingsId, updateData);
			return { orderSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to start draft';
			return fail(500, { startError: message });
		}
	},

	pauseDraft: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const settingsId = formData.get('settings_id') as string;
		try {
			await adminPb.collection('draft_settings').update(settingsId, {
				status: 'paused',
				current_pick_deadline: ''
			});
			return { settingsSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to pause draft';
			return fail(500, { settingsError: message });
		}
	},

	resumeDraft: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const settingsId = formData.get('settings_id') as string;
		const timerSeconds = Number(formData.get('timer_seconds'));
		try {
			const updateData: Record<string, unknown> = { status: 'in_progress', timer_seconds: timerSeconds };
			if (timerSeconds > 0) {
				updateData.current_pick_deadline = new Date(Date.now() + timerSeconds * 1000).toISOString();
			}
			await adminPb.collection('draft_settings').update(settingsId, updateData);
			return { settingsSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to resume draft';
			return fail(500, { settingsError: message });
		}
	},

	updateSettings: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const settingsId = formData.get('settings_id') as string;
		const timerSeconds = Number(formData.get('timer_seconds'));
		try {
			await adminPb.collection('draft_settings').update(settingsId, { timer_seconds: timerSeconds });
			return { settingsSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to update settings';
			return fail(500, { settingsError: message });
		}
	},

	makePick: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const poolTeamId = formData.get('pool_team') as string;
		const teamId = formData.get('team') as string;
		const draftRound = Number(formData.get('draft_round'));
		const pickNumber = Number(formData.get('pick_number'));

		if (!poolTeamId || !teamId || !draftRound || !pickNumber) {
			return fail(400, { pickError: 'Missing required pick fields' });
		}

		try {
			const userId = await resolveUserId(poolTeamId);

			await adminPb.collection('draft_picks').create({
				user: userId,
				team: teamId,
				pool_team: poolTeamId,
				draft_round: draftRound,
				pick_number: pickNumber
			});
			await advanceDeadline();
			return { pickSuccess: true };
		} catch (err: unknown) {
			const pb_err = err as { response?: { message?: string; data?: unknown }; message?: string };
			const message = pb_err?.response?.message ?? pb_err?.message ?? 'Failed to record pick';
			const detail = pb_err?.response?.data ? JSON.stringify(pb_err.response.data) : '';
			console.error('[makePick] error:', message, detail);
			return fail(500, { pickError: `${message}${detail ? ': ' + detail : ''}` });
		}
	},

	autoPick: async () => {
		await ensureAdminAuth();

		try {
			const [teams, allPicks, allOrders, allTeamIds] = await Promise.all([
				adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
				adminPb.collection('draft_picks').getFullList<DraftPick>({ sort: 'pick_number' }),
				adminPb.collection('draft_orders').getFullList<DraftOrder>({ sort: 'round_group,position' }),
				getAllPoolTeamIds()
			]);

			const entryCount = allTeamIds.length;
			const totalPicks = entryCount * 6;
			if (allPicks.length >= totalPicks) return fail(400, { pickError: 'Draft is complete' });

			const draftedIds = new Set(allPicks.map((p) => p.team));
			const available = teams.filter((t) => !draftedIds.has(t.id));
			const bestTeam = autoPick(available);
			if (!bestTeam) return fail(400, { pickError: 'No teams available' });

			const nextPickNumber = allPicks.length + 1;
			const draftRound = Math.min(Math.floor(allPicks.length / entryCount) + 1, 6);
			const pickInRound = allPicks.length % entryCount;
			const isReverse = draftRound % 2 === 0;
			const positionIndex = isReverse ? entryCount - 1 - pickInRound : pickInRound;
			const roundGroup = Math.ceil(draftRound / 2);

			const groupOrders = allOrders.filter((o) => o.round_group === roundGroup);
			const order = groupOrders.find((o) => o.position === positionIndex + 1);
			if (!order) return fail(400, { pickError: 'No draft order set for this round group. Confirm the lottery order first.' });

			const userId = await resolveUserId(order.pool_team);

			await adminPb.collection('draft_picks').create({
				user: userId,
				team: bestTeam.id,
				pool_team: order.pool_team,
				draft_round: draftRound,
				pick_number: nextPickNumber
			});

			await advanceDeadline();
			return { pickSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Auto-pick failed';
			return fail(500, { pickError: message });
		}
	},

	generateOrder: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const roundGroup = Number(formData.get('round_group'));

		try {
			const allTeamIds = await getAllPoolTeamIds();
			const shuffled = [...allTeamIds].sort(() => Math.random() - 0.5);

			const existing = await adminPb.collection('draft_orders').getFullList<DraftOrder>({
				filter: `round_group = ${roundGroup}`
			});
			for (const order of existing) {
				await adminPb.collection('draft_orders').delete(order.id);
			}

			await Promise.all(
				shuffled.map((teamId, i) =>
					adminPb.collection('draft_orders').create({
						pool_team: teamId,
						position: i + 1,
						round_group: roundGroup
					})
				)
			);

			return { orderSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to generate order';
			return fail(500, { orderError: message });
		}
	},

	undoPick: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const pickId = formData.get('pick_id') as string;
		try {
			await adminPb.collection('draft_picks').delete(pickId);
			return { undoSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to undo pick';
			return fail(500, { pickError: message });
		}
	},

	saveOrder: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const roundGroup = Number(formData.get('round_group') ?? 1);
		const orderedTeamIds = (formData.get('ordered_team_ids') as string | null)
			?.split(',')
			.filter(Boolean) ?? [];

		if (orderedTeamIds.length === 0) return fail(400, { orderError: 'No order provided' });

		try {
			// Delete existing orders for this round group one at a time (PocketBase requires sequential deletes)
			const existing = await adminPb.collection('draft_orders').getFullList<DraftOrder>({
				filter: `round_group = ${roundGroup}`
			});
			for (const o of existing) {
				await adminPb.collection('draft_orders').delete(o.id);
			}

			// Create new orders in parallel — each has a unique pool_team so no cancellation conflict
			await Promise.all(
				orderedTeamIds.map((teamId, i) =>
					adminPb.collection('draft_orders').create({
						pool_team: teamId,
						position: i + 1,
						round_group: roundGroup
					})
				)
			);
			return { orderSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to save order';
			return fail(500, { orderError: message });
		}
	},

	resetDraft: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const settingsId = formData.get('settings_id') as string;
		try {
			// Delete all picks
			const picks = await adminPb.collection('draft_picks').getFullList();
			await Promise.all(picks.map((p) => adminPb.collection('draft_picks').delete(p.id)));
			// Delete all draft orders
			const orders = await adminPb.collection('draft_orders').getFullList();
			await Promise.all(orders.map((o) => adminPb.collection('draft_orders').delete(o.id)));
			// Reset settings
			await adminPb.collection('draft_settings').update(settingsId, {
				status: 'not_started',
				current_pick_deadline: ''
			});
			return { resetSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to reset draft';
			return fail(500, { resetError: message });
		}
	},

	createTeam: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const slotCount = Number(formData.get('slot_count') ?? 1);
		if (!name) return fail(400, { teamError: 'Name is required' });
		try {
			await adminPb.collection('pool_teams').create({ name, slot_count: slotCount });
			return { teamSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to create team';
			return fail(500, { teamError: message });
		}
	},

	approveRequest: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const requestId = formData.get('request_id') as string;
		if (!requestId) return fail(400, { approvalError: 'Request ID required' });
		try {
			await adminPb.collection('join_requests').update(requestId, { status: 'approved' });
			return { approvalSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to approve';
			return fail(500, { approvalError: message });
		}
	},

	rejectRequest: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const requestId = formData.get('request_id') as string;
		if (!requestId) return fail(400, { approvalError: 'Request ID required' });
		try {
			await adminPb.collection('join_requests').update(requestId, { status: 'rejected' });
			return { approvalSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to reject';
			return fail(500, { approvalError: message });
		}
	}
};

async function advanceDeadline() {
	try {
		const list = await adminPb.collection('draft_settings').getFullList<DraftSettings>();
		const settings = list[0];
		if (!settings || settings.status !== 'in_progress' || settings.timer_seconds <= 0) return;
		const deadline = new Date(Date.now() + settings.timer_seconds * 1000).toISOString();
		await adminPb.collection('draft_settings').update(settings.id, { current_pick_deadline: deadline });
	} catch {
		// non-fatal
	}
}
