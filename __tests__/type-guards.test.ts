import { describe, expect, test } from "bun:test";
import { asRecord, isRecord, structuredCloneJSON, toError } from "../src/type-guards.ts";

describe("isRecord", () => {
	test("returns true for plain objects", () => {
		expect(isRecord({})).toBe(true);
		expect(isRecord({ a: 1 })).toBe(true);
	});

	test("returns true for Object.create(null)", () => {
		expect(isRecord(Object.create(null))).toBe(true);
	});

	test("returns false for arrays", () => {
		expect(isRecord([])).toBe(false);
		expect(isRecord([1, 2, 3])).toBe(false);
	});

	test("returns false for null and undefined", () => {
		expect(isRecord(null)).toBe(false);
		expect(isRecord(undefined)).toBe(false);
	});

	test("returns false for primitives", () => {
		expect(isRecord("string")).toBe(false);
		expect(isRecord(42)).toBe(false);
		expect(isRecord(true)).toBe(false);
	});

	test("returns true for class instances", () => {
		expect(isRecord(new Error("hi"))).toBe(true);
		expect(isRecord(new Map())).toBe(true);
	});
});

describe("asRecord", () => {
	test("returns the value for records", () => {
		const obj = { a: 1 };
		expect(asRecord(obj)).toBe(obj);
	});

	test("returns null for non-records", () => {
		expect(asRecord(null)).toBe(null);
		expect(asRecord(42)).toBe(null);
		expect(asRecord("hi")).toBe(null);
		expect(asRecord([])).toBe(null);
	});
});

describe("toError", () => {
	test("returns Error instances as-is", () => {
		const err = new Error("test");
		expect(toError(err)).toBe(err);
	});

	test("wraps strings in Error", () => {
		const result = toError("bad");
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("bad");
	});

	test("wraps numbers in Error", () => {
		const result = toError(42);
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("42");
	});

	test("wraps null in Error", () => {
		const result = toError(null);
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("null");
	});

	test("wraps undefined in Error", () => {
		const result = toError(undefined);
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("undefined");
	});

	test("preserves Error subclasses", () => {
		const err = new TypeError("type issue");
		expect(toError(err)).toBe(err);
		expect(toError(err)).toBeInstanceOf(TypeError);
	});
});

describe("structuredCloneJSON", () => {
	test("clones plain objects", () => {
		const obj = { a: 1, b: { c: 2 } };
		const cloned = structuredCloneJSON(obj);
		expect(cloned).toEqual(obj);
		expect(cloned).not.toBe(obj);
		expect(cloned.b).not.toBe(obj.b);
	});

	test("clones arrays", () => {
		const arr = [1, 2, { x: 3 }];
		const cloned = structuredCloneJSON(arr);
		expect(cloned).toEqual(arr);
		expect(cloned).not.toBe(arr);
	});

	test("returns primitives as-is", () => {
		expect(structuredCloneJSON(42)).toBe(42);
		expect(structuredCloneJSON("hello")).toBe("hello");
		expect(structuredCloneJSON(true)).toBe(true);
		expect(structuredCloneJSON(null)).toBe(null);
	});

	test("handles objects that structuredClone rejects", () => {
		const obj = { a: 1, b: () => 42 };
		const cloned = structuredCloneJSON(obj);
		expect(cloned.a).toBe(1);
		expect(cloned.b).toBeUndefined();
	});
});
