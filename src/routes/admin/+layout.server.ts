import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/');
	if (locals.user.role !== 'admin') redirect(303, '/dashboard');

	return { user: locals.user };
};
