import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	parseImageMetadata,
	readImageMetadata,
	readImageMetadataSync,
	SUPPORTED_IMAGE_MIME_TYPES,
	SUPPORTED_UPLOAD_MIME_TYPES,
	sniffMimeType,
} from "../src/mime.ts";

function makeTempFile(data: Uint8Array): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kaged-mime-"));
	const filePath = path.join(dir, "test.bin");
	fs.writeFileSync(filePath, data);
	return filePath;
}

function cleanup(filePath: string) {
	fs.rmSync(path.dirname(filePath), { recursive: true });
}

function pngHeader(width: number, height: number, colorType: number): Uint8Array {
	const buf = new Uint8Array(30);
	buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
	const dv = new DataView(buf.buffer);
	dv.setUint32(8, 13);
	buf.set([0x49, 0x48, 0x44, 0x52], 12);
	dv.setUint32(16, width);
	dv.setUint32(20, height);
	buf[24] = 8;
	buf[25] = colorType;
	return buf;
}

function jpegHeader(width: number, height: number): Uint8Array {
	const buf = new Uint8Array(12);
	buf[0] = 0xff;
	buf[1] = 0xd8;
	buf[2] = 0xff;
	buf[3] = 0xc0;
	const dv = new DataView(buf.buffer);
	dv.setUint16(4, 8, false);
	buf[6] = 8;
	dv.setUint16(7, height, false);
	dv.setUint16(9, width, false);
	buf[11] = 3;
	return buf;
}

function gifHeader(width: number, height: number): Uint8Array {
	const buf = new Uint8Array(13);
	buf.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
	const dv = new DataView(buf.buffer);
	dv.setUint16(6, width, true);
	dv.setUint16(8, height, true);
	return buf;
}

describe("SUPPORTED_IMAGE_MIME_TYPES", () => {
	test("contains expected types", () => {
		expect(SUPPORTED_IMAGE_MIME_TYPES.has("image/png")).toBe(true);
		expect(SUPPORTED_IMAGE_MIME_TYPES.has("image/jpeg")).toBe(true);
		expect(SUPPORTED_IMAGE_MIME_TYPES.has("image/gif")).toBe(true);
		expect(SUPPORTED_IMAGE_MIME_TYPES.has("image/webp")).toBe(true);
		expect(SUPPORTED_IMAGE_MIME_TYPES.has("image/svg+xml")).toBe(false);
	});
});

describe("parseImageMetadata", () => {
	test("returns null for unrecognized data", () => {
		expect(parseImageMetadata(new Uint8Array([0, 0, 0, 0]))).toBeNull();
		expect(parseImageMetadata(new Uint8Array(0))).toBeNull();
	});

	test("parses PNG with IHDR (RGBA)", () => {
		const h = pngHeader(320, 240, 6);
		const meta = parseImageMetadata(h);
		expect(meta).toEqual({
			mimeType: "image/png",
			width: 320,
			height: 240,
			channels: 4,
			hasAlpha: true,
		});
	});

	test("parses PNG with IHDR (RGB)", () => {
		const h = pngHeader(100, 50, 2);
		const meta = parseImageMetadata(h);
		expect(meta).toEqual({
			mimeType: "image/png",
			width: 100,
			height: 50,
			channels: 3,
			hasAlpha: false,
		});
	});

	test("parses PNG with IHDR (grayscale)", () => {
		const h = pngHeader(64, 64, 0);
		const meta = parseImageMetadata(h);
		expect(meta).toEqual({
			mimeType: "image/png",
			width: 64,
			height: 64,
			channels: 1,
			hasAlpha: false,
		});
	});

	test("detects PNG magic without IHDR", () => {
		const h = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x00, 0x00, 0x00, 0x00,
		]);
		const meta = parseImageMetadata(h);
		expect(meta?.mimeType).toBe("image/png");
	});

	test("parses JPEG with SOF0", () => {
		const h = jpegHeader(640, 480);
		const meta = parseImageMetadata(h);
		expect(meta).toEqual({
			mimeType: "image/jpeg",
			width: 640,
			height: 480,
			channels: 3,
			hasAlpha: false,
		});
	});

	test("detects JPEG magic even with minimal header", () => {
		const h = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
		const meta = parseImageMetadata(h);
		expect(meta?.mimeType).toBe("image/jpeg");
	});

	test("parses GIF89a header", () => {
		const h = gifHeader(100, 80);
		const meta = parseImageMetadata(h);
		expect(meta).toEqual({ mimeType: "image/gif", width: 100, height: 80, channels: 3 });
	});

	test("parses GIF87a header", () => {
		const h = new Uint8Array(13);
		h.set([0x47, 0x49, 0x46, 0x38, 0x37, 0x61], 0);
		const dv = new DataView(h.buffer);
		dv.setUint16(6, 50, true);
		dv.setUint16(8, 30, true);
		const meta = parseImageMetadata(h);
		expect(meta).toEqual({ mimeType: "image/gif", width: 50, height: 30, channels: 3 });
	});

	test("detects WebP RIFF container", () => {
		const h = new Uint8Array(30);
		h.set([0x52, 0x49, 0x46, 0x46], 0);
		h.set([0x57, 0x45, 0x42, 0x50], 8);
		const meta = parseImageMetadata(h);
		expect(meta?.mimeType).toBe("image/webp");
	});
});

