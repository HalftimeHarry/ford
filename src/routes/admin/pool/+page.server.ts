import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import type { Actions, PageServerLoad } from './$types';
import type { PoolTeam, JoinRequest } from '$lib/types';

export const load: PageServerLoad = async () => {
	await ensureAdminAuth();
	const [poolTeams, joinRequests] = await Promise.all([
		adminPb.collection('pool_teams').getFullList<PoolTeam>({ sort: 'name' }),
		adminPb.collection('join_requests').getFullList<JoinRequest>({ expand: 'user,pool_team' })
	]);
	return { poolTeams, joinRequests };
};

export const actions: Actions = {
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

	deleteTeam: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const teamId = formData.get('team_id') as string;
		if (!teamId) return fail(400, { teamError: 'Team ID required' });
		try {
			await adminPb.collection('pool_teams').delete(teamId);
			return { teamSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to delete team';
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
