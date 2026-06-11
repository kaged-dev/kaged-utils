import { YAML } from "bun";

function stripHtmlComments(content: string): string {
	return content.replace(/<!--[\s\S]*?-->/g, "");
}

function kebabToCamel(key: string): string {
	if (!key.includes("-")) return key;
	return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function normalizeKeys<T>(obj: T): T {
	if (obj === null || typeof obj !== "object") return obj;
	if (Array.isArray(obj)) {
		let changed = false;
		const out: unknown[] = new Array(obj.length);
		for (let i = 0; i < obj.length; i++) {
			const v = obj[i];
			const nv = normalizeKeys(v);
			out[i] = nv;
			if (nv !== v) changed = true;
		}
		return (changed ? (out as unknown) : obj) as T;
	}
	let changed = false;
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
		const nk = key.includes("-") ? kebabToCamel(key) : key;
		const nv = normalizeKeys(value);
		result[nk] = nv;
		if (nk !== key || nv !== value) changed = true;
	}
	return (changed ? result : obj) as T;
}

export class FrontmatterError extends Error {
	constructor(
		error: Error,
		readonly source?: unknown,
	) {
		super(`Failed to parse YAML frontmatter (${source}): ${error.message}`, { cause: error });
		this.name = "FrontmatterError";
	}
}

export interface FrontmatterOptions {
	source?: unknown;
	fallback?: Record<string, unknown>;
	normalize?: boolean;
	level?: "off" | "warn" | "fatal";
}

export interface FrontmatterResult {
	frontmatter: Record<string, unknown>;
	body: string;
}

export function parseFrontmatter(content: string, options?: FrontmatterOptions): FrontmatterResult {
	const { source, fallback, normalize = true, level = "warn" } = options ?? {};
	const frontmatter: Record<string, unknown> = { ...fallback };

	const normalized = normalize ? stripHtmlComments(content.replace(/\r\n?/g, "\n")) : content;
	if (!normalized.startsWith("---")) {
		return { frontmatter, body: normalized };
	}

	const endIndex = normalized.indexOf("\n---", 3);
	if (endIndex === -1) {
		return { frontmatter, body: normalized };
	}

	const metadata = normalized.slice(4, endIndex);
	const body = normalized.slice(endIndex + 4).trim();

	try {
		const loaded = YAML.parse(metadata.replaceAll("\t", "  ")) as Record<string, unknown> | null;
		return { frontmatter: normalizeKeys({ ...frontmatter, ...loaded }), body };
	} catch (error) {
		const err = new FrontmatterError(
			error instanceof Error ? error : new Error(`YAML: ${error}`),
			source ?? content.slice(0, 64),
		);
		if (level === "fatal") throw err;

		for (const line of metadata.split("\n")) {
			const match = line.match(/^([\w-]+):\s*(.*)$/);
			const [, key, value] = match ?? [];
			if (key) {
				frontmatter[key] = value?.trim();
			}
		}

		return { frontmatter: normalizeKeys(frontmatter) as Record<string, unknown>, body };
	}
}
