<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();
</script>

<svelte:head>
	<title>Blog — NCAA Pool 2026</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-extrabold text-primary">Pool Blog</h1>
			<p class="text-sm text-muted-foreground mt-0.5">
				Share updates, trash talk, and tournament takes with the pool.
			</p>
		</div>
		<Button href="/dashboard/blog/new">New Post</Button>
	</div>

	{#if data.posts.length === 0}
		<div class="rounded-lg border border-dashed p-12 text-center">
			<p class="text-muted-foreground">No posts yet.</p>
			<Button href="/dashboard/blog/new" variant="outline" class="mt-4">Write the first one</Button>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.posts as post}
				<a href="/dashboard/blog/{post.id}" class="block group">
					<Card.Card class="overflow-hidden transition-shadow group-hover:shadow-md">
						<div class="flex gap-0 {post.imageUrl ? 'sm:flex-row' : ''}">
							{#if post.imageUrl}
								<img
									src={post.imageUrl}
									alt={post.title}
									class="h-40 w-full object-cover sm:h-auto sm:w-48 shrink-0"
								/>
							{/if}
							<div class="flex-1 min-w-0">
								<Card.CardHeader class="pb-2">
									<Card.CardTitle class="text-lg group-hover:text-primary transition-colors leading-snug">
										{post.title}
									</Card.CardTitle>
									<p class="text-xs text-muted-foreground">
										{post.expand?.author?.name ?? 'Unknown'} ·
										{new Date(post.created).toLocaleDateString('en-US', {
											month: 'short', day: 'numeric', year: 'numeric'
										})}
									</p>
								</Card.CardHeader>
								<Card.CardContent class="pt-0">
									<p class="line-clamp-2 text-sm text-foreground/75">{post.body}</p>
								</Card.CardContent>
							</div>
						</div>
					</Card.Card>
				</a>
			{/each}
		</div>
	{/if}
</div>
