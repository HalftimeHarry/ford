import { fail, redirect } from '@sveltejs/kit';
import { registerSchema, loginSchema } from '$lib/types';
import { pb, adminPb, ensureAdminAuth } from '$lib/pocketbase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		const role = locals.user.role || 'participant';
		redirect(303, role === 'admin' ? '/admin' : '/dashboard');
	}
};

export const actions: Actions = {
	register: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const data = {
			name: formData.get('name') as string,
			email: formData.get('email') as string,
			phone: formData.get('phone') as string,
			password: formData.get('password') as string,
			passwordConfirm: formData.get('passwordConfirm') as string
		};

		const result = registerSchema.safeParse(data);

		if (!result.success) {
			const errors: Record<string, string> = {};
			for (const issue of result.error.issues) {
				const key = issue.path[0] as string;
				if (!errors[key]) errors[key] = issue.message;
			}
			return fail(400, {
				errors,
				data: { name: data.name, email: data.email, phone: data.phone }
			});
		}

		try {
			await adminPb.collection('users').create({
				name: result.data.name,
				email: result.data.email,
				password: result.data.password,
				passwordConfirm: result.data.passwordConfirm,
				phone: result.data.phone || '',
				role: 'participant'
			});

			return { success: true };
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : 'Registration failed. Please try again.';
			return fail(500, {
				error: message,
				data: { name: data.name, email: data.email, phone: data.phone }
			});
		}
	},

	login: async ({ request, cookies }) => {
		const formData = await request.formData();
		const data = {
			email: formData.get('email') as string,
			password: formData.get('password') as string
		};

		const result = loginSchema.safeParse(data);

		if (!result.success) {
			const errors: Record<string, string> = {};
			for (const issue of result.error.issues) {
				const key = issue.path[0] as string;
				if (!errors[key]) errors[key] = issue.message;
			}
			return fail(400, { loginErrors: errors, loginData: { email: data.email } });
		}

		try {
			const authData = await pb
				.collection('users')
				.authWithPassword(result.data.email, result.data.password);

			cookies.set('pb_auth', pb.authStore.exportToCookie(), {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: true,
				maxAge: 60 * 60 * 24 * 7
			});

			const role = (authData.record as { role?: string }).role || 'participant';
			redirect(303, role === 'admin' ? '/admin' : '/dashboard');
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 303) throw err;
			return fail(401, {
				loginError: 'Invalid email or password',
				loginData: { email: data.email }
			});
		}
	}
};
