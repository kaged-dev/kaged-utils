import { describe, expect, test } from "bun:test";
import {
	envFlag,
	envPosInt,
	filterProcessEnv,
	isBunTestRuntime,
	isSafeEnvName,
	isSafeEnvValue,
	isValidEnvName,
	parseEnvFile,
	pickEnv,
} from "../src/env.ts";

describe("isValidEnvName", () => {
	test("valid names", () => {
		expect(isValidEnvName("HOME")).toBe(true);
		expect(isValidEnvName("_FOO")).toBe(true);
		expect(isValidEnvName("MY_VAR_2")).toBe(true);
		expect(isValidEnvName("a")).toBe(true);
	});

	test("invalid names", () => {
		expect(isValidEnvName("")).toBe(false);
		expect(isValidEnvName("1FOO")).toBe(false);
		expect(isValidEnvName("MY-VAR")).toBe(false);
		expect(isValidEnvName("MY VAR")).toBe(false);
		expect(isValidEnvName("foo=bar")).toBe(false);
	});
});

describe("isSafeEnvName", () => {
	test("safe names", () => {
		expect(isSafeEnvName("HOME")).toBe(true);
		expect(isSafeEnvName("something-weird")).toBe(true);
	});

	test("unsafe names", () => {
		expect(isSafeEnvName("")).toBe(false);
		expect(isSafeEnvName("FOO=BAR")).toBe(false);
		expect(isSafeEnvName("FOO\0BAR")).toBe(false);
	});
});

describe("isSafeEnvValue", () => {
	test("safe values", () => {
		expect(isSafeEnvValue("hello")).toBe(true);
		expect(isSafeEnvValue("")).toBe(true);
		expect(isSafeEnvValue("foo=bar")).toBe(true);
	});

	test("null byte is unsafe", () => {
		expect(isSafeEnvValue("hello\0world")).toBe(false);
	});
});

describe("filterProcessEnv", () => {
	test("filters out unsafe keys and undefined values", () => {
		const env = {
			GOOD: "value",
			"": "empty key",
			"BAD=KEY": "has equals",
			UNDEF: undefined,
			ALSO_GOOD: "ok",
		};
		const result = filterProcessEnv(env);
		expect(result).toEqual({ GOOD: "value", ALSO_GOOD: "ok" });
	});

	test("filters out values with null bytes", () => {
		const env = { KEY: "val\0ue" };
		const result = filterProcessEnv(env);
		expect(result).toEqual({});
	});
});

describe("parseEnvFile", () => {
	test("parses simple key=value", () => {
		expect(parseEnvFile("FOO=bar\nBAZ=qux")).toEqual({
			FOO: "bar",
			BAZ: "qux",
		});
	});

	test("strips quotes", () => {
		expect(parseEnvFile("FOO=\"bar\"\nBAZ='qux'")).toEqual({
			FOO: "bar",
			BAZ: "qux",
		});
	});

	test("skips comments and blank lines", () => {
		const input = `
# comment
FOO=bar

# another comment
BAZ=qux
`;
		expect(parseEnvFile(input)).toEqual({ FOO: "bar", BAZ: "qux" });
	});

	test("skips lines without =", () => {
		expect(parseEnvFile("NOEQ")).toEqual({});
	});

	test("skips invalid env names", () => {
		expect(parseEnvFile("1BAD=val")).toEqual({});
	});

	test("handles values with equals signs", () => {
		expect(parseEnvFile("KEY=val=ue")).toEqual({ KEY: "val=ue" });
	});

	test("trims whitespace around key and value", () => {
		expect(parseEnvFile("  FOO  =  bar  ")).toEqual({ FOO: "bar" });
	});
});

describe("pickEnv", () => {
	const _origEnv = process.env;

	test("returns first found non-empty value", () => {
		process.env.__TEST_PICK_A = "";
		process.env.__TEST_PICK_B = "found";
		expect(pickEnv("__TEST_PICK_A", "__TEST_PICK_B")).toBe("found");
		delete process.env.__TEST_PICK_A;
		delete process.env.__TEST_PICK_B;
	});

	test("returns undefined when none found", () => {
		expect(pickEnv("__NONEXISTENT_KEY_1", "__NONEXISTENT_KEY_2")).toBeUndefined();
	});
});

describe("envPosInt", () => {
	test("returns parsed value when valid positive integer", () => {
		process.env.__TEST_INT = "42";
		expect(envPosInt("__TEST_INT", 10)).toBe(42);
		delete process.env.__TEST_INT;
	});

	test("returns default for missing var", () => {
		expect(envPosInt("__NONEXISTENT_INT", 10)).toBe(10);
	});

	test("returns default for non-numeric", () => {
		process.env.__TEST_INT_BAD = "abc";
		expect(envPosInt("__TEST_INT_BAD", 10)).toBe(10);
		delete process.env.__TEST_INT_BAD;
	});

	test("returns default for zero or negative", () => {
		process.env.__TEST_INT_ZERO = "0";
		expect(envPosInt("__TEST_INT_ZERO", 10)).toBe(10);
		process.env.__TEST_INT_ZERO = "-5";
		expect(envPosInt("__TEST_INT_ZERO", 10)).toBe(10);
		delete process.env.__TEST_INT_ZERO;
	});
});

describe("envFlag", () => {
	test("truthy values", () => {
		for (const v of ["1", "Y", "TRUE", "YES", "ON", "true", "yes", "on", "y"]) {
			process.env.__TEST_FLAG = v;
			expect(envFlag("__TEST_FLAG")).toBe(true);
		}
		delete process.env.__TEST_FLAG;
	});

	test("falsy values", () => {
		process.env.__TEST_FLAG = "0";
		expect(envFlag("__TEST_FLAG")).toBe(false);
		process.env.__TEST_FLAG = "false";
		expect(envFlag("__TEST_FLAG")).toBe(false);
		process.env.__TEST_FLAG = "no";
		expect(envFlag("__TEST_FLAG")).toBe(false);
		delete process.env.__TEST_FLAG;
	});

	test("missing returns default", () => {
		expect(envFlag("__NONEXISTENT_FLAG")).toBe(false);
		expect(envFlag("__NONEXISTENT_FLAG", true)).toBe(true);
	});
});

describe("isBunTestRuntime", () => {
	test("detects test runtime", () => {
		expect(isBunTestRuntime()).toBe(true);
	});
});
