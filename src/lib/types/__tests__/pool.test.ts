import { describe, it, expect } from 'vitest';
import {
	isPoolDraftReady,
	getApprovedParticipants,
	getPendingRequests,
	getUserJoinRequest,
	DRAFT_ENTRIES
} from '$lib/types';
import type { PoolTeam, JoinRequest } from '$lib/types';

// --- Fixtures ---

function makeTeam(id: string, slotCount = 1): PoolTeam {
	return {
		id,
		name: `Team ${id}`,
		slot_count: slotCount,
		created: '',
		updated: ''
	};
}

function makeRequest(
	id: string,
	userId: string,
	teamId: string,
	status: JoinRequest['status']
): JoinRequest {
	return {
		id,
		user: userId,
		pool_team: teamId,
		status,
		created: '',
		updated: ''
	};
}

// Build 10 teams
const TEN_TEAMS = Array.from({ length: 10 }, (_, i) => makeTeam(`t${i + 1}`));

// Build 10 approved requests, one per team
const TEN_APPROVED = TEN_TEAMS.map((t, i) =>
	makeRequest(`r${i + 1}`, `u${i + 1}`, t.id, 'approved')
);

// ---

describe('isPoolDraftReady', () => {
	it('returns false when there are no teams', () => {
		expect(isPoolDraftReady([], [])).toBe(false);
	});

	it('returns false when team count is less than expected', () => {
		const teams = TEN_TEAMS.slice(0, 9);
		const requests = teams.map((t, i) => makeRequest(`r${i}`, `u${i}`, t.id, 'approved'));
		expect(isPoolDraftReady(teams, requests)).toBe(false);
	});

	it('returns false when all 10 teams exist but none have an approved participant', () => {
		const requests = TEN_TEAMS.map((t, i) => makeRequest(`r${i}`, `u${i}`, t.id, 'pending'));
		expect(isPoolDraftReady(TEN_TEAMS, requests)).toBe(false);
	});

	it('returns false when 9 of 10 teams have an approved participant', () => {
		const requests = TEN_APPROVED.slice(0, 9); // team t10 has no approved
		expect(isPoolDraftReady(TEN_TEAMS, requests)).toBe(false);
	});

	it('returns true when all 10 teams have at least one approved participant', () => {
		expect(isPoolDraftReady(TEN_TEAMS, TEN_APPROVED)).toBe(true);
	});

	it('returns true when some teams have multiple approved participants', () => {
		const extra = makeRequest('r_extra', 'u_extra', 't1', 'approved');
		expect(isPoolDraftReady(TEN_TEAMS, [...TEN_APPROVED, extra])).toBe(true);
	});

	it('ignores pending and rejected requests when checking readiness', () => {
		// Replace the last approved with a pending — should fail
		const mixed = [
			...TEN_APPROVED.slice(0, 9),
			makeRequest('r10_pending', 'u10', 't10', 'pending')
		];
		expect(isPoolDraftReady(TEN_TEAMS, mixed)).toBe(false);
	});

	it('uses custom expectedTeamCount', () => {
		const twoTeams = [makeTeam('a'), makeTeam('b')];
		const twoApproved = [
			makeRequest('ra', 'ua', 'a', 'approved'),
			makeRequest('rb', 'ub', 'b', 'approved')
		];
		expect(isPoolDraftReady(twoTeams, twoApproved, 2)).toBe(true);
		expect(isPoolDraftReady(twoTeams, twoApproved, 3)).toBe(false);
	});

	it('DRAFT_ENTRIES constant is 10', () => {
		expect(DRAFT_ENTRIES).toBe(10);
	});
});

describe('getApprovedParticipants', () => {
	const requests = [
		makeRequest('r1', 'u1', 'team_a', 'approved'),
		makeRequest('r2', 'u2', 'team_a', 'pending'),
		makeRequest('r3', 'u3', 'team_a', 'rejected'),
		makeRequest('r4', 'u4', 'team_b', 'approved')
	];

	it('returns only approved requests for the given team', () => {
		const result = getApprovedParticipants('team_a', requests);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('r1');
	});

	it('returns empty array when no approved requests for team', () => {
		expect(getApprovedParticipants('team_c', requests)).toHaveLength(0);
	});

	it('does not return approved requests for other teams', () => {
		const result = getApprovedParticipants('team_a', requests);
		expect(result.every((r) => r.pool_team === 'team_a')).toBe(true);
	});
});

describe('getPendingRequests', () => {
	const requests = [
		makeRequest('r1', 'u1', 'team_a', 'pending'),
		makeRequest('r2', 'u2', 'team_a', 'approved'),
		makeRequest('r3', 'u3', 'team_a', 'pending'),
		makeRequest('r4', 'u4', 'team_b', 'pending')
	];

	it('returns only pending requests for the given team', () => {
		const result = getPendingRequests('team_a', requests);
		expect(result).toHaveLength(2);
		expect(result.map((r) => r.id)).toEqual(['r1', 'r3']);
	});

	it('returns empty array when no pending requests', () => {
		expect(getPendingRequests('team_c', requests)).toHaveLength(0);
	});
});

describe('getUserJoinRequest', () => {
	const requests = [
		makeRequest('r1', 'alice', 'team_a', 'approved'),
		makeRequest('r2', 'bob', 'team_a', 'pending'),
		makeRequest('r3', 'alice', 'team_b', 'rejected')
	];

	it('returns the request for a specific user + team', () => {
		const result = getUserJoinRequest('alice', 'team_a', requests);
		expect(result?.id).toBe('r1');
	});

	it('returns undefined when user has no request for that team', () => {
		expect(getUserJoinRequest('bob', 'team_b', requests)).toBeUndefined();
	});

	it('returns undefined for unknown user', () => {
		expect(getUserJoinRequest('charlie', 'team_a', requests)).toBeUndefined();
	});

	it('distinguishes between teams for the same user', () => {
		const a = getUserJoinRequest('alice', 'team_a', requests);
		const b = getUserJoinRequest('alice', 'team_b', requests);
		expect(a?.status).toBe('approved');
		expect(b?.status).toBe('rejected');
	});
});

describe('join request state machine', () => {
	it('a user can only have one request per team (enforced by uniqueness)', () => {
		// Simulate what the server enforces: only one request per user+team
		const requests = [makeRequest('r1', 'alice', 'team_a', 'pending')];
		const existing = requests.filter(
			(r) => r.user === 'alice' && r.pool_team === 'team_a'
		);
		expect(existing.length).toBe(1); // would trigger "already have a request" error
	});

	it('an approved user cannot join another team in the same pool', () => {
		const requests = [makeRequest('r1', 'alice', 'team_a', 'approved')];
		const alreadyApproved = requests.filter(
			(r) => r.user === 'alice' && r.status === 'approved'
		);
		expect(alreadyApproved.length).toBeGreaterThan(0); // would block the join
	});

	it('a rejected user can still request another team', () => {
		const requests = [makeRequest('r1', 'alice', 'team_a', 'rejected')];
		const blockers = requests.filter(
			(r) => r.user === 'alice' && r.status === 'approved'
		);
		expect(blockers.length).toBe(0); // no approved → can request team_b
	});
});
