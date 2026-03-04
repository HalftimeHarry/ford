import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Blog has moved inside the dashboard. Redirect anyone who lands here.
export const load: PageServerLoad = async () => {
	redirect(303, '/dashboard/blog');
};
