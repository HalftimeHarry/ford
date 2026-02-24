import { describe, it, expect } from 'vitest';
import {
	calculateTeamPoints,
	isTeamAlive,
	SEED_MULTIPLIERS,
	FLAT_POINTS,
	type NcaaTeam,
	type TournamentRound,
	type Seed
} from '$lib/types';

describe('calculateTeamPoints', () => {
	it('applies seed multiplier for round 1', () => {
		// 1-seed in round 1: 1 * 1.5 = 1.5
		expect(calculateTeamPoints(1, 'round_1')).toBe(1.5);
		// 16-seed in round 1: 16 * 1.5 = 24
		expect(calculateTeamPoints(16, 'round_1')).toBe(24);
	});

	it('applies seed multiplier for round 2', () => {
		expect(calculateTeamPoints(1, 'round_2')).toBe(2.5);
		expect(calculateTeamPoints(8, 'round_2')).toBe(20);
	});

	it('applies seed multiplier for round 3', () => {
		expect(calculateTeamPoints(1, 'round_3')).toBe(3.5);
		expect(calculateTeamPoints(4, 'round_3')).toBe(14);
	});

	it('applies seed multiplier for round 4', () => {
		expect(calculateTeamPoints(1, 'round_4')).toBe(4.5);
		expect(calculateTeamPoints(2, 'round_4')).toBe(9);
	});

	it('returns flat 25 points for semifinal regardless of seed', () => {
		expect(calculateTeamPoints(1, 'semifinal')).toBe(25);
		expect(calculateTeamPoints(16, 'semifinal')).toBe(25);
		expect(calculateTeamPoints(8, 'semifinal')).toBe(25);
	});

	it('returns flat 50 points for final regardless of seed', () => {
		expect(calculateTeamPoints(1, 'final')).toBe(50);
		expect(calculateTeamPoints(16, 'final')).toBe(50);
	});

	it('higher seeds earn more points in early rounds (upset bonus)', () => {
		// A 16-seed winning round 1 earns more than a 1-seed
		const seed1 = calculateTeamPoints(1, 'round_1');
		const seed16 = calculateTeamPoints(16, 'round_1');
		expect(seed16).toBeGreaterThan(seed1);
	});

	it('points increase each round for the same seed', () => {
		const seed = 5 as Seed;
		const r1 = calculateTeamPoints(seed, 'round_1');
		const r2 = calculateTeamPoints(seed, 'round_2');
		const r3 = calculateTeamPoints(seed, 'round_3');
		const r4 = calculateTeamPoints(seed, 'round_4');
		expect(r2).toBeGreaterThan(r1);
		expect(r3).toBeGreaterThan(r2);
		expect(r4).toBeGreaterThan(r3);
	});

	it('computes a full tournament run for a 1-seed', () => {
		// 1-seed wins every round: 1.5 + 2.5 + 3.5 + 4.5 + 25 + 50 = 87
		const total =
			calculateTeamPoints(1, 'round_1') +
			calculateTeamPoints(1, 'round_2') +
			calculateTeamPoints(1, 'round_3') +
			calculateTeamPoints(1, 'round_4') +
			calculateTeamPoints(1, 'semifinal') +
			calculateTeamPoints(1, 'final');
		expect(total).toBe(87);
	});

	it('computes a full tournament run for a 16-seed (Cinderella)', () => {
		// 16-seed: 24 + 40 + 56 + 72 + 25 + 50 = 267
		const total =
			calculateTeamPoints(16, 'round_1') +
			calculateTeamPoints(16, 'round_2') +
			calculateTeamPoints(16, 'round_3') +
			calculateTeamPoints(16, 'round_4') +
			calculateTeamPoints(16, 'semifinal') +
			calculateTeamPoints(16, 'final');
		expect(total).toBe(267);
	});
});

describe('isTeamAlive', () => {
	const makeTeam = (eliminated_round: TournamentRound | null | string): NcaaTeam => ({
		id: 'test',
		name: 'Test',
		seed: 1 as Seed,
		region: 'East',
		eliminated_round: eliminated_round as TournamentRound | null,
		created: '',
		updated: ''
	});

	it('returns true when eliminated_round is null', () => {
		expect(isTeamAlive(makeTeam(null))).toBe(true);
	});

	it('returns true when eliminated_round is empty string (PB default)', () => {
		expect(isTeamAlive(makeTeam(''))).toBe(true);
	});

	it('returns false when eliminated in round_1', () => {
		expect(isTeamAlive(makeTeam('round_1'))).toBe(false);
	});

	it('returns false when eliminated in semifinal', () => {
		expect(isTeamAlive(makeTeam('semifinal'))).toBe(false);
	});

	it('returns false when eliminated in final', () => {
		expect(isTeamAlive(makeTeam('final'))).toBe(false);
	});
});

describe('scoring constants', () => {
	it('SEED_MULTIPLIERS covers rounds 1-4 only', () => {
		expect(Object.keys(SEED_MULTIPLIERS)).toEqual(['round_1', 'round_2', 'round_3', 'round_4']);
	});

	it('SEED_MULTIPLIERS increase each round', () => {
		expect(SEED_MULTIPLIERS.round_2).toBeGreaterThan(SEED_MULTIPLIERS.round_1);
		expect(SEED_MULTIPLIERS.round_3).toBeGreaterThan(SEED_MULTIPLIERS.round_2);
		expect(SEED_MULTIPLIERS.round_4).toBeGreaterThan(SEED_MULTIPLIERS.round_3);
	});

	it('FLAT_POINTS has semifinal and final', () => {
		expect(FLAT_POINTS.semifinal).toBe(25);
		expect(FLAT_POINTS.final).toBe(50);
	});
});
