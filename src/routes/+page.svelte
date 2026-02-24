<script lang="ts">
	import { enhance } from '$app/forms';
	import fordLogo from '$lib/assets/ford_logo.png';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';

	let { form } = $props();

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
				DRAFT — SATURDAY, MARCH 15, 2026
			</p>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-12">
		<div class="grid gap-10 lg:grid-cols-5">
			<!-- Content Section -->
			<div class="lg:col-span-3 space-y-8">
				<!-- Pool Options -->
				<Card.Card>
					<Card.CardHeader>
						<Card.CardTitle class="text-2xl font-bold text-primary">Entry Options</Card.CardTitle>
					</Card.CardHeader>
					<Card.CardContent>
						<div class="grid gap-6 sm:grid-cols-2">
							<div class="rounded-lg border-2 border-primary/20 bg-primary/5 p-5 text-center">
								<p class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pool #1</p>
								<p class="mt-2 text-3xl font-extrabold text-primary">$600</p>
								<p class="text-sm text-muted-foreground">per team + $50 entry fee</p>
								<Separator class="my-3" />
								<p class="text-sm font-medium">Pays 1st, 2nd &amp; 3rd Place</p>
								<p class="mt-1 font-bold text-accent">$3,800 / $1,600 / $600</p>
							</div>
							<div class="rounded-lg border-2 border-accent/30 bg-accent/5 p-5 text-center">
								<p class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pool #2</p>
								<p class="mt-2 text-3xl font-extrabold text-accent">$1,200</p>
								<p class="text-sm text-muted-foreground">per team + $50 entry fee</p>
								<Separator class="my-3" />
								<p class="text-sm font-medium">Pays 1st, 2nd &amp; 3rd Place</p>
								<p class="mt-1 font-bold text-primary">$7,500 / $3,000 / $1,500</p>
							</div>
						</div>
					</Card.CardContent>
				</Card.Card>

				<!-- How It Works -->
				<Card.Card>
					<Card.CardHeader>
						<Card.CardTitle class="text-2xl font-bold text-primary">How It Works</Card.CardTitle>
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
						<div class="rounded-md bg-muted p-4">
							<p class="font-semibold text-foreground mb-2">Draft Rounds</p>
							<ul class="list-disc list-inside space-y-1 text-sm">
								<li><strong>Rounds 1–2:</strong> Draw order, then reverse for round 2 (pick 10 also gets 11, pick 1 waits until 20th).</li>
								<li><strong>Rounds 3–4:</strong> New draw, then reverse again.</li>
								<li><strong>Rounds 5–6:</strong> New draw, then reverse again.</li>
							</ul>
							<p class="mt-2 text-sm text-muted-foreground">60 NCAA teams selected total — and we're done.</p>
						</div>
					</Card.CardContent>
				</Card.Card>

				<!-- Scoring -->
				<Card.Card>
					<Card.CardHeader>
						<Card.CardTitle class="text-2xl font-bold text-primary">Scoring</Card.CardTitle>
					</Card.CardHeader>
					<Card.CardContent>
						<div class="overflow-hidden rounded-lg border">
							<table class="w-full text-sm">
								<thead>
									<tr class="bg-primary text-primary-foreground">
										<th class="px-4 py-2.5 text-left font-semibold">Round</th>
										<th class="px-4 py-2.5 text-left font-semibold">Points</th>
									</tr>
								</thead>
								<tbody>
									<tr class="border-b bg-card">
										<td class="px-4 py-2.5">1st Round</td>
										<td class="px-4 py-2.5 font-medium">1.5 &times; seed number (1–16)</td>
									</tr>
									<tr class="border-b bg-muted/50">
										<td class="px-4 py-2.5">2nd Round</td>
										<td class="px-4 py-2.5 font-medium">2.5 &times; seed number (1–16)</td>
									</tr>
									<tr class="border-b bg-card">
										<td class="px-4 py-2.5">3rd Round</td>
										<td class="px-4 py-2.5 font-medium">3.5 &times; seed number (1–16)</td>
									</tr>
									<tr class="border-b bg-muted/50">
										<td class="px-4 py-2.5">4th Round</td>
										<td class="px-4 py-2.5 font-medium">4.5 &times; seed number (1–16)</td>
									</tr>
									<tr class="border-b bg-card">
										<td class="px-4 py-2.5">Semi-Final Winners</td>
										<td class="px-4 py-2.5 font-bold text-accent">25 points</td>
									</tr>
									<tr class="bg-primary/10">
										<td class="px-4 py-2.5 font-semibold">Final Winner</td>
										<td class="px-4 py-2.5 font-extrabold text-primary">50 points</td>
									</tr>
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

											<div class="space-y-2">
												<Label for="pool">Pool Selection</Label>
												<select
													id="pool"
													name="pool"
													class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
													required
												>
													<option value="">Select a pool...</option>
													<option value="pool1">Pool #1 — $600 + $50</option>
													<option value="pool2">Pool #2 — $1,200 + $50</option>
												</select>
												{#if form?.errors?.pool}
													<p class="text-sm text-destructive">{form.errors.pool}</p>
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
							Draft starts 15 min after Pool #1 draw
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
