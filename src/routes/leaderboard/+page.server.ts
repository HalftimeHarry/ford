import { adminPb, ensureAdminAuth, buildLeaderboard } from '$lib/pocketbase';
import type { DraftPick, GameResult, PoolTeam } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		await ensureAdminAuth();
		const [leaderboard, picks, results, poolTeams] = await Promise.all([
			buildLeaderboard(),
			adminPb.collection('draft_picks').getFullList<DraftPick>({
				sort: 'pick_number',
				expand: 'team,pool_team'
			}),
			adminPb.collection('game_results').getFullList<GameResult>({ expand: 'team' }),
			adminPb.collection('pool_teams').getFullList<PoolTeam>({ sort: 'name' })
		]);
		return { leaderboard, picks, results, poolTeams };
	} catch {
		return { leaderboard: [], picks: [], results: [], poolTeams: [] };
	}
};
