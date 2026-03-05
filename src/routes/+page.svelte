<script lang="ts">
	import { enhance } from '$app/forms';
	import fordLogo from '$lib/assets/ford_logo.png';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import Users from '@lucide/svelte/icons/users';
	import Trophy from '@lucide/svelte/icons/trophy';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import DollarSign from '@lucide/svelte/icons/dollar-sign';
	import LeaderboardComponent from '$lib/components/Leaderboard.svelte';

	let { form, data } = $props();

	let loading = $state(false);
	let activeTab = $state<'register' | 'login'>('register');
</script>

<svelte:head>
	<title>NCAA Basketball Pool 2026 - Power Player's Pool</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Hero Section -->
	<header class="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent py-16 text-primary-foreground">
		<div class="absolute inset-0 opacity-10">
			<div class="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/20"></div>
			<div class="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-white/10"></div>
		</div>
		<div class="relative mx-auto max-w-4xl px-4 text-center">
			<img
				src={fordLogo}
				alt="Ford Logo"
				class="mx-auto mb-6 h-32 w-32 rounded-full border-4 border-white/30 bg-white/90 object-contain p-2 shadow-lg"
			/>
			<h1 class="mb-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
				NCAA Basketball Pool
			</h1>
			<p class="text-xl font-semibold tracking-wide opacity-90">
				Power Player's Pool 2026
			</p>
			<p class="mt-3 text-lg opacity-80">
				DRAFT — MONDAY, MARCH 16, 2026 · 5:30 PM · CRUST
			</p>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-12">
		<div class="grid gap-10 lg:grid-cols-5">
			<!-- Content Section -->
			<div class="lg:col-span-3 space-y-8">
				<!-- Latest Updates -->
				<Card.Card class="border-accent/40 bg-accent/5">
					<Card.CardHeader class="pb-3">
						<Card.CardTitle class="flex items-center gap-2 text-xl font-bold text-primary">
							<CalendarDays class="h-5 w-5" /> Latest Update
						</Card.CardTitle>
						<p class="text-xs text-muted-foreground">Posted March 2025</p>
					</Card.CardHeader>
					<Card.CardContent class="space-y-4 text-sm">
						<div class="space-y-1">
							<p class="font-semibold text-base">Draft Night — Monday, March 16 · 5:30 PM</p>
							<p class="text-muted-foreground">
								We cannot do team selection at Saddle or Red's, so we're tentatively set for the
								<strong>large backroom at Crust</strong> on <strong>Monday, March 16 at 5:30</strong>.
								Location will be confirmed once locked up.
							</p>
						</div>
						<Separator />
						<div class="space-y-1">
							<p class="font-semibold">Confirm your entry</p>
							<p class="text-muted-foreground">
								Please confirm you're playing. If I don't have a partner listed for you, let me know.
							</p>
						</div>
						<Separator />
						<div class="space-y-1">
							<p class="font-semibold">Entry Fees — due Saturday, March 14</p>
							<p class="text-muted-foreground">
								I'll be at Saddle on Saturday after Duke beats UNC to collect fees and answer questions.
								You can also pay via <strong>Venmo or Zelle</strong>, or leave with
								<strong>Mike Garcia at Saddle</strong> if he's willing.
							</p>
							<p class="font-medium text-destructive">Fees must be paid by Saturday, March 14 to participate.</p>
						</div>
					</Card.CardContent>
				</Card.Card>

				<!-- Pool #2 Entry -->
				<Card.Card>
					<Card.CardHeader>
						<Card.CardTitle class="flex items-center gap-2 text-2xl font-bold text-primary">
							<Trophy class="h-5 w-5" /> Ford's Pool — $1,200
						</Card.CardTitle>
					</Card.CardHeader>
					<Card.CardContent>
						<div class="rounded-lg border-2 border-accent/30 bg-accent/5 p-5 text-center">
							<div class="flex items-center justify-center gap-2">
								<DollarSign class="h-6 w-6 text-accent" />
								<p class="text-3xl font-extrabold text-accent">$1,200</p>
							</div>
							<p class="text-sm text-muted-foreground">per team + $50 entry fee</p>
							<Separator class="my-3" />
							<p class="text-sm font-medium">Pays 1st, 2nd &amp; 3rd Place</p>
							<div class="mt-2 overflow-hidden rounded-lg border">
								{#each [
									{ place: '🥇 1st Place', amount: '$7,500' },
									{ place: '🥈 2nd Place', amount: '$3,000' },
									{ place: '🥉 3rd Place', amount: '$1,500' },
								] as row, i}
									<div class="flex items-center justify-between px-4 py-2 text-sm {i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
										<span class="font-medium">{row.place}</span>
										<span class="font-bold text-primary">{row.amount}</span>
									</div>
								{/each}
							</div>
						</div>
						<p class="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
							<CalendarDays class="h-4 w-4 shrink-0" />
							Entry fees due by <strong>Saturday, March 14</strong>. Venmo, Zelle, or pay Mike Garcia at Saddle.
						</p>
					</Card.CardContent>
				</Card.Card>

				<!-- Entrants -->
				<Card.Card>
					<Card.CardHeader>
						<Card.CardTitle class="flex items-center gap-2 text-2xl font-bold text-primary">
							<Users class="h-5 w-5" /> Entrants
						</Card.CardTitle>
					</Card.CardHeader>
					<Card.CardContent>
						<ol class="overflow-hidden rounded-lg border text-sm">
							{#each [
								{ n: 1, name: 'Doan, JK & Stutts', note: '2 teams' },
								{ n: 2, name: 'Kevin & Lisa Hassett with Dustin' },
								{ n: 3, name: 'Mike Scott & George' },
								{ n: 4, name: 'Ryan & friends' },
								{ n: 5, name: 'Charlie & TBD' },
								{ n: 6, name: 'Mike Garcia' },
								{ n: 7, name: 'Matt Weaver' },
								{ n: 8, name: 'Dan Gaston' },
								{ n: 9, name: 'Mike T & Ritchie Bartlett' },
							] as entry, i}
								<li class="flex items-center gap-3 px-4 py-2.5 {i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
									<span class="w-5 text-right font-bold text-muted-foreground">{entry.n}.</span>
									<span class="flex-1">{entry.name}</span>
									{#if entry.note}<span class="text-xs text-muted-foreground">{entry.note}</span>{/if}
								</li>
							{/each}
						</ol>
						<p class="mt-3 text-xs text-muted-foreground">10 entries total · teams TBD at draft</p>
					</Card.CardContent>
				</Card.Card>

				<!-- How It Works -->
				<Card.Card>
					<Card.CardHeader>
						<Card.CardTitle class="flex items-center gap-2 text-2xl font-bold text-primary">
							<Shuffle class="h-5 w-5" /> How It Works
						</Card.CardTitle>
					</Card.CardHeader>
					<Card.CardContent class="space-y-4 text-foreground/85 leading-relaxed">
						<p>
							There are ten entries in our pool so each entry will get 6 NCAA teams for its roster.
							We will use a draft format to select the NCAA teams.
						</p>
						<p>
							First we have a lottery draw — golf balls numbered 1 to 10 — to determine draft selection order.
							Then we select NCAA teams in order. When a team is selected, it is no longer available to others.
							Be sure to mark out each team selected as we go. A sheet listing teams in each region by seed (1–16) will be provided.
						</p>
						<div class="overflow-hidden rounded-lg border">
							<div class="bg-primary/5 px-4 py-2.5 font-semibold text-foreground flex items-center gap-2">
								<Shuffle class="h-4 w-4 text-primary" /> Draft Rounds
							</div>
							{#each [
								{ label: 'Rounds 1–2', desc: 'Draw order, then reverse for round 2 (pick 10 also gets 11, pick 1 waits until 20th).' },
								{ label: 'Rounds 3–4', desc: 'New draw, then reverse again.' },
								{ label: 'Rounds 5–6', desc: 'New draw, then reverse again.' },
							] as row, i}
								<div class="flex gap-3 px-4 py-2.5 text-sm {i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
									<CircleCheck class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
									<span><strong>{row.label}:</strong> {row.desc}</span>
								</div>
							{/each}
							<div class="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/30">60 NCAA teams selected total — and we're done.</div>
						</div>
					</Card.CardContent>
				</Card.Card>

				<!-- Live Standings (only shown once any participant has scored) -->
				{#if (data?.leaderboard ?? []).some(e => e.total > 0)}
					<Card.Card>
						<Card.CardHeader>
							<div class="flex items-center justify-between">
								<Card.CardTitle class="flex items-center gap-2 text-2xl font-bold text-primary">
									<Trophy class="h-5 w-5" /> Live Standings
								</Card.CardTitle>
								<a href="/leaderboard" class="text-sm font-medium text-primary hover:underline">
									Full standings ↗
								</a>
							</div>
						</Card.CardHeader>
						<Card.CardContent>
							<LeaderboardComponent entries={data.leaderboard} limit={5} compact={true} />
						</Card.CardContent>
					</Card.Card>
				{/if}

				<!-- Scoring -->
				<Card.Card>
					<Card.CardHeader>
						<Card.CardTitle class="flex items-center gap-2 text-2xl font-bold text-primary">
							<ChartBar class="h-5 w-5" /> Scoring
						</Card.CardTitle>
					</Card.CardHeader>
					<Card.CardContent>
						<div class="overflow-hidden rounded-lg border">
							<table class="w-full text-sm">
								<thead>
									<tr class="bg-primary text-primary-foreground">
										<th class="px-4 py-2.5 text-left font-semibold">Round</th>
										<th class="px-4 py-2.5 text-right font-semibold">Points</th>
									</tr>
								</thead>
								<tbody>
									{#each [
										{ round: '1st Round', pts: '1.5 × seed', special: false },
										{ round: '2nd Round', pts: '2.5 × seed', special: false },
										{ round: '3rd Round (Sweet 16)', pts: '3.5 × seed', special: false },
										{ round: '4th Round (Elite 8)', pts: '4.5 × seed', special: false },
										{ round: 'Semi-Final (Final Four)', pts: '25 pts', special: true },
										{ round: 'Final (Championship)', pts: '50 pts', special: true },
									] as row, i}
										<tr class="border-b {row.special ? 'bg-accent/10 font-semibold' : i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}">
											<td class="px-4 py-2.5">{row.round}</td>
											<td class="px-4 py-2.5 text-right font-bold {row.special ? 'text-accent' : ''}">{row.pts}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p class="mt-4 text-center text-lg font-extrabold uppercase tracking-wider text-primary">
							Team with the most points wins!
						</p>
					</Card.CardContent>
				</Card.Card>
			</div>

			<!-- Auth Form -->
			<div class="lg:col-span-2">
				<div class="sticky top-8">
					<Card.Card class="border-2 border-primary/20 shadow-lg">
						<Card.CardHeader class="bg-primary/5 pb-0">
							<div class="flex border-b">
								<button
									class="flex-1 py-2.5 text-center text-sm font-semibold transition-colors {activeTab === 'register' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}"
									onclick={() => activeTab = 'register'}
								>
									Register
								</button>
								<button
									class="flex-1 py-2.5 text-center text-sm font-semibold transition-colors {activeTab === 'login' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}"
									onclick={() => activeTab = 'login'}
								>
									Sign In
								</button>
							</div>
						</Card.CardHeader>
						<Card.CardContent class="pt-6">
							{#if activeTab === 'register'}
								{#if form?.success}
									<div class="rounded-lg bg-accent/10 border border-accent/30 p-4 text-center">
										<p class="text-lg font-bold text-accent">Registration Submitted!</p>
										<p class="mt-1 text-sm text-muted-foreground">You can now sign in with your credentials.</p>
									</div>
								{:else}
									<form method="POST" action="?/register" use:enhance={() => {
										loading = true;
										return async ({ update }) => {
											loading = false;
											await update();
										};
									}}>
										<div class="space-y-4">
											<div class="space-y-2">
												<Label for="name">Full Name</Label>
												<Input
													id="name"
													name="name"
													type="text"
													placeholder="John Doe"
													required
													value={form?.data?.name ?? ''}
												/>
												{#if form?.errors?.name}
													<p class="text-sm text-destructive">{form.errors.name}</p>
												{/if}
											</div>

											<div class="space-y-2">
												<Label for="reg-email">Email</Label>
												<Input
													id="reg-email"
													name="email"
													type="email"
													placeholder="john@example.com"
													required
													value={form?.data?.email ?? ''}
												/>
												{#if form?.errors?.email}
													<p class="text-sm text-destructive">{form.errors.email}</p>
												{/if}
											</div>

											<div class="space-y-2">
												<Label for="phone">Phone Number</Label>
												<Input
													id="phone"
													name="phone"
													type="tel"
													placeholder="(555) 123-4567"
													value={form?.data?.phone ?? ''}
												/>
												{#if form?.errors?.phone}
													<p class="text-sm text-destructive">{form.errors.phone}</p>
												{/if}
											</div>

											<div class="space-y-2">
												<Label for="password">Password</Label>
												<Input
													id="password"
													name="password"
													type="password"
													placeholder="Create a password"
													required
												/>
												{#if form?.errors?.password}
													<p class="text-sm text-destructive">{form.errors.password}</p>
												{/if}
											</div>

											<div class="space-y-2">
												<Label for="passwordConfirm">Confirm Password</Label>
												<Input
													id="passwordConfirm"
													name="passwordConfirm"
													type="password"
													placeholder="Confirm your password"
													required
												/>
												{#if form?.errors?.passwordConfirm}
													<p class="text-sm text-destructive">{form.errors.passwordConfirm}</p>
												{/if}
											</div>


											{#if form?.error}
												<div class="rounded-md bg-destructive/10 border border-destructive/30 p-3">
													<p class="text-sm text-destructive">{form.error}</p>
												</div>
											{/if}

											<Button type="submit" class="w-full text-base font-semibold" disabled={loading}>
												{loading ? 'Registering...' : 'Register for Draft'}
											</Button>
										</div>
									</form>
								{/if}
							{:else}
								<!-- Login Form -->
								<form method="POST" action="?/login" use:enhance={() => {
									loading = true;
									return async ({ update }) => {
										loading = false;
										await update();
									};
								}}>
									<div class="space-y-4">
										<div class="space-y-2">
											<Label for="login-email">Email</Label>
											<Input
												id="login-email"
												name="email"
												type="email"
												placeholder="john@example.com"
												required
												value={form?.loginData?.email ?? ''}
											/>
											{#if form?.loginErrors?.email}
												<p class="text-sm text-destructive">{form.loginErrors.email}</p>
											{/if}
										</div>

										<div class="space-y-2">
											<Label for="login-password">Password</Label>
											<Input
												id="login-password"
												name="password"
												type="password"
												placeholder="Your password"
												required
											/>
											{#if form?.loginErrors?.password}
												<p class="text-sm text-destructive">{form.loginErrors.password}</p>
											{/if}
										</div>

										{#if form?.loginError}
											<div class="rounded-md bg-destructive/10 border border-destructive/30 p-3">
												<p class="text-sm text-destructive">{form.loginError}</p>
											</div>
										{/if}

										<Button type="submit" class="w-full text-base font-semibold" disabled={loading}>
											{loading ? 'Signing in...' : 'Sign In'}
										</Button>
									</div>
								</form>
							{/if}
						</Card.CardContent>
						<Card.CardFooter class="justify-center text-xs text-muted-foreground">
							Draft — Monday, March 16 · 5:30 PM · Crust
						</Card.CardFooter>
					</Card.Card>
				</div>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t bg-muted/50 py-6 text-center text-sm text-muted-foreground">
		<p>&copy; 2026 NCAA Basketball Pool — Power Player's Pool. All rights reserved.</p>
	</footer>
</div>
