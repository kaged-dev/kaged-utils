import { describe, expect, test } from "bun:test";
import {
	hasFsCode,
	isEacces,
	isEexist,
	isEisdir,
	isEnoent,
	isEnotdir,
	isEnotempty,
	isFsError,
} from "../src/fs-error.ts";

function makeFsError(code: string, message = "fs error"): Error & { code: string } {
	const err = new Error(message) as Error & { code: string };
	err.code = code;
	return err;
}

describe("isFsError", () => {
	test("returns true for Error with string code", () => {
		expect(isFsError(makeFsError("ENOENT"))).toBe(true);
	});

	test("returns false for plain Error", () => {
		expect(isFsError(new Error("nope"))).toBe(false);
	});

	test("returns false for non-Error objects", () => {
		expect(isFsError({ code: "ENOENT" })).toBe(false);
		expect(isFsError(null)).toBe(false);
		expect(isFsError(undefined)).toBe(false);
		expect(isFsError("ENOENT")).toBe(false);
		expect(isFsError(42)).toBe(false);
	});

	test("returns false when code is not a string", () => {
		const err = new Error("bad") as Error & { code: number };
		err.code = 42;
		expect(isFsError(err)).toBe(false);
	});
});

describe("isEnoent", () => {
	test("matches ENOENT", () => {
		expect(isEnoent(makeFsError("ENOENT"))).toBe(true);
	});

	test("rejects other codes", () => {
		expect(isEnoent(makeFsError("EACCES"))).toBe(false);
	});

	test("rejects non-errors", () => {
		expect(isEnoent(null)).toBe(false);
	});
});

describe("isEacces", () => {
	test("matches EACCES", () => {
		expect(isEacces(makeFsError("EACCES"))).toBe(true);
	});

	test("rejects other codes", () => {
		expect(isEacces(makeFsError("ENOENT"))).toBe(false);
	});
});

describe("isEisdir", () => {
	test("matches EISDIR", () => {
		expect(isEisdir(makeFsError("EISDIR"))).toBe(true);
	});

	test("rejects other codes", () => {
		expect(isEisdir(makeFsError("ENOENT"))).toBe(false);
	});
});

describe("isEnotdir", () => {
	test("matches ENOTDIR", () => {
		expect(isEnotdir(makeFsError("ENOTDIR"))).toBe(true);
	});

	test("rejects other codes", () => {
		expect(isEnotdir(makeFsError("EISDIR"))).toBe(false);
	});
});

describe("isEexist", () => {
	test("matches EEXIST", () => {
		expect(isEexist(makeFsError("EEXIST"))).toBe(true);
	});

	test("rejects other codes", () => {
		expect(isEexist(makeFsError("ENOENT"))).toBe(false);
	});
});

describe("isEnotempty", () => {
	test("matches ENOTEMPTY", () => {
		expect(isEnotempty(makeFsError("ENOTEMPTY"))).toBe(true);
	});

	test("rejects other codes", () => {
		expect(isEnotempty(makeFsError("EEXIST"))).toBe(false);
	});
});

describe("hasFsCode", () => {
	test("matches arbitrary code", () => {
		expect(hasFsCode(makeFsError("EPERM"), "EPERM")).toBe(true);
	});

	test("rejects mismatched code", () => {
		expect(hasFsCode(makeFsError("EPERM"), "ENOENT")).toBe(false);
	});

	test("rejects non-errors", () => {
		expect(hasFsCode("not an error", "EPERM")).toBe(false);
	});
});

describe("real fs error", () => {
	test("identifies a real ENOENT from fs", async () => {
		try {
			await Bun.file("/tmp/__nonexistent_kaged_test_path__").text();
			throw new Error("should have thrown");
		} catch (err) {
			expect(isEnoent(err)).toBe(true);
			if (isFsError(err)) {
				expect(err.code).toBe("ENOENT");
			}
		}
	});
});
