import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { POCKETBASE_URL } from '$env/static/private';
import type { PageServerLoad } from './$types';
import type { BlogPost } from '$lib/types';

export const load: PageServerLoad = async () => {
	await ensureAdminAuth();

	const posts = await adminPb.collection('blog_posts').getFullList<BlogPost>({
		sort: '-created',
		expand: 'author'
	});

	return {
		posts: posts.map((p) => ({
			...p,
			imageUrl: p.image
				? `${POCKETBASE_URL}/api/files/blog_posts/${p.id}/${p.image}`
				: null
		}))
	};
};
