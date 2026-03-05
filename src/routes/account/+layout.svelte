<script lang="ts">
	import '../../app.css';
	import fordLogo from '$lib/assets/ford_logo.png';
	import { page } from '$app/stores';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import ClipboardList from '@lucide/svelte/icons/clipboard';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Newspaper from '@lucide/svelte/icons/newspaper';
	import UserCog from '@lucide/svelte/icons/user-cog';
	import LogOut from '@lucide/svelte/icons/log-out';

	let { data, children } = $props();

	const navLinks = [
		{ href: '/dashboard', label: 'Pool', icon: LayoutDashboard, exact: true },
		{ href: '/dashboard/draft', label: 'Draft', icon: ClipboardList },
		{ href: '/leaderboard', label: 'Standings', icon: Trophy },
		{ href: '/dashboard/blog', label: 'Blog', icon: Newspaper }
	];
</script>

<div class="min-h-screen bg-background">
	<nav class="border-b bg-card px-4 py-3">
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<div class="flex items-center gap-3">
				<img src={fordLogo} alt="Logo" class="h-8 w-8 rounded-full bg-white object-contain p-0.5" />
				<span class="text-lg font-bold text-primary">NCAA Pool 2026</span>
			</div>
			<div class="flex items-center gap-1">
				{#each navLinks as link}
					{@const active = link.exact
						? $page.url.pathname === link.href
						: $page.url.pathname.startsWith(link.href)}
					<a
						href={link.href}
						class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors
							{active
								? 'bg-primary/10 text-primary'
								: 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
					>
						<link.icon class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">{link.label}</span>
					</a>
				{/each}

				<div class="mx-1 h-5 w-px bg-border"></div>

				<a
					href="/account/settings"
					class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors bg-primary/10 text-primary"
					title="Account settings"
				>
					<UserCog class="h-3.5 w-3.5" />
					<span class="hidden sm:inline">{data.user.name}</span>
				</a>

				<form method="POST" action="/logout">
					<button
						type="submit"
						class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
						title="Logout"
					>
						<LogOut class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">Logout</span>
					</button>
				</form>
			</div>
		</div>
	</nav>
	<main class="mx-auto max-w-6xl px-4 py-8">
		{@render children()}
	</main>
</div>
