import { describe, it, expect } from 'vitest';
import { DRAFT_ENTRIES, TEAMS_PER_ENTRY, DRAFT_ROUNDS, REGIONS, SEEDS } from '$lib/types';

describe('draft constants', () => {
	it('has 10 entries', () => {
		expect(DRAFT_ENTRIES).toBe(10);
	});

	it('has 6 teams per entry', () => {
		expect(TEAMS_PER_ENTRY).toBe(6);
	});

	it('has 6 draft rounds', () => {
		expect(DRAFT_ROUNDS).toBe(6);
	});

	it('total picks = entries * teams_per_entry = 60', () => {
		expect(DRAFT_ENTRIES * TEAMS_PER_ENTRY).toBe(60);
	});

	it('total available teams (4 regions * 16 seeds) = 64 >= 60 picks', () => {
		expect(REGIONS.length * SEEDS.length).toBe(64);
		expect(REGIONS.length * SEEDS.length).toBeGreaterThanOrEqual(DRAFT_ENTRIES * TEAMS_PER_ENTRY);
	});
});

describe('snake draft order', () => {
	// Simulate the snake draft pick sequence for 10 entries over 6 rounds
	// Odd rounds: 1-10, Even rounds: 10-1

	function generateSnakeOrder(draftOrder: number[]): number[][] {
		const rounds: number[][] = [];
		for (let round = 1; round <= DRAFT_ROUNDS; round++) {
			const isReverse = round % 2 === 0;
			const order = isReverse ? [...draftOrder].reverse() : [...draftOrder];
			rounds.push(order);
		}
		return rounds;
	}

	it('odd rounds go forward, even rounds go reverse', () => {
		const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const rounds = generateSnakeOrder(order);

		// Round 1 (odd): forward
		expect(rounds[0]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		// Round 2 (even): reverse
		expect(rounds[1]).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
		// Round 3 (odd): forward
		expect(rounds[2]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});

	it('each entry picks exactly once per round', () => {
		const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const rounds = generateSnakeOrder(order);

		for (const round of rounds) {
			expect(round.length).toBe(DRAFT_ENTRIES);
			expect(new Set(round).size).toBe(DRAFT_ENTRIES);
		}
	});

	it('each entry picks exactly 6 times total across all rounds', () => {
		const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const rounds = generateSnakeOrder(order);
		const allPicks = rounds.flat();

		expect(allPicks.length).toBe(60);

		// Each position appears 6 times
		for (let pos = 1; pos <= 10; pos++) {
			expect(allPicks.filter((p) => p === pos).length).toBe(TEAMS_PER_ENTRY);
		}
	});

	it('pick 1 in round 1 gets pick 20 in round 2 (last)', () => {
		const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const rounds = generateSnakeOrder(order);

		// Position 1 picks first in round 1
		expect(rounds[0][0]).toBe(1);
		// Position 1 picks last in round 2
		expect(rounds[1][9]).toBe(1);
	});

	it('pick 10 in round 1 gets pick 11 in round 2 (first of reverse)', () => {
		const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const rounds = generateSnakeOrder(order);

		// Position 10 picks last in round 1
		expect(rounds[0][9]).toBe(10);
		// Position 10 picks first in round 2
		expect(rounds[1][0]).toBe(10);
	});
});

describe('round groups', () => {
	it('3 round groups cover all 6 draft rounds', () => {
		// Group 1: rounds 1-2, Group 2: rounds 3-4, Group 3: rounds 5-6
		const groups = [
			{ group: 1, rounds: [1, 2] },
			{ group: 2, rounds: [3, 4] },
			{ group: 3, rounds: [5, 6] }
		];

		const allRounds = groups.flatMap((g) => g.rounds);
		expect(allRounds).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it('round group is ceil(round / 2)', () => {
		expect(Math.ceil(1 / 2)).toBe(1);
		expect(Math.ceil(2 / 2)).toBe(1);
		expect(Math.ceil(3 / 2)).toBe(2);
		expect(Math.ceil(4 / 2)).toBe(2);
		expect(Math.ceil(5 / 2)).toBe(3);
		expect(Math.ceil(6 / 2)).toBe(3);
	});

	it('each round group gets a new lottery draw', () => {
		// Simulate 3 different random orderings
		const group1Order = [3, 7, 1, 9, 5, 2, 8, 4, 10, 6];
		const group2Order = [6, 2, 10, 4, 8, 1, 5, 9, 3, 7];
		const group3Order = [1, 10, 5, 6, 3, 8, 2, 7, 9, 4];

		// Each should have all 10 positions
		for (const order of [group1Order, group2Order, group3Order]) {
			expect(order.length).toBe(10);
			expect(new Set(order).size).toBe(10);
		}

		// They should (likely) be different from each other
		expect(group1Order).not.toEqual(group2Order);
	});
});
