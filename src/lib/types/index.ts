import { z } from 'zod';

// --- Roles ---
export const ROLES = ['admin', 'participant'] as const;
export type Role = (typeof ROLES)[number];

// --- NCAA Regions & Seeds ---
export const REGIONS = ['East', 'West', 'South', 'Midwest'] as const;
export type Region = (typeof REGIONS)[number];

export const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
export type Seed = (typeof SEEDS)[number];

// --- Tournament Rounds ---
export const TOURNAMENT_ROUNDS = [
	'round_1',
	'round_2',
	'round_3',
	'round_4',
	'semifinal',
	'final'
] as const;
export type TournamentRound = (typeof TOURNAMENT_ROUNDS)[number];

// Scoring: seed-based multipliers for rounds 1-4, flat points for semifinal/final
export const SEED_MULTIPLIERS: Record<Exclude<TournamentRound, 'semifinal' | 'final'>, number> = {
	round_1: 1.5,
	round_2: 2.5,
	round_3: 3.5,
	round_4: 4.5
};

export const FLAT_POINTS = { semifinal: 25, final: 50 } as const;

// --- Pool Types ---
export const POOL_TYPES = ['pool1', 'pool2'] as const;
export type PoolType = (typeof POOL_TYPES)[number];

// --- Draft Config ---
export const DRAFT_ENTRIES = 10;
export const TEAMS_PER_ENTRY = 6;
export const DRAFT_ROUNDS = 6;

// --- Draft Pick Modes ---
// admin: admin can always pick for anyone
// user: on-the-clock user picks for themselves (admin can still pick)
export const PICK_MODES = ['admin', 'user'] as const;
export type PickMode = (typeof PICK_MODES)[number];

// Timer presets in seconds
export const TIMER_PRESETS = [
	{ label: '1 min', value: 60 },
	{ label: '5 min', value: 300 },
	{ label: '10 min', value: 600 }
] as const;

export const DRAFT_STATUSES = ['not_started', 'in_progress', 'paused', 'completed'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

// --- PocketBase Record Types ---

export interface User {
	id: string;
	email: string;
	name: string;
	phone: string;
	role: Role;
	pool: PoolType;
	created: string;
	updated: string;
}

export interface Pool {
	id: string;
	slug: string;
	name: string;
	entry_fee: number;
	admin_fee: number;
	payout_1: number;
	payout_2: number;
	payout_3: number;
	created: string;
	updated: string;
}

export interface PoolEntry {
	id: string;
	user: string; // relation -> users
	pool: string; // relation -> pools
	paid: boolean;
	entry_number: number;
	created: string;
	updated: string;
	expand?: {
		user?: User;
		pool?: Pool;
	};
}

export interface NcaaTeam {
	id: string;
	name: string;
	seed: Seed;
	region: Region;
	eliminated_round: TournamentRound | null; // null = still alive
	created: string;
	updated: string;
}

export interface DraftPick {
	id: string;
	user: string; // relation -> users
	team: string; // relation -> ncaa_teams
	draft_round: number; // 1-6
	pick_number: number; // overall pick order
	created: string;
	updated: string;
	expand?: {
		user?: User;
		team?: NcaaTeam;
	};
}

export interface DraftOrder {
	id: string;
	user: string; // relation -> users
	position: number; // 1-10
	round_group: number; // 1 = rounds 1-2, 2 = rounds 3-4, 3 = rounds 5-6
	created: string;
	updated: string;
	expand?: {
		user?: User;
	};
}

export interface GameResult {
	id: string;
	team: string; // relation -> ncaa_teams
	tournament_round: TournamentRound;
	won: boolean;
	created: string;
	updated: string;
	expand?: {
		team?: NcaaTeam;
	};
}

export interface DraftSettings {
	id: string;
	pool: string; // relation -> pools
	status: DraftStatus;
	pick_mode: PickMode; // who makes the pick
	timer_seconds: number; // seconds per pick (0 = no timer)
	current_pick_deadline: string; // ISO timestamp when current pick expires
	allow_user_pick: boolean; // can the on-the-clock user submit their own pick
	created: string;
	updated: string;
	expand?: {
		pool?: Pool;
	};
}

// --- Zod Schemas ---

export const registerSchema = z
	.object({
		name: z.string().min(2, 'Name must be at least 2 characters'),
		email: z.string().email('Please enter a valid email address'),
		phone: z.string().optional(),
		password: z.string().min(8, 'Password must be at least 8 characters'),
		passwordConfirm: z.string(),
		pool: z.enum(POOL_TYPES, { message: 'Please select a pool' })
	})
	.refine((data) => data.password === data.passwordConfirm, {
		message: 'Passwords do not match',
		path: ['passwordConfirm']
	});

export const loginSchema = z.object({
	email: z.string().email('Please enter a valid email address'),
	password: z.string().min(1, 'Password is required')
});

export const draftPickSchema = z.object({
	user: z.string().min(1, 'User is required'),
	team: z.string().min(1, 'Team is required'),
	draft_round: z.number().min(1).max(DRAFT_ROUNDS),
	pick_number: z.number().min(1)
});

export const gameResultSchema = z.object({
	team: z.string().min(1, 'Team is required'),
	tournament_round: z.enum(TOURNAMENT_ROUNDS),
	won: z.boolean()
});

export const draftSettingsSchema = z.object({
	pool: z.string().min(1, 'Pool is required'),
	status: z.enum(DRAFT_STATUSES),
	pick_mode: z.enum(PICK_MODES),
	timer_seconds: z.number().min(0).max(600),
	allow_user_pick: z.boolean()
});

// --- Draft Helpers ---

/**
 * Get the snake-draft pick order for a given overall pick number.
 * Returns the position (1-10) in the draft order that should pick.
 * Odd rounds go forward (1-10), even rounds go reverse (10-1).
 */
export function getSnakePickPosition(pickNumber: number): { draftRound: number; positionIndex: number } {
	const draftRound = Math.ceil(pickNumber / DRAFT_ENTRIES);
	const pickInRound = ((pickNumber - 1) % DRAFT_ENTRIES); // 0-9
	const isReverse = draftRound % 2 === 0;
	const positionIndex = isReverse ? DRAFT_ENTRIES - 1 - pickInRound : pickInRound;
	return { draftRound, positionIndex };
}

/**
 * Auto-pick: select the best available team (lowest seed = strongest).
 * Tiebreak by region order: East, West, South, Midwest.
 */
export function autoPick(availableTeams: NcaaTeam[]): NcaaTeam | null {
	if (availableTeams.length === 0) return null;
	const sorted = [...availableTeams].sort((a, b) => {
		if (a.seed !== b.seed) return a.seed - b.seed;
		const regionOrder = REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region);
		return regionOrder;
	});
	return sorted[0];
}

// --- Scoring Helpers ---

export function calculateTeamPoints(seed: Seed, round: TournamentRound): number {
	if (round === 'semifinal') return FLAT_POINTS.semifinal;
	if (round === 'final') return FLAT_POINTS.final;
	return seed * SEED_MULTIPLIERS[round];
}

// Check if a team is still alive (no eliminated_round set)
export function isTeamAlive(team: NcaaTeam): boolean {
	return team.eliminated_round === null || team.eliminated_round === '';
}
