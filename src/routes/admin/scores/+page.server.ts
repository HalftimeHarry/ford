import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { gameResultSchema, isTeamAlive } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import type { NcaaTeam, GameResult } from '$lib/types';

export const load: PageServerLoad = async () => {
	await ensureAdminAuth();
	try {
		const [teams, results] = await Promise.all([
			adminPb.collection('ncaa_teams').getFullList<NcaaTeam>({ sort: 'region,seed' }),
			adminPb.collection('game_results').getFullList<GameResult>({ expand: 'team' })
		]);
		return { teams, results };
	} catch {
		return { teams: [], results: [] };
	}
};

export const actions: Actions = {
	bulkRecord: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const round = formData.get('tournament_round') as string;
		const loserIds = (formData.get('loser_ids') as string).split(',').filter(Boolean);
		// alive_team_ids = teams with no eliminated_round at submit time (sent from client)
		const aliveTeamIds = (formData.get('alive_team_ids') as string).split(',').filter(Boolean);

		if (!round || loserIds.length === 0) {
			return fail(400, { bulkError: 'No eliminated teams provided' });
		}

		// Winners = alive teams that are NOT in the loser list
		const winnerIds = aliveTeamIds.filter((id) => !loserIds.includes(id));

		// Fetch already-recorded results for this round to skip duplicates
		const existingResults = await adminPb.collection('game_results').getFullList<GameResult>({
			filter: `tournament_round = "${round}"`,
			requestKey: null
		});
		const alreadyRecordedIds = new Set(existingResults.map((r) => r.team));

		let wins = 0, losses = 0, skipped = 0;

		// Record winners — skip if already exists
		for (const teamId of winnerIds) {
			if (alreadyRecordedIds.has(teamId)) { skipped++; continue; }
			try {
				await adminPb.collection('game_results').create(
					{ team: teamId, tournament_round: round, won: true },
					{ requestKey: null }
				);
				wins++;
			} catch { skipped++; }
		}

		// Record losers — skip if already exists, update eliminated_round
		for (const teamId of loserIds) {
			if (alreadyRecordedIds.has(teamId)) { skipped++; continue; }
			try {
				await adminPb.collection('game_results').create(
					{ team: teamId, tournament_round: round, won: false },
					{ requestKey: null }
				);
				await adminPb.collection('ncaa_teams').update(
					teamId, { eliminated_round: round }, { requestKey: null }
				);
				losses++;
			} catch { skipped++; }
		}

		const totalWins = wins + existingResults.filter((r) => r.won).length;
		const totalLosses = losses + existingResults.filter((r) => !r.won).length;
		const msg = skipped > 0
			? `${totalWins} advanced, ${totalLosses} eliminated (${skipped} already recorded)`
			: `${totalWins} advanced, ${totalLosses} eliminated`;
		return { bulkSuccess: msg, completedRound: round };
	},

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

	// Swap two teams' results: the "mistake" (wrongly eliminated) and the "replacement" (wrongly advanced)
	swapPair: async ({ request }) => {
		await ensureAdminAuth();
		const formData = await request.formData();
		const mistakeId = formData.get('mistake_result_id') as string;   // was marked lost, should have won
		const replacementId = formData.get('replacement_result_id') as string; // was marked won, should have lost
		if (!mistakeId || !replacementId) return fail(400, { swapError: 'Both result IDs required' });
		try {
			// Fetch sequentially — concurrent requests on the same PocketBase client get auto-cancelled
			const mistake = await adminPb.collection('game_results').getOne<GameResult>(mistakeId, { requestKey: null });
			const replacement = await adminPb.collection('game_results').getOne<GameResult>(replacementId, { requestKey: null });
			// Flip results sequentially for the same reason
			await adminPb.collection('game_results').update(mistakeId, { won: true }, { requestKey: null });
			await adminPb.collection('game_results').update(replacementId, { won: false }, { requestKey: null });
			// Clear eliminated_round for the team that should have advanced
			await adminPb.collection('ncaa_teams').update(mistake.team, { eliminated_round: null }, { requestKey: null });
			// Set eliminated_round for the team that should have been eliminated
			await adminPb.collection('ncaa_teams').update(replacement.team, { eliminated_round: replacement.tournament_round }, { requestKey: null });
			return { swapSuccess: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to swap results';
			return fail(500, { swapError: message });
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
