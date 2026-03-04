import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth, buildLeaderboard } from '$lib/pocketbase';
import { gameResultSchema, isTeamAlive } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam, GameResult } from '$lib/types';

export const load: PageServerLoad = async () => {
	await ensureAdminAuth();
	try {
		const [teams, results, leaderboard] = await Promise.all([
			adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
			adminPb.collection('game_results').getFullList<GameResult>({ expand: 'team' }),
			buildLeaderboard()
		]);
		return { teams, results, leaderboard };
	} catch {
		return { teams: [], results: [], leaderboard: [] };
	}
};

export const actions: Actions = {
	recordResult: async ({ request }) => {
		const formData = await request.formData();
		const data = {
			team: formData.get('team') as string,
			tournament_round: formData.get('tournament_round') as string,
			won: formData.get('won') === 'true'
		};

		const result = gameResultSchema.safeParse(data);
		if (!result.success) {
			return fail(400, { resultError: result.error.issues[0].message });
		}

		try {
			// Check for duplicate result (unique team + tournament_round)
			const existing = await adminPb.collection('game_results').getList<GameResult>(1, 1, {
				filter: `team = "${result.data.team}" && tournament_round = "${result.data.tournament_round}"`
			});
			if (existing.totalItems > 0) {
				return fail(400, { resultError: 'A result for this team in this round already exists' });
			}

			await adminPb.collection('game_results').create(result.data);

			// If team lost, record which round they were eliminated in
			if (!result.data.won) {
				await adminPb.collection('ncaa_teams').update(data.team, {
					eliminated_round: result.data.tournament_round
				});
			}

			return { resultSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to record result';
			return fail(500, { resultError: message });
		}
	},

	deleteResult: async ({ request }) => {
		const formData = await request.formData();
		const resultId = formData.get('result_id') as string;

		try {
			// Get the result before deleting to check if we need to clear eliminated_round
			const gameResult = await adminPb.collection('game_results').getOne<GameResult>(resultId);
			await adminPb.collection('game_results').delete(resultId);

			// If this was a loss, clear the eliminated_round
			if (!gameResult.won) {
				await adminPb.collection('ncaa_teams').update(gameResult.team, {
					eliminated_round: null
				});
			}

			return { deleteSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to delete result';
			return fail(500, { resultError: message });
		}
	}
};
