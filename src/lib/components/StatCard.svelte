<script lang="ts">
	let { figure, label, note }: { figure: string | number; label: string; note?: string } = $props();
</script>

<div class="stat">
	<b>{figure}</b>
	<span>{label}</span>
	{#if note}<small>{note}</small>{/if}
</div>

<style>
	.stat {
		padding: 14px 16px 16px 0;
		display: grid;
		gap: 4px;
		align-content: start;
		min-width: 0;
	}

	b {
		font: 700 clamp(1.4rem, 2.8vw, 1.9rem) / 1.1 var(--f-display);
		font-variant-numeric: tabular-nums;
	}

	span {
		color: var(--muted);
		font-size: 0.84rem;
	}

	small {
		color: var(--muted);
		font-size: 0.76rem;
		font-family: var(--f-mono);
	}
</style>
