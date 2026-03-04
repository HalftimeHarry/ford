import type { LayoutServerLoad } from './$types';

// Expose the current user to all pages via $page.data.user
export const load: LayoutServerLoad = async ({ locals }) => {
	return { user: locals.user ?? null };
};
