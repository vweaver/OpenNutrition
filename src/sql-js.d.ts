declare module 'sql.js' {
	// Minimal types — the library ships its own, but some imports aren't
	// picked up reliably by svelte-check.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export type Database = any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export type SqlJsStatic = any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export default function initSqlJs(opts?: unknown): Promise<any>;
}
