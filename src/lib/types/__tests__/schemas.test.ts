import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, draftPickSchema, gameResultSchema } from '$lib/types';

describe('registerSchema', () => {
	const valid = {
		name: 'John Doe',
		email: 'john@example.com',
		phone: '555-1234',
		password: 'MADcap(123)',
		passwordConfirm: 'MADcap(123)',
		pool: 'pool1' as const
	};

	it('accepts valid registration data', () => {
		const result = registerSchema.safeParse(valid);
		expect(result.success).toBe(true);
	});

	it('accepts registration without phone', () => {
		const result = registerSchema.safeParse({ ...valid, phone: undefined });
		expect(result.success).toBe(true);
	});

	it('rejects name shorter than 2 chars', () => {
		const result = registerSchema.safeParse({ ...valid, name: 'J' });
		expect(result.success).toBe(false);
	});

	it('rejects invalid email', () => {
		const result = registerSchema.safeParse({ ...valid, email: 'not-an-email' });
		expect(result.success).toBe(false);
	});

	it('rejects password shorter than 8 chars', () => {
		const result = registerSchema.safeParse({
			...valid,
			password: 'short',
			passwordConfirm: 'short'
		});
		expect(result.success).toBe(false);
	});

	it('rejects mismatched passwords', () => {
		const result = registerSchema.safeParse({
			...valid,
			passwordConfirm: 'different123'
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			const paths = result.error.issues.map((i) => i.path.join('.'));
			expect(paths).toContain('passwordConfirm');
		}
	});

	it('rejects invalid pool value', () => {
		const result = registerSchema.safeParse({ ...valid, pool: 'pool3' });
		expect(result.success).toBe(false);
	});

	it('accepts pool1 and pool2', () => {
		expect(registerSchema.safeParse({ ...valid, pool: 'pool1' }).success).toBe(true);
		expect(registerSchema.safeParse({ ...valid, pool: 'pool2' }).success).toBe(true);
	});
});

describe('loginSchema', () => {
	it('accepts valid login data', () => {
		const result = loginSchema.safeParse({ email: 'john@example.com', password: 'test1234' });
		expect(result.success).toBe(true);
	});

	it('rejects invalid email', () => {
		const result = loginSchema.safeParse({ email: 'bad', password: 'test1234' });
		expect(result.success).toBe(false);
	});

	it('rejects empty password', () => {
		const result = loginSchema.safeParse({ email: 'john@example.com', password: '' });
		expect(result.success).toBe(false);
	});
});

describe('draftPickSchema', () => {
	const valid = {
		user: 'abc123',
		team: 'def456',
		draft_round: 1,
		pick_number: 1
	};

	it('accepts valid draft pick', () => {
		expect(draftPickSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects empty user', () => {
		expect(draftPickSchema.safeParse({ ...valid, user: '' }).success).toBe(false);
	});

	it('rejects empty team', () => {
		expect(draftPickSchema.safeParse({ ...valid, team: '' }).success).toBe(false);
	});

	it('rejects draft_round < 1', () => {
		expect(draftPickSchema.safeParse({ ...valid, draft_round: 0 }).success).toBe(false);
	});

	it('rejects draft_round > 6', () => {
		expect(draftPickSchema.safeParse({ ...valid, draft_round: 7 }).success).toBe(false);
	});

	it('accepts all valid draft rounds 1-6', () => {
		for (let r = 1; r <= 6; r++) {
			expect(draftPickSchema.safeParse({ ...valid, draft_round: r }).success).toBe(true);
		}
	});

	it('rejects pick_number < 1', () => {
		expect(draftPickSchema.safeParse({ ...valid, pick_number: 0 }).success).toBe(false);
	});
});

describe('gameResultSchema', () => {
	const valid = {
		team: 'abc123',
		tournament_round: 'round_1' as const,
		won: true
	};

	it('accepts valid game result', () => {
		expect(gameResultSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts all tournament rounds', () => {
		const rounds = ['round_1', 'round_2', 'round_3', 'round_4', 'semifinal', 'final'];
		for (const round of rounds) {
			expect(
				gameResultSchema.safeParse({ ...valid, tournament_round: round }).success
			).toBe(true);
		}
	});

	it('rejects invalid tournament round', () => {
		expect(
			gameResultSchema.safeParse({ ...valid, tournament_round: 'quarterfinal' }).success
		).toBe(false);
	});

	it('rejects empty team', () => {
		expect(gameResultSchema.safeParse({ ...valid, team: '' }).success).toBe(false);
	});

	it('accepts won=false (loss)', () => {
		expect(gameResultSchema.safeParse({ ...valid, won: false }).success).toBe(true);
	});
});
