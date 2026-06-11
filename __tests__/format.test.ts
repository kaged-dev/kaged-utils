import { describe, expect, test } from "bun:test";
import {
	formatAge,
	formatBytes,
	formatCount,
	formatDuration,
	formatNumber,
	formatPercent,
	pluralize,
	truncate,
} from "../src/format.ts";

describe("formatDuration", () => {
	test("milliseconds", () => {
		expect(formatDuration(0)).toBe("0ms");
		expect(formatDuration(1)).toBe("1ms");
		expect(formatDuration(999)).toBe("999ms");
	});

	test("seconds", () => {
		expect(formatDuration(1_000)).toBe("1.0s");
		expect(formatDuration(1_500)).toBe("1.5s");
		expect(formatDuration(59_999)).toBe("60.0s");
	});

	test("minutes", () => {
		expect(formatDuration(60_000)).toBe("1m");
		expect(formatDuration(90_000)).toBe("1m30s");
		expect(formatDuration(120_000)).toBe("2m");
	});

	test("hours", () => {
		expect(formatDuration(3_600_000)).toBe("1h");
		expect(formatDuration(5_400_000)).toBe("1h30m");
	});

	test("days", () => {
		expect(formatDuration(86_400_000)).toBe("1d");
		expect(formatDuration(90_000_000)).toBe("1d1h");
		expect(formatDuration(172_800_000)).toBe("2d");
	});
});

describe("formatNumber", () => {
	test("small numbers unchanged", () => {
		expect(formatNumber(0)).toBe("0");
		expect(formatNumber(999)).toBe("999");
	});

	test("thousands", () => {
		expect(formatNumber(1_000)).toBe("1K");
		expect(formatNumber(1_500)).toBe("1.5K");
		expect(formatNumber(9_999)).toBe("10K");
		expect(formatNumber(25_000)).toBe("25K");
	});

	test("millions", () => {
		expect(formatNumber(1_000_000)).toBe("1M");
		expect(formatNumber(1_500_000)).toBe("1.5M");
		expect(formatNumber(25_000_000)).toBe("25M");
	});

	test("billions", () => {
		expect(formatNumber(1_000_000_000)).toBe("1B");
		expect(formatNumber(1_500_000_000)).toBe("1.5B");
		expect(formatNumber(25_000_000_000)).toBe("25B");
	});
});

describe("formatBytes", () => {
	test("bytes", () => {
		expect(formatBytes(0)).toBe("0B");
		expect(formatBytes(512)).toBe("512B");
		expect(formatBytes(1023)).toBe("1023B");
	});

	test("kilobytes", () => {
		expect(formatBytes(1024)).toBe("1.0KB");
		expect(formatBytes(1536)).toBe("1.5KB");
	});

	test("megabytes", () => {
		expect(formatBytes(1024 * 1024)).toBe("1.0MB");
		expect(formatBytes(2.3 * 1024 * 1024)).toBe("2.3MB");
	});

	test("gigabytes", () => {
		expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0GB");
		expect(formatBytes(1.2 * 1024 * 1024 * 1024)).toBe("1.2GB");
	});
});

describe("truncate", () => {
	test("short strings unchanged", () => {
		expect(truncate("hello", 10)).toBe("hello");
		expect(truncate("hello", 5)).toBe("hello");
	});

	test("long strings truncated with ellipsis", () => {
		expect(truncate("hello world", 5)).toBe("hell…");
		expect(truncate("hello world", 8)).toBe("hello w…");
	});

	test("custom ellipsis", () => {
		expect(truncate("hello world", 8, "...")).toBe("hello...");
	});

	test("maxLen smaller than ellipsis", () => {
		expect(truncate("hello", 0)).toBe("…");
	});
});

describe("pluralize", () => {
	test("singular", () => {
		expect(pluralize("file", 1)).toBe("file");
	});

	test("regular plural", () => {
		expect(pluralize("file", 0)).toBe("files");
		expect(pluralize("file", 2)).toBe("files");
	});

	test("sibilant endings (-ch, -sh, -s, -x, -z)", () => {
		expect(pluralize("match", 2)).toBe("matches");
		expect(pluralize("bush", 2)).toBe("bushes");
		expect(pluralize("bus", 2)).toBe("buses");
		expect(pluralize("box", 2)).toBe("boxes");
		expect(pluralize("buzz", 2)).toBe("buzzes");
	});

	test("consonant+y → ies", () => {
		expect(pluralize("entry", 2)).toBe("entries");
		expect(pluralize("dependency", 2)).toBe("dependencies");
	});

	test("vowel+y → ys", () => {
		expect(pluralize("key", 2)).toBe("keys");
		expect(pluralize("day", 2)).toBe("days");
	});
});

describe("formatCount", () => {
	test("singular", () => {
		expect(formatCount("error", 1)).toBe("1 error");
	});

	test("plural", () => {
		expect(formatCount("error", 3)).toBe("3 errors");
	});

	test("zero", () => {
		expect(formatCount("file", 0)).toBe("0 files");
	});

	test("non-finite falls back to 0", () => {
		expect(formatCount("item", NaN)).toBe("0 items");
		expect(formatCount("item", Infinity)).toBe("0 items");
	});
});

describe("formatAge", () => {
	test("null/undefined/0 returns empty", () => {
		expect(formatAge(null)).toBe("");
		expect(formatAge(undefined)).toBe("");
		expect(formatAge(0)).toBe("");
	});

	test("just now", () => {
		expect(formatAge(30)).toBe("just now");
	});

	test("minutes", () => {
		expect(formatAge(120)).toBe("2m ago");
	});

	test("hours", () => {
		expect(formatAge(7200)).toBe("2h ago");
	});

	test("days", () => {
		expect(formatAge(86400 * 3)).toBe("3d ago");
	});

	test("weeks", () => {
		expect(formatAge(86400 * 10)).toBe("1w ago");
	});

	test("months", () => {
		expect(formatAge(86400 * 45)).toBe("1mo ago");
	});
});

describe("formatPercent", () => {
	test("formats ratio as percentage", () => {
		expect(formatPercent(0)).toBe("0.0%");
		expect(formatPercent(0.5)).toBe("50.0%");
		expect(formatPercent(1)).toBe("100.0%");
		expect(formatPercent(0.123)).toBe("12.3%");
	});
});
