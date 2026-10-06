<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>{page.status} — Divest Contract Watch</title>
</svelte:head>

<div class="wrap">
	<p class="eyebrow">Error {page.status}</p>
	<h1>{page.status === 404 ? 'Nothing here' : 'Something went wrong'}</h1>
	<p>{page.error?.message ?? 'Unknown error.'}</p>
	<p class="links">
		<a href={resolve('/')}>Back to the dashboard</a>
		<a href={resolve('/companies')}>Browse companies</a>
		<a href={resolve('/method')}>How this is built</a>
	</p>
</div>

<style>
	.wrap {
		max-width: 620px;
		margin: 0 auto;
		padding: 80px clamp(16px, 3vw, 32px);
		display: grid;
		gap: 12px;
	}

	p {
		color: var(--muted);
	}

	.links {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		margin-top: 12px;
		font-size: 0.9rem;
	}
</style>
