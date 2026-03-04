import { fail } from '@sveltejs/kit';
import { adminPb, ensureAdminAuth } from '$lib/pocketbase';
import { calculateTeamPoints, isTeamAlive, isPoolDraftReady } from '$lib/types';
import type { PageServerLoad, Actions } from './$types';
import type { NcaaTeam, DraftPick, GameResult, User, PoolTeam, JoinRequest, DraftSettings } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	await ensureAdminAuth();
	const userId = locals.user!.id;

	// Always load: pool teams + join requests (needed for pre-draft join flow)
	const [poolTeams, allRequests] = await Promise.all([
		adminPb.collection('pool_teams').getFullList<PoolTeam>({ sort: 'name' }),
		adminPb.collection('join_requests').getFullList<JoinRequest>({ expand: 'user,pool_team' })
	]);

	const myRequests = allRequests.filter((r) => r.user === userId);
	const draftReady = isPoolDraftReady(poolTeams, allRequests);

	// Check draft status — only load scoring data if draft has started
	let draftSettings: DraftSettings | null = null;
	try {
		const list = await adminPb.collection('draft_settings').getFullList<DraftSettings>();
		draftSettings = list[0] ?? null;
	} catch {
		// no settings record yet
	}

	const draftStarted = draftSettings?.status === 'in_progress' ||
		draftSettings?.status === 'paused' ||
		draftSettings?.status === 'completed';

	if (!draftStarted) {
		return { poolTeams, allRequests, myRequests, draftReady, myTeams: [], myTotal: 0, leaderboard: [] };
	}

	// Post-draft: load scoring data — fetch all picks once, filter in JS
	const allPicks = await adminPb.collection('draft_picks').getFullList<DraftPick>({
		sort: 'pick_number',
		expand: 'user,team'
	});
	const myPicks = allPicks.filter((p) => p.user === userId);

	const [results, participants] = await Promise.all([
		adminPb.collection('game_results').getFullList<GameResult>({ sort: 'created', expand: 'team' }),
		adminPb.collection('users').getFullList<User>({ filter: "role = 'participant'", sort: 'name' })
	]);

	const myTeams = myPicks.map((pick) => {
		const team = pick.expand?.team as NcaaTeam | undefined;
		const teamWins = results.filter((r) => r.team === pick.team && r.won);
		const points = teamWins.reduce(
			(sum, r) => sum + (team ? calculateTeamPoints(team.seed, r.tournament_round) : 0),
			0
		);
		return {
			pick, team, points,
			eliminated: team ? !isTeamAlive(team) : false,
			eliminatedRound: team?.eliminated_round ?? null,
			wins: teamWins.length
		};
	});

	const myTotal = myTeams.reduce((sum, t) => sum + t.points, 0);

	const scores: Record<string, { user: User; total: number }> = {};
	for (const p of participants) scores[p.id] = { user: p, total: 0 };
	for (const result of results) {
		if (!result.won) continue;
		const team = result.expand?.team as NcaaTeam | undefined;
		if (!team) continue;
		const pick = allPicks.find((pk) => pk.team === team.id);
		if (!pick || !scores[pick.user]) continue;
		scores[pick.user].total += calculateTeamPoints(team.seed, result.tournament_round);
	}
	const leaderboard = Object.values(scores).sort((a, b) => b.total - a.total);

	return { poolTeams, allRequests, myRequests, draftReady, myTeams, myTotal, leaderboard };
};

export const actions: Actions = {
	joinTeam: async ({ request, locals }) => {
		await ensureAdminAuth();
		const userId = locals.user!.id;
		const formData = await request.formData();
		const teamId = formData.get('team_id') as string;
		if (!teamId) return fail(400, { joinError: 'Team ID required' });

		const existingApproved = await adminPb.collection('join_requests').getFullList<JoinRequest>({
			filter: `user = "${userId}" && status = "approved"`
		});
		if (existingApproved.length > 0) {
			return fail(400, { joinError: 'You are already approved on a team' });
		}

		const existing = await adminPb.collection('join_requests').getFullList<JoinRequest>({
			filter: `user = "${userId}" && pool_team = "${teamId}"`
		});
		if (existing.length > 0) {
			return fail(400, { joinError: 'You already have a request for this team' });
		}

		try {
			await adminPb.collection('join_requests').create({
				user: userId,
				pool_team: teamId,
				status: 'pending'
			});
			return { joinSuccess: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to submit request';
			return fail(500, { joinError: message });
		}
	},

	withdrawRequest: async ({ request, locals }) => {
		await ensureAdminAuth();
		const userId = locals.user!.id;
		const formData = await request.formData();
		const requestId = formData.get('request_id') as string;
		if (!requestId) return fail(400, { withdrawError: 'Request ID required' });

		const req = await adminPb.collection('join_requests').getOne<JoinRequest>(requestId);
		if (req.user !== userId) return fail(403, { withdrawError: 'Not your request' });
		if (req.status !== 'pending') return fail(400, { withdrawError: 'Can only withdraw pending requests' });

		await adminPb.collection('join_requests').delete(requestId);
		return { withdrawSuccess: true };
	}
};
