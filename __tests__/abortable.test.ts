import { describe, expect, test } from "bun:test";
import { AbortError, createAbortableStream, once, untilAborted } from "../src/abortable.ts";

describe("AbortError", () => {
	test("captures signal reason in message", () => {
		const ac = new AbortController();
		ac.abort(new Error("user cancelled"));
		const err = new AbortError(ac.signal);
		expect(err.name).toBe("AbortError");
		expect(err.message).toContain("user cancelled");
		expect(err.cause).toBeInstanceOf(Error);
	});

	test("defaults to Cancelled for non-Error reasons", () => {
		const ac = new AbortController();
		ac.abort("some string");
		const err = new AbortError(ac.signal);
		expect(err.message).toContain("Cancelled");
	});
});

describe("createAbortableStream", () => {
	test("returns stream unchanged when no signal", () => {
		const stream = new ReadableStream();
		expect(createAbortableStream(stream)).toBe(stream);
	});

	test("wraps stream in a transform with signal", () => {
		const ac = new AbortController();
		const stream = new ReadableStream<string>();
		const abortable = createAbortableStream(stream, ac.signal);
		expect(abortable).not.toBe(stream);
	});
});

describe("untilAborted", () => {
	test("resolves normally without signal", async () => {
		const result = await untilAborted(null, Promise.resolve(42));
		expect(result).toBe(42);
	});

	test("resolves normally with non-aborted signal", async () => {
		const ac = new AbortController();
		const result = await untilAborted(ac.signal, Promise.resolve(42));
		expect(result).toBe(42);
	});

	test("rejects immediately if signal already aborted", async () => {
		const ac = new AbortController();
		ac.abort(new Error("pre-aborted"));
		await expect(untilAborted(ac.signal, Promise.resolve(42))).rejects.toThrow("Aborted");
	});

	test("rejects when signal fires during execution", async () => {
		const ac = new AbortController();
		const slow = new Promise<number>((resolve) => setTimeout(() => resolve(42), 5000));
		const p = untilAborted(ac.signal, slow);
		setTimeout(() => ac.abort(new Error("cancelled")), 10);
		await expect(p).rejects.toThrow("Aborted");
	});

	test("accepts a function returning a promise", async () => {
		const result = await untilAborted(null, () => Promise.resolve("from fn"));
		expect(result).toBe("from fn");
	});

	test("calls function lazily", async () => {
		let called = false;
		const ac = new AbortController();
		ac.abort(new Error("pre-aborted"));
		try {
			await untilAborted(ac.signal, () => {
				called = true;
				return Promise.resolve(42);
			});
		} catch {}
		expect(called).toBe(false);
	});
});

describe("once", () => {
	test("calls function only once", () => {
		let calls = 0;
		const fn = once(() => ++calls);
		expect(fn()).toBe(1);
		expect(fn()).toBe(1);
		expect(fn()).toBe(1);
		expect(calls).toBe(1);
	});

	test("caches undefined return value", () => {
		let calls = 0;
		const fn = once(() => {
			calls++;
			return undefined;
		});
		expect(fn()).toBeUndefined();
		expect(fn()).toBeUndefined();
		expect(calls).toBe(1);
	});
});
