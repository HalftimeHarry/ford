import { buildLeaderboard } from '$lib/pocketbase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const leaderboard = await buildLeaderboard();
		return { leaderboard };
	} catch {
		return { leaderboard: [] };
	}
};
