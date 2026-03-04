import { fail, redirect } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { blogPostSchema } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

// Auth is already enforced by /dashboard layout — no extra check needed here.
export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		await ensureAdminAuth();

		const formData = await request.formData();
		const title = formData.get('title') as string;
		const body = formData.get('body') as string;
		const imageFile = formData.get('image') as File | null;

		const result = blogPostSchema.safeParse({ title, body });

		if (!result.success) {
			const errors: Record<string, string> = {};
			for (const issue of result.error.issues) {
				const key = issue.path[0] as string;
				if (!errors[key]) errors[key] = issue.message;
			}
			return fail(400, { errors, data: { title, body } });
		}

		try {
			const payload = new FormData();
			payload.set('author', locals.user!.id);
			payload.set('title', result.data.title);
			payload.set('body', result.data.body);
			if (imageFile && imageFile.size > 0) {
				payload.set('image', imageFile);
			}

			const post = await adminPb.collection('blog_posts').create(payload);
			redirect(303, `/dashboard/blog/${post.id}`);
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 303) throw err;
			const message = err instanceof Error ? err.message : 'Failed to create post.';
			return fail(500, { error: message, data: { title, body } });
		}
	}
};
