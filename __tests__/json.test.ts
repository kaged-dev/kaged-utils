import { describe, expect, test } from "bun:test";
import { tryParseJson } from "../src/json.ts";

describe("tryParseJson", () => {
	test("parses valid JSON object", () => {
		expect(tryParseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
	});

	test("parses valid JSON array", () => {
		expect(tryParseJson<number[]>("[1,2,3]")).toEqual([1, 2, 3]);
	});

	test("parses valid JSON primitives", () => {
		expect(tryParseJson<number>("42")).toBe(42);
		expect(tryParseJson<string>('"hello"')).toBe("hello");
		expect(tryParseJson<boolean>("true")).toBe(true);
		expect(tryParseJson("null")).toBeNull();
	});

	test("returns null on invalid JSON", () => {
		expect(tryParseJson("{bad}")).toBeNull();
		expect(tryParseJson("")).toBeNull();
		expect(tryParseJson("undefined")).toBeNull();
		expect(tryParseJson("{trailing,}")).toBeNull();
	});

	test("preserves generic type parameter", () => {
		const result = tryParseJson<{ name: string }>('{"name":"kaged"}');
		expect(result?.name).toBe("kaged");
	});
});
