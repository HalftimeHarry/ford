import { error, fail, redirect } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { POCKETBASE_URL } from '$env/static/private';
import type { Actions, PageServerLoad } from './$types';
import type { BlogPost } from '$lib/types';

export const load: PageServerLoad = async ({ params }) => {
	await ensureAdminAuth();

	try {
		const post = await adminPb.collection('blog_posts').getOne<BlogPost>(params.id, {
			expand: 'author'
		});

		return {
			post: {
				...post,
				imageUrl: post.image
					? `${POCKETBASE_URL}/api/files/blog_posts/${post.id}/${post.image}`
					: null
			}
		};
	} catch {
		error(404, 'Post not found');
	}
};

export const actions: Actions = {
	delete: async ({ params, locals }) => {
		await ensureAdminAuth();

		try {
			const post = await adminPb.collection('blog_posts').getOne<BlogPost>(params.id);

			if (post.author !== locals.user!.id && locals.user!.role !== 'admin') {
				return fail(403, { error: 'Not authorized' });
			}

			await adminPb.collection('blog_posts').delete(params.id);
			redirect(303, '/dashboard/blog');
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 303) throw err;
			return fail(500, { error: 'Failed to delete post.' });
		}
	}
};
