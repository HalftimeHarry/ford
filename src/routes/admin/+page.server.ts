import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { draftPickSchema, autoPick } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam, DraftPick, User, DraftOrder, DraftSettings, PoolTeam, JoinRequest } from '$lib/types';

export const load: PageServerLoad = async () => {
	await ensureAdminAuth();
	try {
		const [teams, picks, participants, draftOrders, poolTeams, joinRequests] = await Promise.all([
			adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
			adminPb.collection('draft_picks').getFullList<DraftPick>({
				sort: 'pick_number',
				expand: 'user,team'
			}),
			adminPb.collection('users').getFullList<User>({ filter: "role = 'participant'", sort: 'name' }),
			adminPb.collection('draft_orders').getFullList<DraftOrder>({
				sort: 'round_group,position',
				expand: 'user'
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

		return { teams, picks, participants, draftOrders, poolTeams, joinRequests, draftSettings };
	} catch (err) {
		console.error('Admin load error:', err);
		return {
			teams: [], picks: [], participants: [], draftOrders: [],
			poolTeams: [], joinRequests: [], draftSettings: null
		};
	}
};

/** All participant ids */
async function getAllParticipantIds(): Promise<string[]> {
	const users = await adminPb.collection('users').getFullList<User>({ filter: "role = 'participant'" });
	return users.map((u) => u.id);
}

export const actions: Actions = {
	startDraft: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const settingsId = formData.get('settings_id') as string;
		const timerSeconds = Number(formData.get('timer_seconds'));

		try {
			const participantIds = await getAllParticipantIds();
			if (participantIds.length === 0) {
				return fail(400, { startError: 'No participants registered' });
			}

			// Shuffle for round group 1 lottery
			const shuffled = [...participantIds].sort(() => Math.random() - 0.5);

			// Clear existing group 1 orders
			const existingOrders = await adminPb.collection('draft_orders').getFullList<DraftOrder>({
				filter: `round_group = 1`
			});
			for (const order of existingOrders) {
				await adminPb.collection('draft_orders').delete(order.id);
			}

			for (let i = 0; i < shuffled.length; i++) {
				await adminPb.collection('draft_orders').create({
					user: shuffled[i],
					position: i + 1,
					round_group: 1
				});
			}

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
		const data = {
			user: formData.get('user') as string,
			team: formData.get('team') as string,
			draft_round: Number(formData.get('draft_round')),
			pick_number: Number(formData.get('pick_number'))
		};

		const result = draftPickSchema.safeParse(data);
		if (!result.success) {
			return fail(400, { pickError: result.error.issues[0].message });
		}

		try {
			await adminPb.collection('draft_picks').create(result.data);
			await advanceDeadline();
			return { pickSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to record pick';
			return fail(500, { pickError: message });
		}
	},

	autoPick: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();

		try {
			const [teams, allPicks, allOrders, participantIds] = await Promise.all([
				adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
				adminPb.collection('draft_picks').getFullList<DraftPick>({ sort: 'pick_number' }),
				adminPb.collection('draft_orders').getFullList<DraftOrder>({ sort: 'round_group,position' }),
				getAllParticipantIds()
			]);

			const entryCount = participantIds.length;
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
			if (!order) return fail(400, { pickError: 'No draft order set for this round group' });

			await adminPb.collection('draft_picks').create({
				user: order.user,
				team: bestTeam.id,
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
			const participantIds = await getAllParticipantIds();
			const shuffled = [...participantIds].sort(() => Math.random() - 0.5);

			const existing = await adminPb.collection('draft_orders').getFullList<DraftOrder>({
				filter: `round_group = ${roundGroup}`
			});
			for (const order of existing) {
				await adminPb.collection('draft_orders').delete(order.id);
			}

			for (let i = 0; i < shuffled.length; i++) {
				await adminPb.collection('draft_orders').create({
					user: shuffled[i],
					position: i + 1,
					round_group: roundGroup
				});
			}

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
