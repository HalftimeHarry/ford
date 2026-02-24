import { redirect } from '@sveltejs/kit';
import { pb } from '$lib/pocketbase';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies }) => {
		pb.authStore.clear();
		cookies.delete('pb_auth', { path: '/' });
		redirect(303, '/');
	}
};
