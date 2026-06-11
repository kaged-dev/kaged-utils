import { describe, expect, test } from "bun:test";
import { $which, WhichCachePolicy } from "../src/which.ts";

describe("$which", () => {
	test("finds common binaries on PATH", () => {
		const sh = $which("sh", { cache: WhichCachePolicy.Bypass });
		expect(sh).toBeString();
		expect(sh?.length).toBeGreaterThan(0);
	});

	test("returns null for nonexistent binary", () => {
		const result = $which("__kaged_nonexistent_binary_abc123__", {
			cache: WhichCachePolicy.Bypass,
		});
		expect(result).toBeNull();
	});

	test("caches results with Cached policy", () => {
		const first = $which("ls", { cache: WhichCachePolicy.Fresh });
		const second = $which("ls", { cache: WhichCachePolicy.Cached });
		expect(second).toBe(first);
	});

	test("bypasses cache with Bypass policy", () => {
		const result = $which("ls", { cache: WhichCachePolicy.Bypass });
		expect(result).toBeString();
	});

	test("respects custom PATH", () => {
		const result = $which("ls", { PATH: "/nonexistent", cache: WhichCachePolicy.Bypass });
		expect(result).toBeNull();
	});

	test("finds bun binary", () => {
		const bun = $which("bun", { cache: WhichCachePolicy.Bypass });
		expect(bun).toBeString();
		expect(bun).toBeDefined();
		expect(bun).toContain("bun");
	});
});
