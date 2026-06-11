import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { TempDir } from "../src/temp.ts";

describe("TempDir", () => {
	test("createSync creates a directory", () => {
		const tmp = TempDir.createSync();
		expect(fs.existsSync(tmp.path())).toBe(true);
		expect(fs.statSync(tmp.path()).isDirectory()).toBe(true);
		tmp.removeSync();
	});

	test("create creates a directory", async () => {
		const tmp = await TempDir.create();
		expect(fs.existsSync(tmp.path())).toBe(true);
		await tmp.remove();
	});

	test("path returns the directory path", () => {
		const tmp = TempDir.createSync();
		expect(tmp.path()).toBeTruthy();
		expect(typeof tmp.path()).toBe("string");
		tmp.removeSync();
	});

	test("absolute returns an absolute path", () => {
		const tmp = TempDir.createSync();
		expect(path.isAbsolute(tmp.absolute())).toBe(true);
		tmp.removeSync();
	});

	test("join appends to the temp path", () => {
		const tmp = TempDir.createSync();
		const joined = tmp.join("sub", "file.txt");
		expect(joined).toBe(path.join(tmp.path(), "sub", "file.txt"));
		tmp.removeSync();
	});

	test("toString returns the path", () => {
		const tmp = TempDir.createSync();
		expect(String(tmp)).toBe(tmp.path());
		tmp.removeSync();
	});

	test("removeSync removes the directory", () => {
		const tmp = TempDir.createSync();
		const p = tmp.path();
		fs.writeFileSync(path.join(p, "test.txt"), "data");
		tmp.removeSync();
		expect(fs.existsSync(p)).toBe(false);
	});

	test("remove removes the directory", async () => {
		const tmp = await TempDir.create();
		const p = tmp.path();
		fs.writeFileSync(path.join(p, "test.txt"), "data");
		await tmp.remove();
		expect(fs.existsSync(p)).toBe(false);
	});

	test("remove is idempotent", async () => {
		const tmp = await TempDir.create();
		await tmp.remove();
		await tmp.remove();
	});

	test("custom prefix with @", () => {
		const tmp = TempDir.createSync("@kaged-test-");
		expect(tmp.path()).toContain("kaged-test-");
		tmp.removeSync();
	});

	test("default prefix uses kaged-temp-", () => {
		const tmp = TempDir.createSync();
		expect(tmp.path()).toContain("kaged-temp-");
		tmp.removeSync();
	});

	test("Symbol.dispose cleans up", () => {
		let p: string;
		{
			const tmp = TempDir.createSync();
			p = tmp.path();
			expect(fs.existsSync(p)).toBe(true);
			tmp[Symbol.dispose]();
		}
		expect(fs.existsSync(p)).toBe(false);
	});

	test("Symbol.asyncDispose cleans up", async () => {
		const tmp = await TempDir.create();
		const p = tmp.path();
		expect(fs.existsSync(p)).toBe(true);
		await tmp[Symbol.asyncDispose]();
		expect(fs.existsSync(p)).toBe(false);
	});
});
