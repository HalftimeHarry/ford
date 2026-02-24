import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { draftPickSchema, autoPick, getSnakePickPosition } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam, DraftPick, User, DraftOrder, DraftSettings, Pool, PoolEntry } from '$lib/types';

export const load: PageServerLoad = async () => {
	await ensureAdminAuth();
	try {
		const [teams, picks, participants, draftOrders, pools, poolEntries] = await Promise.all([
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
			adminPb.collection('pools').getFullList<Pool>({ sort: 'slug' }),
			adminPb.collection('pool_entries').getFullList<PoolEntry>({ expand: 'user,pool' })
		]);

		let allSettings: DraftSettings[] = [];
		try {
			allSettings = await adminPb.collection('draft_settings').getFullList<DraftSettings>({
				expand: 'pool'
			});
		} catch {
			// no settings yet
		}

		return { teams, picks, participants, draftOrders, pools, poolEntries, allSettings };
	} catch (err) {
		console.error('Admin load error:', err);
		return {
			teams: [], picks: [], participants: [], draftOrders: [],
			pools: [], poolEntries: [], allSettings: []
		};
	}
};

/** Get pool participants from pool_entries */
async function getPoolParticipantIds(poolId: string): Promise<string[]> {
	const entries = await adminPb.collection('pool_entries').getFullList<PoolEntry>({
		filter: `pool = "${poolId}"`
	});
	return entries.map((e) => e.user);
}

/** Get pool-scoped picks */
async function getPoolPicks(poolId: string): Promise<DraftPick[]> {
	const participantIds = await getPoolParticipantIds(poolId);
	if (participantIds.length === 0) return [];
	const allPicks = await adminPb.collection('draft_picks').getFullList<DraftPick>({ sort: 'pick_number' });
	return allPicks.filter((p) => participantIds.includes(p.user));
}

/** Get pool-scoped draft orders */
async function getPoolOrders(poolId: string): Promise<DraftOrder[]> {
	const participantIds = await getPoolParticipantIds(poolId);
	if (participantIds.length === 0) return [];
	const allOrders = await adminPb.collection('draft_orders').getFullList<DraftOrder>({ sort: 'round_group,position' });
	return allOrders.filter((o) => participantIds.includes(o.user));
}

export const actions: Actions = {
	startDraft: async ({ request }) => {
		const formData = await request.formData();
		const poolId = formData.get('pool_id') as string;
		const settingsId = formData.get('settings_id') as string;
		const timerSeconds = Number(formData.get('timer_seconds'));

		try {
			// Get pool participants
			const participantIds = await getPoolParticipantIds(poolId);
			if (participantIds.length === 0) {
				return fail(400, { startError: 'No participants in this pool' });
			}

			// Shuffle for round group 1 lottery
			const shuffled = [...participantIds].sort(() => Math.random() - 0.5);

			// Clear existing group 1 orders for these participants
			const existingOrders = await adminPb.collection('draft_orders').getFullList<DraftOrder>({
				filter: `round_group = 1`
			});
			for (const order of existingOrders) {
				if (participantIds.includes(order.user)) {
					await adminPb.collection('draft_orders').delete(order.id);
				}
			}

			// Create new order
			for (let i = 0; i < shuffled.length; i++) {
				await adminPb.collection('draft_orders').create({
					user: shuffled[i],
					position: i + 1,
					round_group: 1
				});
			}

			// Set status to in_progress and start timer
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
		const formData = await request.formData();
		const settingsId = formData.get('settings_id') as string;
		const timerSeconds = Number(formData.get('timer_seconds'));

		try {
			const updateData: Record<string, unknown> = {
				status: 'in_progress',
				timer_seconds: timerSeconds
			};

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
		const formData = await request.formData();
		const settingsId = formData.get('settings_id') as string;
		const timerSeconds = Number(formData.get('timer_seconds'));

		try {
			await adminPb.collection('draft_settings').update(settingsId, {
				timer_seconds: timerSeconds
			});
			return { settingsSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to update settings';
			return fail(500, { settingsError: message });
		}
	},

	makePick: async ({ request }) => {
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
			await advanceDeadline(formData.get('pool_id') as string);
			return { pickSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to record pick';
			return fail(500, { pickError: message });
		}
	},

	autoPick: async ({ request }) => {
		const formData = await request.formData();
		const poolId = formData.get('pool_id') as string;

		try {
			const [teams, poolPicks, poolOrders, participantIds] = await Promise.all([
				adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
				getPoolPicks(poolId),
				getPoolOrders(poolId),
				getPoolParticipantIds(poolId)
			]);

			const entryCount = participantIds.length;
			const totalPicks = entryCount * 6;
			if (poolPicks.length >= totalPicks) return fail(400, { pickError: 'Draft is complete' });

			const draftedIds = new Set(poolPicks.map((p) => p.team));
			const available = teams.filter((t) => !draftedIds.has(t.id));
			const bestTeam = autoPick(available);
			if (!bestTeam) return fail(400, { pickError: 'No teams available' });

			const nextPickNumber = poolPicks.length + 1;
			const draftRound = Math.min(Math.floor(poolPicks.length / entryCount) + 1, 6);
			const pickInRound = poolPicks.length % entryCount;
			const isReverse = draftRound % 2 === 0;
			const positionIndex = isReverse ? entryCount - 1 - pickInRound : pickInRound;
			const roundGroup = Math.ceil(draftRound / 2);

			const groupOrders = poolOrders.filter((o) => o.round_group === roundGroup);
			const order = groupOrders.find((o) => o.position === positionIndex + 1);
			if (!order) return fail(400, { pickError: 'No draft order set for this round group' });

			await adminPb.collection('draft_picks').create({
				user: order.user,
				team: bestTeam.id,
				draft_round: draftRound,
				pick_number: nextPickNumber
			});

			await advanceDeadline(poolId);

			return { pickSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Auto-pick failed';
			return fail(500, { pickError: message });
		}
	},

	generateOrder: async ({ request }) => {
		const formData = await request.formData();
		const roundGroup = Number(formData.get('round_group'));
		const poolId = formData.get('pool_id') as string;

		try {
			const participantIds = await getPoolParticipantIds(poolId);
			const shuffled = [...participantIds].sort(() => Math.random() - 0.5);

			// Delete existing orders for this round group + pool participants
			const existing = await pb
				.collection('draft_orders')
				.getFullList<DraftOrder>({ filter: `round_group = ${roundGroup}` });
			for (const order of existing) {
				if (participantIds.includes(order.user)) {
					await adminPb.collection('draft_orders').delete(order.id);
				}
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
		const formData = await request.formData();
		const pickId = formData.get('pick_id') as string;

		try {
			await adminPb.collection('draft_picks').delete(pickId);
			return { undoSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to undo pick';
			return fail(500, { pickError: message });
		}
	}
};

/** Reset the pick deadline after a pick is made */
async function advanceDeadline(poolId: string) {
	try {
		const settingsList = await adminPb.collection('draft_settings').getFullList<DraftSettings>();
		const settings = settingsList.find((s) => s.pool === poolId);
		if (!settings || settings.status !== 'in_progress' || settings.timer_seconds <= 0) return;

		const deadline = new Date(Date.now() + settings.timer_seconds * 1000).toISOString();
		await adminPb.collection('draft_settings').update(settings.id, {
			current_pick_deadline: deadline
		});
	} catch {
		// non-fatal
	}
}
