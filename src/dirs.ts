import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const APP_NAME = "kaged";
const CONFIG_DIR_NAME = `.${APP_NAME}`;

type XdgCategory = "data" | "state" | "cache" | "config";

const XDG_ENV: Record<XdgCategory, string> = {
	data: "XDG_DATA_HOME",
	state: "XDG_STATE_HOME",
	cache: "XDG_CACHE_HOME",
	config: "XDG_CONFIG_HOME",
};

const XDG_DEFAULTS: Record<XdgCategory, string> = {
	data: ".local/share",
	state: ".local/state",
	cache: ".cache",
	config: ".config",
};

function xdgDir(category: XdgCategory): string {
	const env = process.env[XDG_ENV[category]];
	if (env) return path.join(env, APP_NAME);
	return path.join(os.homedir(), XDG_DEFAULTS[category], APP_NAME);
}

function darwinDir(category: XdgCategory): string {
	const home = os.homedir();
	switch (category) {
		case "data":
			return path.join(home, "Library", "Application Support", APP_NAME);
		case "state":
			return path.join(home, "Library", "Application Support", APP_NAME);
		case "cache":
			return path.join(home, "Library", "Caches", APP_NAME);
		case "config":
			return path.join(home, "Library", "Application Support", APP_NAME);
	}
}

function resolveDir(category: XdgCategory): string {
	if (process.platform === "darwin") return darwinDir(category);
	return xdgDir(category);
}

export function getDataDir(): string {
	return resolveDir("data");
}

export function getStateDir(): string {
	return resolveDir("state");
}

export function getCacheDir(): string {
	return resolveDir("cache");
}

export function getConfigDir(): string {
	return resolveDir("config");
}

export function getLogsDir(): string {
	return path.join(getStateDir(), "logs");
}

export function getDbDir(): string {
	return path.join(getDataDir(), "db");
}

export function getSessionsDir(): string {
	return path.join(getDataDir(), "sessions");
}

export function getRuntimeDir(): string {
	const xdg = process.env.XDG_RUNTIME_DIR;
	if (xdg) return path.join(xdg, APP_NAME);
	return path.join(getStateDir(), "run");
}

export function getProjectConfigDir(projectRoot: string = process.cwd()): string {
	return path.join(projectRoot, CONFIG_DIR_NAME);
}

export function resolveEquivalentPath(inputPath: string): string {
	const resolvedPath = path.resolve(inputPath);
	try {
		return fs.realpathSync(resolvedPath);
	} catch {
		return resolvedPath;
	}
}

export function normalizePathForComparison(inputPath: string): string {
	const resolvedPath = resolveEquivalentPath(inputPath);
	return process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
}

export function pathIsWithin(root: string, candidate: string): boolean {
	const normalizedRoot = normalizePathForComparison(root);
	const normalizedCandidate = normalizePathForComparison(candidate);
	const relative = path.relative(normalizedRoot, normalizedCandidate);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function shortenHome(p: string): string {
	const home = os.homedir();
	if (p.startsWith(`${home}/`)) return `~/${p.slice(home.length + 1)}`;
	return p;
}

/**
 * Stable 7-character hex digest of an absolute path.
 * Non-cryptographic — for naming dirs on a single machine.
 */
export function hashPath(absPath: string): string {
	return Bun.hash(path.resolve(absPath)).toString(16).padStart(16, "0").slice(-7);
}
