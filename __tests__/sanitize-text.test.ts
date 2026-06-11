import { describe, expect, test } from "bun:test";
import { sanitizeText } from "../src/sanitize-text.ts";

describe("sanitizeText", () => {
	test("passes through clean text unchanged", () => {
		const input = "Hello, world!";
		expect(sanitizeText(input)).toBe(input);
	});

	test("preserves tabs and newlines", () => {
		expect(sanitizeText("line1\nline2")).toBe("line1\nline2");
		expect(sanitizeText("col1\tcol2")).toBe("col1\tcol2");
	});

	test("strips ANSI escape sequences", () => {
		expect(sanitizeText("\x1b[31mred text\x1b[0m")).toBe("red text");
		expect(sanitizeText("\x1b[1;32mbold green\x1b[0m")).toBe("bold green");
	});

	test("removes C0 control characters (except tab and newline)", () => {
		expect(sanitizeText("hello\x00world")).toBe("helloworld");
		expect(sanitizeText("hello\x07world")).toBe("helloworld");
		expect(sanitizeText("hello\x08world")).toBe("helloworld");
	});

	test("removes DEL character", () => {
		expect(sanitizeText("hello\x7fworld")).toBe("helloworld");
	});

	test("removes C1 control characters", () => {
		expect(sanitizeText("hello\x80world")).toBe("helloworld");
		expect(sanitizeText("hello\x9fworld")).toBe("helloworld");
	});

	test("handles mixed ANSI and control characters", () => {
		expect(sanitizeText("\x1b[31m\x00red\x07\x1b[0m")).toBe("red");
	});

	test("handles empty string", () => {
		expect(sanitizeText("")).toBe("");
	});

	test("preserves U+FFFD in already well-formed strings", () => {
		// U+FFFD is only stripped when toWellFormed() detects lone surrogates
		// and inserts replacement chars itself. Pre-existing U+FFFD is preserved.
		const input = "hello\ufffdworld";
		expect(sanitizeText(input)).toBe(input);
	});
});