describe("readImageMetadataSync", () => {
	test("reads PNG metadata from file", () => {
		const filePath = makeTempFile(pngHeader(800, 600, 6));
		const meta = readImageMetadataSync(filePath);
		expect(meta).toEqual({
			mimeType: "image/png",
			width: 800,
			height: 600,
			channels: 4,
			hasAlpha: true,
		});
		cleanup(filePath);
	});

	test("returns null for non-image file", () => {
		const filePath = makeTempFile(new Uint8Array([0x7f, 0x45, 0x4c, 0x46]));
		const meta = readImageMetadataSync(filePath);
		expect(meta).toBeNull();
		cleanup(filePath);
	});
});

describe("readImageMetadata", () => {
	test("reads GIF metadata from file (async)", async () => {
		const filePath = makeTempFile(gifHeader(200, 150));
		const meta = await readImageMetadata(filePath);
		expect(meta).toEqual({ mimeType: "image/gif", width: 200, height: 150, channels: 3 });
		cleanup(filePath);
	});
});

// ---------------------------------------------------------------------------
// sniffMimeType — archive / general MIME sniffing (Phase 8)
// ---------------------------------------------------------------------------

describe("sniffMimeType", () => {
	test("detects ZIP by magic bytes", () => {
		const buf = new Uint8Array(32);
		buf.set([0x50, 0x4b, 0x03, 0x04], 0);
		expect(sniffMimeType(buf)).toBe("application/zip");
	});

	test("detects GZIP by magic bytes", () => {
		const buf = new Uint8Array(32);
		buf.set([0x1f, 0x8b], 0);
		expect(sniffMimeType(buf)).toBe("application/gzip");
	});

	test("detects TAR by ustar at offset 257", () => {
		const buf = new Uint8Array(280);
		// "ustar" at offset 257
		buf.set([0x75, 0x73, 0x74, 0x61, 0x72], 257);
		expect(sniffMimeType(buf)).toBe("application/x-tar");
	});

	test("detects PDF by %PDF magic", () => {
		const buf = new Uint8Array(32);
		buf.set([0x25, 0x50, 0x44, 0x46], 0); // %PDF
		expect(sniffMimeType(buf)).toBe("application/pdf");
	});

	test("delegates to image parser for PNG", () => {
		const h = pngHeader(100, 100, 6);
		expect(sniffMimeType(h)).toBe("image/png");
	});

	test("delegates to image parser for JPEG", () => {
		const h = jpegHeader(640, 480);
		expect(sniffMimeType(h)).toBe("image/jpeg");
	});

	test("delegates to image parser for GIF", () => {
		const h = gifHeader(50, 50);
		expect(sniffMimeType(h)).toBe("image/gif");
	});

	test("returns null for unrecognized bytes", () => {
		expect(sniffMimeType(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBeNull();
	});

	test("returns null for empty buffer", () => {
		expect(sniffMimeType(new Uint8Array(0))).toBeNull();
	});

	test("TAR requires at least 262 bytes", () => {
		const buf = new Uint8Array(256);
		expect(sniffMimeType(buf)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// SUPPORTED_UPLOAD_MIME_TYPES
// ---------------------------------------------------------------------------

describe("SUPPORTED_UPLOAD_MIME_TYPES", () => {
	test("contains image types", () => {
		expect(SUPPORTED_UPLOAD_MIME_TYPES.has("image/png")).toBe(true);
		expect(SUPPORTED_UPLOAD_MIME_TYPES.has("image/jpeg")).toBe(true);
		expect(SUPPORTED_UPLOAD_MIME_TYPES.has("image/gif")).toBe(true);
		expect(SUPPORTED_UPLOAD_MIME_TYPES.has("image/webp")).toBe(true);
	});

	test("contains archive types", () => {
		expect(SUPPORTED_UPLOAD_MIME_TYPES.has("application/zip")).toBe(true);
		expect(SUPPORTED_UPLOAD_MIME_TYPES.has("application/gzip")).toBe(true);
		expect(SUPPORTED_UPLOAD_MIME_TYPES.has("application/x-tar")).toBe(true);
		expect(SUPPORTED_UPLOAD_MIME_TYPES.has("application/pdf")).toBe(true);
	});

	test("does not contain unsupported types", () => {
		expect(SUPPORTED_UPLOAD_MIME_TYPES.has("application/json")).toBe(false);
		expect(SUPPORTED_UPLOAD_MIME_TYPES.has("text/plain")).toBe(false);
	});
});
