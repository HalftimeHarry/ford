import type { Handle } from '@sveltejs/kit';
import { pb } from '$lib/pocketbase';
import type { User } from '$lib/types';

export const handle: Handle = async ({ event, resolve }) => {
	const cookie = event.cookies.get('pb_auth');

	if (cookie) {
		pb.authStore.loadFromCookie(cookie);

		try {
			if (pb.authStore.isValid) {
				await pb.collection('users').authRefresh();
				event.locals.user = pb.authStore.record as unknown as User;
			}
		} catch {
			pb.authStore.clear();
			event.cookies.delete('pb_auth', { path: '/' });
		}
	} else {
		event.locals.user = undefined;
	}

	return resolve(event);
};
