import * as path from "node:path";
import { Glob } from "bun";

export interface GlobPathsOptions {
	cwd: string;
	exclude?: string[];
	signal?: AbortSignal;
	timeoutMs?: number;
	dot?: boolean;
	onlyFiles?: boolean;
	gitignore?: boolean;
}

const ALWAYS_IGNORED = ["**/.git", "**/.git/**"];
const NODE_MODULES_IGNORED = ["**/node_modules", "**/node_modules/**"];

function parseGitignorePatterns(content: string, gitignoreDir: string, baseDir: string): string[] {
	const patterns: string[] = [];

	for (const rawLine of content.split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#") || line.startsWith("!")) continue;

		let pattern = line;
		const isDir = pattern.endsWith("/");
		if (isDir) pattern = pattern.slice(0, -1);

		if (pattern.startsWith("/")) {
			const abs = path.join(gitignoreDir, pattern.slice(1));
			const rel = path.relative(baseDir, abs);
			if (rel.startsWith("..")) continue;
			const normalized = rel.replace(/\\/g, "/");
			patterns.push(normalized);
			if (isDir) patterns.push(`${normalized}/**`);
		} else {
			patterns.push(`**/${pattern}`);
			if (isDir) patterns.push(`**/${pattern}/**`);
		}
	}

	return patterns;
}

export async function loadGitignorePatterns(baseDir: string): Promise<string[]> {
	const patterns: string[] = [];
	const absBase = path.resolve(baseDir);
	let current = absBase;

	for (let i = 0; i < 50; i++) {
		const gitignorePath = path.join(current, ".gitignore");
		try {
			const content = await Bun.file(gitignorePath).text();
			patterns.push(...parseGitignorePatterns(content, current, absBase));
		} catch {}

		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}

	return patterns;
}

export async function globPaths(
	patterns: string | string[],
	options: GlobPathsOptions,
): Promise<string[]> {
	const { cwd, exclude, signal, timeoutMs, dot, onlyFiles = true, gitignore } = options;

	const patternArray = Array.isArray(patterns) ? patterns : [patterns];
	const mentionsNodeModules = patternArray.some((p) => p.includes("node_modules"));

	const baseExclude = mentionsNodeModules
		? [...ALWAYS_IGNORED]
		: [...ALWAYS_IGNORED, ...NODE_MODULES_IGNORED];
	let effectiveExclude = exclude ? [...baseExclude, ...exclude] : baseExclude;

	if (gitignore) {
		const gitPatterns = await loadGitignorePatterns(cwd);
		effectiveExclude = [...effectiveExclude, ...gitPatterns];
	}

	const timeoutSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
	const combinedSignal =
		signal && timeoutSignal ? AbortSignal.any([signal, timeoutSignal]) : (signal ?? timeoutSignal);

	const results: string[] = [];

	for (const pattern of patternArray) {
		const glob = new Glob(pattern);
		for await (const entry of glob.scan({
			cwd,
			dot,
			onlyFiles,
			throwErrorOnBrokenSymlink: false,
		})) {
			if (combinedSignal?.aborted) {
				const reason = combinedSignal.reason;
				if (reason instanceof Error) throw reason;
				throw new DOMException("Aborted", "AbortError");
			}

			const normalized = entry.replace(/\\/g, "/");
			let excluded = false;
			for (const ep of effectiveExclude) {
				if (new Glob(ep).match(normalized)) {
					excluded = true;
					break;
				}
			}
			if (!excluded) results.push(normalized);
		}
	}

	return results;
}
