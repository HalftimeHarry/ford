import { describe, it, expect } from 'vitest';
import { autoPick, getSnakePickPosition, type NcaaTeam, type Seed, type Region } from '$lib/types';

function makeTeam(name: string, seed: Seed, region: Region): NcaaTeam {
	return {
		id: `${region}-${seed}`,
		name,
		seed,
		region,
		eliminated_round: null,
		created: '',
		updated: ''
	};
}

describe('autoPick', () => {
	it('returns null for empty list', () => {
		expect(autoPick([])).toBeNull();
	});

	it('picks the lowest seed (strongest team)', () => {
		const teams = [
			makeTeam('Team A', 8, 'East'),
			makeTeam('Team B', 1, 'West'),
			makeTeam('Team C', 4, 'South')
		];
		const pick = autoPick(teams);
		expect(pick?.seed).toBe(1);
		expect(pick?.name).toBe('Team B');
	});

	it('breaks ties by region order (East first)', () => {
		const teams = [
			makeTeam('West 1', 1, 'West'),
			makeTeam('East 1', 1, 'East'),
			makeTeam('South 1', 1, 'South')
		];
		const pick = autoPick(teams);
		expect(pick?.region).toBe('East');
	});

	it('region tiebreak order is East, West, South, Midwest', () => {
		const teams = [
			makeTeam('Midwest 3', 3, 'Midwest'),
			makeTeam('South 3', 3, 'South'),
			makeTeam('West 3', 3, 'West'),
			makeTeam('East 3', 3, 'East')
		];
		const pick = autoPick(teams);
		expect(pick?.region).toBe('East');

		// Remove East, should pick West next
		const remaining = teams.filter((t) => t.region !== 'East');
		expect(autoPick(remaining)?.region).toBe('West');
	});

	it('picks seed 2 when no seed 1 available', () => {
		const teams = [
			makeTeam('Team A', 5, 'East'),
			makeTeam('Team B', 2, 'West'),
			makeTeam('Team C', 3, 'South')
		];
		expect(autoPick(teams)?.seed).toBe(2);
	});

	it('does not mutate the input array', () => {
		const teams = [
			makeTeam('Team A', 8, 'East'),
			makeTeam('Team B', 1, 'West')
		];
		const original = [...teams];
		autoPick(teams);
		expect(teams).toEqual(original);
	});
});

describe('getSnakePickPosition', () => {
	it('pick 1 is round 1, position 0 (first)', () => {
		const { draftRound, positionIndex } = getSnakePickPosition(1);
		expect(draftRound).toBe(1);
		expect(positionIndex).toBe(0);
	});

	it('pick 10 is round 1, position 9 (last)', () => {
		const { draftRound, positionIndex } = getSnakePickPosition(10);
		expect(draftRound).toBe(1);
		expect(positionIndex).toBe(9);
	});

	it('pick 11 is round 2, position 9 (reverse: last goes first)', () => {
		const { draftRound, positionIndex } = getSnakePickPosition(11);
		expect(draftRound).toBe(2);
		expect(positionIndex).toBe(9); // reverse: 10-1-0 = 9
	});

	it('pick 20 is round 2, position 0 (reverse: first goes last)', () => {
		const { draftRound, positionIndex } = getSnakePickPosition(20);
		expect(draftRound).toBe(2);
		expect(positionIndex).toBe(0);
	});

	it('pick 21 is round 3, position 0 (forward again)', () => {
		const { draftRound, positionIndex } = getSnakePickPosition(21);
		expect(draftRound).toBe(3);
		expect(positionIndex).toBe(0);
	});

	it('pick 60 is round 6, position 0 (last pick, reverse round)', () => {
		const { draftRound, positionIndex } = getSnakePickPosition(60);
		expect(draftRound).toBe(6);
		expect(positionIndex).toBe(0);
	});

	it('all 60 picks produce valid positions 0-9', () => {
		for (let pick = 1; pick <= 60; pick++) {
			const { draftRound, positionIndex } = getSnakePickPosition(pick);
			expect(draftRound).toBeGreaterThanOrEqual(1);
			expect(draftRound).toBeLessThanOrEqual(6);
			expect(positionIndex).toBeGreaterThanOrEqual(0);
			expect(positionIndex).toBeLessThanOrEqual(9);
		}
	});

	it('each position appears exactly once per round', () => {
		for (let round = 1; round <= 6; round++) {
			const positions: number[] = [];
			for (let pickInRound = 0; pickInRound < 10; pickInRound++) {
				const pickNumber = (round - 1) * 10 + pickInRound + 1;
				const { positionIndex } = getSnakePickPosition(pickNumber);
				positions.push(positionIndex);
			}
			expect(new Set(positions).size).toBe(10);
		}
	});
});
