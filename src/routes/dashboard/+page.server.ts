import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { calculateTeamPoints, isTeamAlive } from '$lib/types';
import type { PageServerLoad } from './$types';
import type { NcaaTeam, DraftPick, GameResult, User } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	await ensureAdminAuth();
	const userId = locals.user!.id;

	try {
		const [myPicks, allPicks, results, participants] = await Promise.all([
			adminPb.collection('draft_picks').getFullList<DraftPick>({
				filter: `user = "${userId}"`,
				sort: 'pick_number',
				expand: 'team'
			}),
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

		// My teams — scores derived from win rows
		const myTeams = myPicks.map((pick) => {
			const team = pick.expand?.team;
			const teamWins = results.filter((r) => r.team === pick.team && r.won);
			const points = teamWins.reduce((sum, r) => {
				return sum + (team ? calculateTeamPoints(team.seed, r.tournament_round) : 0);
			}, 0);

			return {
				pick,
				team,
				points,
				eliminated: team ? !isTeamAlive(team) : false,
				eliminatedRound: team?.eliminated_round ?? null,
				wins: teamWins.length
			};
		});

		const myTotal = myTeams.reduce((sum, t) => sum + t.points, 0);

		// Leaderboard — same pattern: sum win rows
		const scores: Record<string, { user: User; total: number }> = {};
		for (const p of participants) {
			scores[p.id] = { user: p, total: 0 };
		}

		for (const result of results) {
			if (!result.won) continue;
			const team = result.expand?.team;
			if (!team) continue;
			const pick = allPicks.find((pk) => pk.team === team.id);
			if (!pick || !scores[pick.user]) continue;
			scores[pick.user].total += calculateTeamPoints(team.seed, result.tournament_round);
		}

		const leaderboard = Object.values(scores).sort((a, b) => b.total - a.total);

		return { myTeams, myTotal, leaderboard };
	} catch {
		return { myTeams: [], myTotal: 0, leaderboard: [] };
	}
};
