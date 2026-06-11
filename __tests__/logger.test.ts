import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { configure, debug, error, getLogDir, getLogPath, info, warn } from "../src/logger.ts";

const TEST_LOG_DIR = path.join(os.tmpdir(), `kaged-logger-test-${Date.now()}`);

function cleanup() {
	try {
		fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
	} catch {}
}

beforeEach(() => {
	cleanup();
	configure({ dir: TEST_LOG_DIR, level: "debug", console: false, maxFiles: 3 });
});

afterEach(() => {
	cleanup();
});

function readLogLines(): Record<string, unknown>[] {
	const today = new Date().toISOString().slice(0, 10);
	const logFile = path.join(TEST_LOG_DIR, `kaged.${today}.log`);
	if (!fs.existsSync(logFile)) return [];
	const content = fs.readFileSync(logFile, "utf-8").trim();
	if (!content) return [];
	return content.split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("logger", () => {
	test("writes JSON log entries", () => {
		info("test message");
		const lines = readLogLines();
		expect(lines).toHaveLength(1);
		expect(lines[0]?.level).toBe("info");
		expect(lines[0]?.message).toBe("test message");
		expect(lines[0]?.timestamp).toBeDefined();
		expect(lines[0]?.pid).toBe(process.pid);
	});

	test("writes all levels", () => {
		debug("d");
		info("i");
		warn("w");
		error("e");
		const lines = readLogLines();
		expect(lines).toHaveLength(4);
		expect(lines.map((l) => l.level)).toEqual(["debug", "info", "warn", "error"]);
	});

	test("respects minimum level", () => {
		configure({ dir: TEST_LOG_DIR, level: "warn" });
		debug("should skip");
		info("should skip");
		warn("should appear");
		error("should appear");
		const lines = readLogLines();
		expect(lines).toHaveLength(2);
		expect(lines[0]?.level).toBe("warn");
		expect(lines[1]?.level).toBe("error");
	});

	test("includes context fields", () => {
		info("with context", { requestId: "abc", duration: 42 });
		const lines = readLogLines();
		expect(lines[0]?.requestId).toBe("abc");
		expect(lines[0]?.duration).toBe(42);
	});

	test("context does not override reserved fields", () => {
		info("reserved", { level: "overridden", timestamp: "overridden", message: "overridden" });
		const lines = readLogLines();
		expect(lines[0]?.level).toBe("info");
		expect(lines[0]?.message).toBe("reserved");
	});

	test("creates log directory if it does not exist", () => {
		const nested = path.join(TEST_LOG_DIR, "nested", "deep");
		configure({ dir: nested });
		info("nested dir");
		expect(fs.existsSync(nested)).toBe(true);
	});
});

describe("getLogPath", () => {
	test("returns path for today", () => {
		const p = getLogPath();
		expect(p).toContain(TEST_LOG_DIR);
		expect(p).toContain(new Date().toISOString().slice(0, 10));
		expect(p).toEndWith(".log");
	});

	test("returns path for specific date", () => {
		const d = new Date("2025-01-15T00:00:00Z");
		const p = getLogPath(d);
		expect(p).toContain("2025-01-15");
	});
});

describe("getLogDir", () => {
	test("returns configured directory", () => {
		expect(getLogDir()).toBe(TEST_LOG_DIR);
	});
});

describe("log rotation", () => {
	test("prunes old log files beyond maxFiles", () => {
		configure({ dir: TEST_LOG_DIR, maxFiles: 2 });
		fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
		fs.writeFileSync(path.join(TEST_LOG_DIR, "kaged.2025-01-01.log"), "old1\n");
		fs.writeFileSync(path.join(TEST_LOG_DIR, "kaged.2025-01-02.log"), "old2\n");
		fs.writeFileSync(path.join(TEST_LOG_DIR, "kaged.2025-01-03.log"), "old3\n");

		info("trigger rotation");

		const remaining = fs
			.readdirSync(TEST_LOG_DIR)
			.filter((f) => f.startsWith("kaged.") && f.endsWith(".log"));
		expect(remaining.length).toBeLessThanOrEqual(3);
	});
});
