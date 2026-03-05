import { adminPb, ensureAdminAuth } from './client';
import { calculateTeamPoints } from '$lib/types';
import type { NcaaTeam, DraftPick, GameResult, PoolTeam, JoinRequest } from '$lib/types';

export interface LeaderboardEntry {
	poolTeam: PoolTeam;
	total: number;
	breakdown: { round: string; team: string; seed: number; points: number }[];
}

/**
 * Builds the scored leaderboard from game_results + draft_picks, grouped by pool_team.
 * Returns entries sorted by total descending.
 * Safe to call before the draft — returns empty array if no picks exist.
 */
export async function buildLeaderboard(): Promise<LeaderboardEntry[]> {
	await ensureAdminAuth();

	const [picks, results, poolTeams, joinRequests] = await Promise.all([
		adminPb.collection('draft_picks').getFullList<DraftPick>({
			sort: 'pick_number',
			expand: 'user,team'
		}),
		adminPb.collection('game_results').getFullList<GameResult>({ expand: 'team' }),
		adminPb.collection('pool_teams').getFullList<PoolTeam>({ sort: 'name' }),
		adminPb.collection('join_requests').getFullList<JoinRequest>({ filter: "status = 'approved'" })
	]);

	// Map user id -> pool_team id from approved join requests
	const userToPoolTeam: Record<string, string> = {};
	for (const req of joinRequests) {
		userToPoolTeam[req.user] = req.pool_team;
	}

	const scores: Record<string, LeaderboardEntry> = {};
	for (const pt of poolTeams) {
		scores[pt.id] = { poolTeam: pt, total: 0, breakdown: [] };
	}

	for (const result of results) {
		if (!result.won) continue;
		const ncaaTeam = result.expand?.team as NcaaTeam | undefined;
		if (!ncaaTeam) continue;
		const pick = picks.find((pk) => pk.team === ncaaTeam.id);
		if (!pick) continue;
		const poolTeamId = userToPoolTeam[pick.user];
		if (!poolTeamId || !scores[poolTeamId]) continue;
		const points = calculateTeamPoints(ncaaTeam.seed, result.tournament_round);
		scores[poolTeamId].total += points;
		scores[poolTeamId].breakdown.push({
			round: result.tournament_round,
			team: ncaaTeam.name,
			seed: ncaaTeam.seed,
			points
		});
	}

	return Object.values(scores).sort((a, b) => b.total - a.total);
}
