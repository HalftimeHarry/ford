<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';

	let { form } = $props();

	let loading = $state(false);
	let previewUrl = $state<string | null>(null);

	function handleImageChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		previewUrl = file ? URL.createObjectURL(file) : null;
	}
</script>

<svelte:head>
	<title>New Post — Pool Blog</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-extrabold text-primary">New Post</h1>
			<p class="text-sm text-muted-foreground mt-0.5">Share something with the pool.</p>
		</div>
		<a href="/dashboard/blog" class="text-sm text-muted-foreground hover:text-foreground">← Back to Blog</a>
	</div>

	<Card.Card class="max-w-2xl">
		<Card.CardContent class="pt-6">
			<form
				method="POST"
				enctype="multipart/form-data"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
				class="space-y-5"
			>
				<div class="space-y-2">
					<Label for="title">Title</Label>
					<Input
						id="title"
						name="title"
						type="text"
						placeholder="Post title"
						required
						value={form?.data?.title ?? ''}
					/>
					{#if form?.errors?.title}
						<p class="text-sm text-destructive">{form.errors.title}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="body">Body</Label>
					<textarea
						id="body"
						name="body"
						rows={8}
						placeholder="Write your post..."
						required
						class="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
					>{form?.data?.body ?? ''}</textarea>
					{#if form?.errors?.body}
						<p class="text-sm text-destructive">{form.errors.body}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="image">
						Image <span class="text-muted-foreground font-normal">(optional)</span>
					</Label>
					<input
						id="image"
						name="image"
						type="file"
						accept="image/*"
						onchange={handleImageChange}
						class="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs file:border-0 file:bg-transparent file:text-sm file:font-medium cursor-pointer"
					/>
					{#if previewUrl}
						<img src={previewUrl} alt="Preview" class="mt-2 max-h-48 rounded-md object-cover w-full" />
					{/if}
				</div>

				{#if form?.error}
					<div class="rounded-md bg-destructive/10 border border-destructive/30 p-3">
						<p class="text-sm text-destructive">{form.error}</p>
					</div>
				{/if}

				<div class="flex gap-3">
					<Button type="submit" class="font-semibold" disabled={loading}>
						{loading ? 'Publishing...' : 'Publish Post'}
					</Button>
					<Button href="/dashboard/blog" variant="outline">Cancel</Button>
				</div>
			</form>
		</Card.CardContent>
	</Card.Card>
</div>
