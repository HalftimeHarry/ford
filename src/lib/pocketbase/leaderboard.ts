import { adminPb, ensureAdminAuth } from './client';
import { calculateTeamPoints } from '$lib/types';
import type { NcaaTeam, DraftPick, GameResult, User } from '$lib/types';

export interface LeaderboardEntry {
	user: User;
	total: number;
	breakdown: { round: string; team: string; seed: number; points: number }[];
}

/**
 * Builds the scored leaderboard from game_results + draft_picks.
 * Returns entries sorted by total descending.
 * Safe to call before the draft — returns empty array if no picks exist.
 */
export async function buildLeaderboard(): Promise<LeaderboardEntry[]> {
	await ensureAdminAuth();

	const [picks, results, participants] = await Promise.all([
		adminPb.collection('draft_picks').getFullList<DraftPick>({
			sort: 'pick_number',
			expand: 'user,team'
		}),
		adminPb.collection('game_results').getFullList<GameResult>({ expand: 'team' }),
		adminPb.collection('users').getFullList<User>({ filter: "role = 'participant'", sort: 'name' })
	]);

	const scores: Record<string, LeaderboardEntry> = {};
	for (const p of participants) {
		scores[p.id] = { user: p, total: 0, breakdown: [] };
	}

	for (const result of results) {
		if (!result.won) continue;
		const team = result.expand?.team as NcaaTeam | undefined;
		if (!team) continue;
		const pick = picks.find((pk) => pk.team === team.id);
		if (!pick || !scores[pick.user]) continue;
		const points = calculateTeamPoints(team.seed, result.tournament_round);
		scores[pick.user].total += points;
		scores[pick.user].breakdown.push({
			round: result.tournament_round,
			team: team.name,
			seed: team.seed,
			points
		});
	}

	return Object.values(scores).sort((a, b) => b.total - a.total);
}
