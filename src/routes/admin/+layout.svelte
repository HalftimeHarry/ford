<script lang="ts">
	import '../../app.css';
	import fordLogo from '$lib/assets/ford_logo.png';
	import { Button } from '$lib/components/ui/button';

	let { data, children } = $props();
</script>

<div class="min-h-screen bg-background">
	<nav class="border-b bg-card px-4 py-3">
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<div class="flex items-center gap-3">
				<img src={fordLogo} alt="Logo" class="h-8 w-8 rounded-full bg-white object-contain p-0.5" />
				<span class="text-lg font-bold text-primary">Admin Panel</span>
			</div>
			<div class="flex items-center gap-4">
				<a href="/admin" class="text-sm font-medium text-muted-foreground hover:text-foreground">Draft</a>
				<a href="/admin/scores" class="text-sm font-medium text-muted-foreground hover:text-foreground">Scores</a>
				<span class="text-sm text-muted-foreground">{data.user.name}</span>
				<form method="POST" action="/logout">
					<Button variant="outline" size="sm" type="submit">Logout</Button>
				</form>
			</div>
		</div>
	</nav>
	<main class="mx-auto max-w-6xl px-4 py-8">
		{@render children()}
	</main>
</div>
