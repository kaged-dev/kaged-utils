const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidEnvName(name: string): boolean {
	return ENV_NAME_RE.test(name);
}

export function isSafeEnvName(name: string): boolean {
	return name.length > 0 && !name.includes("=") && !name.includes("\0");
}

export function isSafeEnvValue(value: string): boolean {
	return !value.includes("\0");
}

export function filterProcessEnv(env: Record<string, string | undefined>): Record<string, string> {
	const result: Record<string, string> = {};
	for (const key in env) {
		const value = env[key];
		if (!isSafeEnvName(key) || value === undefined || !isSafeEnvValue(value)) continue;
		result[key] = value;
	}
	return result;
}

export function parseEnvFile(content: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const eqIndex = trimmed.indexOf("=");
		if (eqIndex === -1) continue;

		const key = trimmed.slice(0, eqIndex).trim();
		if (!isValidEnvName(key)) continue;

		let value = trimmed.slice(eqIndex + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (!isSafeEnvValue(value)) continue;

		result[key] = value;
	}
	return result;
}

export function pickEnv(...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = process.env[key]?.trim();
		if (value) return value;
	}
	return undefined;
}

export function envPosInt(name: string, defaultValue: number): number {
	const raw = process.env[name];
	if (!raw) return defaultValue;
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed) || parsed <= 0) return defaultValue;
	return parsed;
}

const TRUTHY: Record<string, boolean> = { "1": true, Y: true, TRUE: true, YES: true, ON: true };

export function envFlag(name: string, def: boolean = false): boolean {
	const value = process.env[name];
	if (!value) return def;
	return TRUTHY[value.toUpperCase()] === true;
}

export function isBunTestRuntime(): boolean {
	return process.env.BUN_ENV === "test" || process.env.NODE_ENV === "test";
}
