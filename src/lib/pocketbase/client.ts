import PocketBase from 'pocketbase';
import { POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD } from '$env/static/private';

// User-session client — one instance per request is ideal but SvelteKit
// server modules are singletons, so disable auto-cancellation to prevent
// concurrent requests from cancelling each other.
export const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);

// Admin client for server-side data access
export const adminPb = new PocketBase(POCKETBASE_URL);
adminPb.autoCancellation(false);

let adminAuthExpiry = 0;

export async function ensureAdminAuth() {
	const now = Date.now();
	if (adminPb.authStore.isValid && now < adminAuthExpiry - 60_000) return;

	await adminPb.collection('_superusers').authWithPassword(
		POCKETBASE_ADMIN_EMAIL,
		POCKETBASE_ADMIN_PASSWORD
	);

	adminAuthExpiry = now + 60 * 60 * 1000;
}
