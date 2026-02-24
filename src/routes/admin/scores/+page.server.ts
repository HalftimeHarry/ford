import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { gameResultSchema, calculateTeamPoints, isTeamAlive } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam, DraftPick, GameResult, User } from '$lib/types';

export const load: PageServerLoad = async () => {
	await ensureAdminAuth();
	try {
		const [teams, picks, results, participants] = await Promise.all([
			adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
			adminPb.collection('draft_picks').getFullList<DraftPick>({
				sort: 'pick_number',
				expand: 'user,team'
			}),
			adminPb.collection('game_results').getFullList<GameResult>({
				sort: 'created',
				expand: 'team'
			}),
			adminPb.collection('users').getFullList<User>({ filter: "role = 'participant'", sort: 'name' })
		]);

		// Scores derived entirely from win rows in game_results
		const scores: Record<string, { user: User; total: number; breakdown: { round: string; team: string; points: number }[] }> = {};

		for (const p of participants) {
			scores[p.id] = { user: p, total: 0, breakdown: [] };
		}

		for (const result of results) {
			if (!result.won) continue;
			const team = result.expand?.team;
			if (!team) continue;

			const pick = picks.find((pk) => pk.team === team.id);
			if (!pick || !scores[pick.user]) continue;

			const points = calculateTeamPoints(team.seed, result.tournament_round);
			scores[pick.user].total += points;
			scores[pick.user].breakdown.push({
				round: result.tournament_round,
				team: team.name,
				points
			});
		}

		const leaderboard = Object.values(scores).sort((a, b) => b.total - a.total);

		return { teams, results, leaderboard, picks };
	} catch {
		return { teams: [], results: [], leaderboard: [], picks: [] };
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
