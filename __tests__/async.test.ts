import { describe, expect, test } from "bun:test";
import { withTimeout } from "../src/async.ts";

describe("withTimeout", () => {
	test("resolves when promise completes before timeout", async () => {
		const result = await withTimeout(Promise.resolve(42), 1000, "timed out");
		expect(result).toBe(42);
	});

	test("rejects when timeout fires first", async () => {
		const never = new Promise<number>(() => {});
		await expect(withTimeout(never, 10, "operation timed out")).rejects.toThrow(
			"operation timed out",
		);
	});

	test("propagates promise rejection", async () => {
		const failing = Promise.reject(new Error("boom"));
		await expect(withTimeout(failing, 1000, "timed out")).rejects.toThrow("boom");
	});

	test("rejects immediately if signal already aborted", async () => {
		const ac = new AbortController();
		ac.abort(new Error("pre-aborted"));
		await expect(withTimeout(Promise.resolve(1), 1000, "timed out", ac.signal)).rejects.toThrow(
			"pre-aborted",
		);
	});

	test("rejects when signal aborts during wait", async () => {
		const ac = new AbortController();
		const never = new Promise<number>(() => {});
		const p = withTimeout(never, 5000, "timed out", ac.signal);
		setTimeout(() => ac.abort(new Error("cancelled")), 10);
		await expect(p).rejects.toThrow("cancelled");
	});

	test("cleans up timeout on early resolution", async () => {
		const result = await withTimeout(
			new Promise<string>((resolve) => setTimeout(() => resolve("fast"), 5)),
			1000,
			"timed out",
		);
		expect(result).toBe("fast");
	});
});
