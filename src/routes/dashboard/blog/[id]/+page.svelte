<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();

	import { page } from '$app/stores';
	const user = $derived($page.data.user);
	const canDelete = $derived(
		user != null && (user.id === data.post.author || user.role === 'admin')
	);
</script>

<svelte:head>
	<title>{data.post.title} — Pool Blog</title>
</svelte:head>

<div class="space-y-6 max-w-3xl">
	<div class="flex items-center justify-between">
		<a href="/dashboard/blog" class="text-sm text-muted-foreground hover:text-foreground">← Blog</a>
		{#if canDelete}
			<form method="POST" action="?/delete" use:enhance>
				<Button variant="destructive" size="sm" type="submit">Delete Post</Button>
			</form>
		{/if}
	</div>

	<article>
		{#if data.post.imageUrl}
			<img
				src={data.post.imageUrl}
				alt={data.post.title}
				class="mb-8 w-full rounded-xl object-cover max-h-80"
			/>
		{/if}

		<h1 class="text-3xl font-extrabold text-primary mb-2">{data.post.title}</h1>
		<p class="text-sm text-muted-foreground mb-8">
			{data.post.expand?.author?.name ?? 'Unknown'} ·
			{new Date(data.post.created).toLocaleDateString('en-US', {
				month: 'long', day: 'numeric', year: 'numeric'
			})}
		</p>

		<div class="text-foreground/90 whitespace-pre-wrap leading-relaxed text-sm">
			{data.post.body}
		</div>
	</article>
</div>
