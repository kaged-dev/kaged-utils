import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const kTempDir = os.tmpdir();

function normalizePrefix(prefix?: string): string {
	if (!prefix) return `${kTempDir}${path.sep}kaged-temp-`;
	if (prefix.startsWith("@")) return path.join(kTempDir, prefix.slice(1));
	return prefix;
}

export class TempDir {
	#path: string;
	#removePromise: Promise<void> | null = null;

	private constructor(dirPath: string) {
		this.#path = dirPath;
	}

	static createSync(prefix?: string): TempDir {
		return new TempDir(fs.mkdtempSync(normalizePrefix(prefix)));
	}

	static async create(prefix?: string): Promise<TempDir> {
		return new TempDir(await fs.promises.mkdtemp(normalizePrefix(prefix)));
	}

	path(): string {
		return this.#path;
	}

	absolute(): string {
		return path.resolve(this.#path);
	}

	join(...paths: string[]): string {
		return path.join(this.#path, ...paths);
	}

	remove(): Promise<void> {
		if (this.#removePromise) return this.#removePromise;
		const removePromise = fs.promises.rm(this.#path, { recursive: true, force: true });
		this.#removePromise = removePromise;
		return removePromise;
	}

	removeSync(): void {
		fs.rmSync(this.#path, { recursive: true, force: true });
		this.#removePromise = Promise.resolve();
	}

	toString(): string {
		return this.#path;
	}

	async [Symbol.asyncDispose](): Promise<void> {
		try {
			await this.remove();
		} catch {}
	}

	[Symbol.dispose](): void {
		try {
			this.removeSync();
		} catch {}
	}
}
