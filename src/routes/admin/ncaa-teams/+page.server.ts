import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam } from '$lib/types';

export const load: PageServerLoad = async () => {
	await ensureAdminAuth();
	const teams = await adminPb
		.collection('ncaa_teams')
		.getFullList<NcaaTeam>({ sort: 'region,seed' });
	return { teams };
};

export const actions: Actions = {
	create: async ({ request }) => {
		await ensureAdminAuth();
		const fd = await request.formData();
		const name = (fd.get('name') as string | null)?.trim();
		const region = (fd.get('region') as string | null)?.trim();
		const seed = Number(fd.get('seed'));

		if (!name) return fail(400, { createError: 'Name is required' });
		if (!region) return fail(400, { createError: 'Region is required' });
		if (!seed || seed < 1 || seed > 16) return fail(400, { createError: 'Seed must be 1–16' });

		try {
			await adminPb.collection('ncaa_teams').create({ name, region, seed });
			return { createSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to create team';
			return fail(500, { createError: message });
		}
	},

	update: async ({ request }) => {
		await ensureAdminAuth();
		const fd = await request.formData();
		const id = fd.get('id') as string | null;
		const name = (fd.get('name') as string | null)?.trim();
		const region = (fd.get('region') as string | null)?.trim();
		const seed = Number(fd.get('seed'));

		if (!id) return fail(400, { updateError: 'Missing team id' });
		if (!name) return fail(400, { updateError: 'Name is required' });
		if (!region) return fail(400, { updateError: 'Region is required' });
		if (!seed || seed < 1 || seed > 16) return fail(400, { updateError: 'Seed must be 1–16' });

		try {
			await adminPb.collection('ncaa_teams').update(id, { name, region, seed });
			return { updateSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to update team';
			return fail(500, { updateError: message });
		}
	},

	delete: async ({ request }) => {
		await ensureAdminAuth();
		const fd = await request.formData();
		const id = fd.get('id') as string | null;
		if (!id) return fail(400, { deleteError: 'Missing team id' });

		try {
			await adminPb.collection('ncaa_teams').delete(id);
			return { deleteSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to delete team';
			return fail(500, { deleteError: message });
		}
	}
};
