import { browser } from '$app/env';

export type Theme = 'system' | 'light' | 'dark';

const KEY = 'dcw-theme';
const ORDER: Theme[] = ['system', 'light', 'dark'];

const read = (): Theme => {
	if (!browser) return 'system';
	try {
		const saved = localStorage.getItem(KEY);
		return saved === 'light' || saved === 'dark' ? saved : 'system';
	} catch {
		return 'system';
	}
};

let current = $state<Theme>(read());

function apply(theme: Theme) {
	if (!browser) return;
	const root = document.documentElement;
	if (theme === 'system') root.removeAttribute('data-theme');
	else root.setAttribute('data-theme', theme);
	try {
		if (theme === 'system') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, theme);
	} catch {
		// private browsing — the attribute still applies for this page view
	}
}

export const theme = {
	get value() {
		return current;
	},
	set(next: Theme) {
		current = next;
		apply(next);
	},
	/** Cycle system → light → dark → system. */
	cycle() {
		this.set(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
	}
};

export const THEME_LABELS: Record<Theme, string> = {
	system: 'Match system theme',
	light: 'Light theme',
	dark: 'Dark theme'
};

export const THEME_ICONS: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' };
