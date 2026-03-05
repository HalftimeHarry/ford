<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import UserCog from '@lucide/svelte/icons/user-cog';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import CircleCheck from '@lucide/svelte/icons/circle-check';

	let { data, form } = $props();

	let saving = $state(false);
	let changingPw = $state(false);
</script>

<svelte:head><title>Account Settings</title></svelte:head>

<div class="mx-auto max-w-xl space-y-6 py-8 px-4">
	<h1 class="flex items-center gap-3 text-3xl font-bold text-primary">
		<UserCog class="h-7 w-7" /> Account Settings
	</h1>

	<!-- Profile -->
	<Card.Card>
		<Card.CardHeader>
			<Card.CardTitle class="text-lg font-bold">Profile</Card.CardTitle>
			<p class="text-sm text-muted-foreground">Update your display name and phone number.</p>
		</Card.CardHeader>
		<Card.CardContent>
			<form
				method="POST"
				action="?/updateProfile"
				use:enhance={() => {
					saving = true;
					return async ({ update }) => {
						await update();
						saving = false;
					};
				}}
				class="space-y-4"
			>
				<div class="space-y-1.5">
					<label for="name" class="text-sm font-medium">Name</label>
					<input
						id="name"
						name="name"
						type="text"
						required
						value={form?.name ?? data.user.name}
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					/>
				</div>
				<div class="space-y-1.5">
					<label for="phone" class="text-sm font-medium">Phone</label>
					<input
						id="phone"
						name="phone"
						type="tel"
						value={form?.phone ?? data.user.phone ?? ''}
						placeholder="e.g. 555-867-5309"
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					/>
				</div>
				<div class="space-y-1.5">
					<label class="text-sm font-medium text-muted-foreground">Email</label>
					<p class="text-sm text-muted-foreground">{data.user.email}</p>
				</div>

				{#if form?.error && !form?.pwError}
					<p class="text-sm text-destructive">{form.error}</p>
				{/if}
				{#if form?.success}
					<p class="flex items-center gap-1.5 text-sm text-accent">
						<CircleCheck class="h-4 w-4" /> Profile updated.
					</p>
				{/if}

				<Button type="submit" disabled={saving}>
					{saving ? 'Saving…' : 'Save Changes'}
				</Button>
			</form>
		</Card.CardContent>
	</Card.Card>

	<!-- Change Password -->
	<Card.Card>
		<Card.CardHeader>
			<Card.CardTitle class="flex items-center gap-2 text-lg font-bold">
				<KeyRound class="h-4 w-4" /> Change Password
			</Card.CardTitle>
		</Card.CardHeader>
		<Card.CardContent>
			<form
				method="POST"
				action="?/changePassword"
				use:enhance={() => {
					changingPw = true;
					return async ({ update }) => {
						await update();
						changingPw = false;
					};
				}}
				class="space-y-4"
			>
				<div class="space-y-1.5">
					<label for="oldPassword" class="text-sm font-medium">Current Password</label>
					<input
						id="oldPassword"
						name="oldPassword"
						type="password"
						required
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					/>
				</div>
				<Separator />
				<div class="space-y-1.5">
					<label for="newPassword" class="text-sm font-medium">New Password</label>
					<input
						id="newPassword"
						name="newPassword"
						type="password"
						required
						minlength="8"
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					/>
				</div>
				<div class="space-y-1.5">
					<label for="confirmPassword" class="text-sm font-medium">Confirm New Password</label>
					<input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						required
						minlength="8"
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					/>
				</div>

				{#if form?.pwError}
					<p class="text-sm text-destructive">{form.pwError}</p>
				{/if}
				{#if form?.pwSuccess}
					<p class="flex items-center gap-1.5 text-sm text-accent">
						<CircleCheck class="h-4 w-4" /> Password changed.
					</p>
				{/if}

				<Button type="submit" variant="outline" disabled={changingPw}>
					{changingPw ? 'Updating…' : 'Update Password'}
				</Button>
			</form>
		</Card.CardContent>
	</Card.Card>
</div>
