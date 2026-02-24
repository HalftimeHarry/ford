import PocketBase from 'pocketbase';
import { POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD } from '$env/static/private';

// User-session client (used by hooks.server.ts for cookie auth)
export const pb = new PocketBase(POCKETBASE_URL);

// Dedicated admin client for server-side data access
export const adminPb = new PocketBase(POCKETBASE_URL);

export async function ensureAdminAuth() {
	if (adminPb.authStore.isValid) return;
	await adminPb.collection('_superusers').authWithPassword(
		POCKETBASE_ADMIN_EMAIL,
		POCKETBASE_ADMIN_PASSWORD
	);
}
