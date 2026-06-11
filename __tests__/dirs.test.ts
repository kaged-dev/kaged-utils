import { describe, expect, test } from "bun:test";
import * as os from "node:os";
import * as path from "node:path";
import {
	getCacheDir,
	getConfigDir,
	getDataDir,
	getDbDir,
	getLogsDir,
	getProjectConfigDir,
	getRuntimeDir,
	getSessionsDir,
	getStateDir,
	hashPath,
	normalizePathForComparison,
	pathIsWithin,
	resolveEquivalentPath,
	shortenHome,
} from "../src/dirs.ts";

const home = os.homedir();

describe("XDG / platform dirs", () => {
	test("getDataDir returns a path containing kaged", () => {
		expect(getDataDir()).toContain("kaged");
	});

	test("getStateDir returns a path containing kaged", () => {
		expect(getStateDir()).toContain("kaged");
	});

	test("getCacheDir returns a path containing kaged", () => {
		expect(getCacheDir()).toContain("kaged");
	});

	test("getConfigDir returns a path containing kaged", () => {
		expect(getConfigDir()).toContain("kaged");
	});

	test("getLogsDir is under state dir", () => {
		expect(getLogsDir()).toBe(path.join(getStateDir(), "logs"));
	});

	test("getDbDir is under data dir", () => {
		expect(getDbDir()).toBe(path.join(getDataDir(), "db"));
	});

	test("getSessionsDir is under data dir", () => {
		expect(getSessionsDir()).toBe(path.join(getDataDir(), "sessions"));
	});

	test("getRuntimeDir returns a path containing kaged", () => {
		expect(getRuntimeDir()).toContain("kaged");
	});
});

describe("getProjectConfigDir", () => {
	test("defaults to cwd/.kaged", () => {
		expect(getProjectConfigDir()).toBe(path.join(process.cwd(), ".kaged"));
	});

	test("uses provided root", () => {
		expect(getProjectConfigDir("/tmp/myproject")).toBe("/tmp/myproject/.kaged");
	});
});

describe("resolveEquivalentPath", () => {
	test("resolves relative paths", () => {
		const result = resolveEquivalentPath(".");
		expect(path.isAbsolute(result)).toBe(true);
	});

	test("resolves symlinks when possible", () => {
		const result = resolveEquivalentPath("/tmp");
		expect(path.isAbsolute(result)).toBe(true);
	});

	test("returns resolved path for nonexistent paths", () => {
		const result = resolveEquivalentPath("/nonexistent/path/foo");
		expect(result).toBe("/nonexistent/path/foo");
	});
});

describe("normalizePathForComparison", () => {
	test("normalizes to absolute path", () => {
		const result = normalizePathForComparison(".");
		expect(path.isAbsolute(result)).toBe(true);
	});
});

describe("pathIsWithin", () => {
	test("child is within root", () => {
		expect(pathIsWithin("/home/user", "/home/user/project")).toBe(true);
	});

	test("same path is within", () => {
		expect(pathIsWithin("/home/user", "/home/user")).toBe(true);
	});

	test("parent is not within child", () => {
		expect(pathIsWithin("/home/user/project", "/home/user")).toBe(false);
	});

	test("sibling is not within", () => {
		expect(pathIsWithin("/home/user/a", "/home/user/b")).toBe(false);
	});

	test("rejects path traversal", () => {
		expect(pathIsWithin("/home/user", "/home/user/../other")).toBe(false);
	});
});

describe("shortenHome", () => {
	test("replaces home prefix with ~", () => {
		const p = path.join(home, "projects", "kaged");
		expect(shortenHome(p)).toBe("~/projects/kaged");
	});

	test("leaves non-home paths unchanged", () => {
		expect(shortenHome("/tmp/foo")).toBe("/tmp/foo");
	});

	test("does not shorten home dir itself without trailing slash", () => {
		expect(shortenHome(home)).toBe(home);
	});
});

describe("hashPath", () => {
	test("returns 7-char hex string", () => {
		const result = hashPath("/tmp/test");
		expect(result).toHaveLength(7);
		expect(/^[0-9a-f]{7}$/.test(result)).toBe(true);
	});

	test("same path produces same hash", () => {
		expect(hashPath("/tmp/test")).toBe(hashPath("/tmp/test"));
	});

	test("different paths produce different hashes", () => {
		expect(hashPath("/tmp/a")).not.toBe(hashPath("/tmp/b"));
	});
});
