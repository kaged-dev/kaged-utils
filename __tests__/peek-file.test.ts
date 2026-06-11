import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { peekFile, peekFileSync } from "../src/peek-file.ts";

function makeTempFile(content: Uint8Array): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kaged-peek-"));
	const filePath = path.join(dir, "test.bin");
	fs.writeFileSync(filePath, content);
	return filePath;
}

describe("peekFileSync", () => {
	test("reads first N bytes of a file", () => {
		const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xaa, 0xbb]);
		const filePath = makeTempFile(data);
		const result = peekFileSync(filePath, 4, (h) => Array.from(h));
		expect(result).toEqual([0x89, 0x50, 0x4e, 0x47]);
		fs.rmSync(path.dirname(filePath), { recursive: true });
	});

	test("reads fewer bytes if file is shorter than maxBytes", () => {
		const data = new Uint8Array([1, 2, 3]);
		const filePath = makeTempFile(data);
		const result = peekFileSync(filePath, 100, (h) => h.length);
		expect(result).toBe(3);
		fs.rmSync(path.dirname(filePath), { recursive: true });
	});

	test("returns op(empty) when maxBytes is 0", () => {
		const filePath = makeTempFile(new Uint8Array([1, 2]));
		const result = peekFileSync(filePath, 0, (h) => h.length);
		expect(result).toBe(0);
		fs.rmSync(path.dirname(filePath), { recursive: true });
	});

	test("passes header to op and returns its result", () => {
		const data = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
		const filePath = makeTempFile(data);
		const isJpeg = peekFileSync(
			filePath,
			3,
			(h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
		);
		expect(isJpeg).toBe(true);
		fs.rmSync(path.dirname(filePath), { recursive: true });
	});
});

describe("peekFile", () => {
	test("reads first N bytes of a file (async)", async () => {
		const data = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
		const filePath = makeTempFile(data);
		const result = await peekFile(filePath, 6, (h) => Array.from(h));
		expect(result).toEqual([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
		fs.rmSync(path.dirname(filePath), { recursive: true });
	});

	test("reads fewer bytes if file is shorter", async () => {
		const data = new Uint8Array([10, 20]);
		const filePath = makeTempFile(data);
		const result = await peekFile(filePath, 1024, (h) => h.length);
		expect(result).toBe(2);
		fs.rmSync(path.dirname(filePath), { recursive: true });
	});

	test("returns op(empty) when maxBytes is 0", async () => {
		const filePath = makeTempFile(new Uint8Array([1]));
		const result = await peekFile(filePath, 0, (h) => h.length);
		expect(result).toBe(0);
		fs.rmSync(path.dirname(filePath), { recursive: true });
	});
});
