import { describe, expect, test } from "bun:test";
import { cleanup, registerCleanup } from "../src/postmortem.ts";

describe("registerCleanup", () => {
	test("returns a cancel function", () => {
		const cancel = registerCleanup("test", () => {});
		expect(typeof cancel).toBe("function");
		cancel();
	});
});

describe("cleanup", () => {
	test("returns a promise", async () => {
		const result = cleanup();
		expect(result).toBeInstanceOf(Promise);
		await result;
	});
});
