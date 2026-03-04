<script lang="ts">
	import '../../app.css';
	import fordLogo from '$lib/assets/ford_logo.png';
	import { Button } from '$lib/components/ui/button';
	import { Menu, X } from 'lucide-svelte';
	import { page } from '$app/stores';

	let { data, children } = $props();

	let mobileMenuOpen = $state(false);

	const navLinks = [
		{ href: '/admin', label: 'Draft' },
		{ href: '/admin/scores', label: 'Scores' },
		{ href: '/dashboard/blog', label: 'Blog' },
		{ href: '/admin/pool', label: 'Pool Admin' },
		{ href: '/leaderboard', label: 'Standings' }
	];
</script>

<div class="min-h-screen bg-background">
	<nav class="border-b bg-card px-4 py-3">
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<div class="flex items-center gap-3">
				<img src={fordLogo} alt="Logo" class="h-8 w-8 rounded-full bg-white object-contain p-0.5" />
				<span class="text-lg font-bold text-primary">Admin Panel</span>
			</div>

			<!-- Desktop nav -->
			<div class="hidden sm:flex items-center gap-4">
				{#each navLinks as link}
					{@const active = $page.url.pathname === link.href}
					<a
						href={link.href}
						class="text-sm font-medium transition-colors
							{active
								? 'text-primary'
								: 'text-muted-foreground hover:text-foreground'}"
					>
						{link.label}
					</a>
				{/each}
				<span class="text-sm text-muted-foreground">{data.user.name}</span>
				<form method="POST" action="/logout">
					<Button variant="outline" size="sm" type="submit">Logout</Button>
				</form>
			</div>

			<!-- Mobile menu button -->
			<button
				class="sm:hidden p-2 rounded-md hover:bg-muted"
				onclick={() => mobileMenuOpen = !mobileMenuOpen}
				aria-label="Toggle menu"
			>
				{#if mobileMenuOpen}
					<X class="h-5 w-5" />
				{:else}
					<Menu class="h-5 w-5" />
				{/if}
			</button>
		</div>

		<!-- Mobile nav menu -->
		{#if mobileMenuOpen}
			<div class="sm:hidden mt-3 pb-3 border-t pt-3 space-y-2">
				{#each navLinks as link}
					{@const active = $page.url.pathname === link.href}
					<a
						href={link.href}
						class="block px-3 py-2 text-sm font-medium transition-colors rounded-md
							{active
								? 'bg-primary/10 text-primary'
								: 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
						onclick={() => mobileMenuOpen = false}
					>
						{link.label}
					</a>
				{/each}
				<div class="border-t pt-2 mt-2 space-y-2">
					<div class="px-3 py-2 text-sm text-muted-foreground">{data.user.name}</div>
					<form method="POST" action="/logout" class="px-3">
						<Button variant="outline" size="sm" type="submit" class="w-full">Logout</Button>
					</form>
				</div>
			</div>
		{/if}
	</nav>
	<main class="mx-auto max-w-6xl px-4 py-8">
		{@render children()}
	</main>
</div>
