import { fail, redirect } from '@sveltejs/kit';
import { pb } from '$lib/pocketbase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/');
	return { user: locals.user };
};

export const actions: Actions = {
	updateProfile: async ({ request, locals, cookies }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const phone = (formData.get('phone') as string)?.trim();

		if (!name) return fail(400, { error: 'Name is required', name, phone });

		try {
			const updated = await pb.collection('users').update(locals.user.id, { name, phone });
			// Refresh the auth cookie so the updated name shows immediately
			cookies.set('pb_auth', pb.authStore.exportToCookie(), {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false
			});
			return { success: true, name: updated.name };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to update profile';
			return fail(500, { error: message, name, phone });
		}
	},

	changePassword: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const oldPassword = formData.get('oldPassword') as string;
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!oldPassword || !newPassword) return fail(400, { pwError: 'All fields required' });
		if (newPassword !== confirmPassword) return fail(400, { pwError: 'Passwords do not match' });
		if (newPassword.length < 8) return fail(400, { pwError: 'Password must be at least 8 characters' });

		try {
			await pb.collection('users').update(locals.user.id, {
				oldPassword,
				password: newPassword,
				passwordConfirm: confirmPassword
			});
			return { pwSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to change password';
			return fail(500, { pwError: message });
		}
	}
};
