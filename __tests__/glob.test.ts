import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { globPaths, loadGitignorePatterns } from "../src/glob.ts";

function makeTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "kaged-glob-"));
}

function touch(dir: string, ...files: string[]) {
	for (const f of files) {
		const full = path.join(dir, f);
		fs.mkdirSync(path.dirname(full), { recursive: true });
		fs.writeFileSync(full, "");
	}
}

function cleanup(dir: string) {
	fs.rmSync(dir, { recursive: true });
}

describe("globPaths", () => {
	test("matches files by glob pattern", async () => {
		const dir = makeTempDir();
		touch(dir, "a.ts", "b.ts", "c.js");
		const result = await globPaths("*.ts", { cwd: dir });
		expect(result.sort()).toEqual(["a.ts", "b.ts"]);
		cleanup(dir);
	});

	test("supports multiple patterns", async () => {
		const dir = makeTempDir();
		touch(dir, "a.ts", "b.js", "c.css");
		const result = await globPaths(["*.ts", "*.css"], { cwd: dir });
		expect(result.sort()).toEqual(["a.ts", "c.css"]);
		cleanup(dir);
	});

	test("excludes .git by default", async () => {
		const dir = makeTempDir();
		touch(dir, "a.ts", ".git/config");
		const result = await globPaths("**/*", { cwd: dir, dot: true });
		expect(result).not.toContain(".git/config");
		expect(result).toContain("a.ts");
		cleanup(dir);
	});

	test("excludes node_modules by default", async () => {
		const dir = makeTempDir();
		touch(dir, "a.ts", "node_modules/pkg/index.js");
		const result = await globPaths("**/*", { cwd: dir });
		expect(result).not.toContain("node_modules/pkg/index.js");
		cleanup(dir);
	});

	test("includes node_modules when pattern mentions it", async () => {
		const dir = makeTempDir();
		touch(dir, "node_modules/pkg/index.js");
		const result = await globPaths("node_modules/**/*.js", { cwd: dir });
		expect(result).toContain("node_modules/pkg/index.js");
		cleanup(dir);
	});

	test("respects custom exclude patterns", async () => {
		const dir = makeTempDir();
		touch(dir, "src/a.ts", "dist/a.js");
		const result = await globPaths("**/*", { cwd: dir, exclude: ["dist/**"] });
		expect(result).toContain("src/a.ts");
		expect(result).not.toContain("dist/a.js");
		cleanup(dir);
	});

	test("respects dot option", async () => {
		const dir = makeTempDir();
		touch(dir, ".hidden", "visible");
		const withDot = await globPaths("*", { cwd: dir, dot: true });
		const withoutDot = await globPaths("*", { cwd: dir, dot: false });
		expect(withDot).toContain(".hidden");
		expect(withoutDot).not.toContain(".hidden");
		cleanup(dir);
	});

	test("respects abort signal", async () => {
		const dir = makeTempDir();
		touch(dir, "a.ts");
		const controller = new AbortController();
		controller.abort();
		await expect(globPaths("**/*", { cwd: dir, signal: controller.signal })).rejects.toThrow();
		cleanup(dir);
	});

	test("respects timeout", async () => {
		const dir = makeTempDir();
		touch(dir, "a.ts");
		const result = await globPaths("*.ts", { cwd: dir, timeoutMs: 5000 });
		expect(result).toEqual(["a.ts"]);
		cleanup(dir);
	});
});

describe("loadGitignorePatterns", () => {
	test("parses .gitignore patterns", async () => {
		const dir = makeTempDir();
		fs.writeFileSync(path.join(dir, ".gitignore"), "*.log\nbuild/\n");
		const patterns = await loadGitignorePatterns(dir);
		expect(patterns).toContain("**/*.log");
		expect(patterns).toContain("**/build");
		expect(patterns).toContain("**/build/**");
		cleanup(dir);
	});

	test("skips comments and empty lines", async () => {
		const dir = makeTempDir();
		fs.writeFileSync(path.join(dir, ".gitignore"), "# comment\n\n*.tmp\n");
		const patterns = await loadGitignorePatterns(dir);
		expect(patterns).toEqual(["**/*.tmp"]);
		cleanup(dir);
	});

	test("skips negation patterns", async () => {
		const dir = makeTempDir();
		fs.writeFileSync(path.join(dir, ".gitignore"), "*.log\n!important.log\n");
		const patterns = await loadGitignorePatterns(dir);
		expect(patterns).toEqual(["**/*.log"]);
		cleanup(dir);
	});

	test("returns empty array when no .gitignore exists", async () => {
		const dir = makeTempDir();
		const patterns = await loadGitignorePatterns(dir);
		expect(patterns).toEqual([]);
		cleanup(dir);
	});
});
