<script lang="ts">
	import type { Status } from '#lib/types';

	let { status, title }: { status: Status; title?: string } = $props();

	// Palette classes are keyed off the first word: "Extension window" -> s-Extension.
	let cls = $derived('s-' + status.split(' ')[0]);
	let pulses = $derived(status === 'Active' || status === 'Extension window');
</script>

<span class="pill {cls}" {title}>
	{#if pulses}<span class="dot"></span>{/if}{status}
</span>
