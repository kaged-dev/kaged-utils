import { peekFile, peekFileSync } from "./peek-file.ts";

const DEFAULT_HEADER_BYTES = 256 * 1024;

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]);
const RIFF_MAGIC = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
const WEBP_MAGIC = new Uint8Array([0x57, 0x45, 0x42, 0x50]);
const IHDR = new Uint8Array([0x49, 0x48, 0x44, 0x52]);
const GIF87A = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
const GIF89A = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const VP8X = new Uint8Array([0x56, 0x50, 0x38, 0x58]);
const VP8L = new Uint8Array([0x56, 0x50, 0x38, 0x4c]);
const VP8_ = new Uint8Array([0x56, 0x50, 0x38, 0x20]);

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
]);

export type ImageMimeType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export interface ImageMetadata {
	mimeType: ImageMimeType;
	width?: number;
	height?: number;
	channels?: number;
	hasAlpha?: boolean;
}

function matchAt(data: Uint8Array, offset: number, magic: Uint8Array): boolean {
	if (data.length < offset + magic.length) return false;
	for (let i = 0; i < magic.length; i++) {
		if (data[offset + i] !== magic[i]) return false;
	}
	return true;
}

function parsePng(h: Uint8Array): ImageMetadata | null {
	if (!matchAt(h, 0, PNG_MAGIC)) return null;
	if (!matchAt(h, 12, IHDR)) return { mimeType: "image/png" };
	if (h.length < 26) return { mimeType: "image/png" };

	const v = new DataView(h.buffer, h.byteOffset, h.byteLength);
	const width = v.getUint32(16, false);
	const height = v.getUint32(20, false);
	const colorType = v.getUint8(25);

	const channelMap: Record<number, { channels: number; hasAlpha: boolean } | undefined> = {
		0: { channels: 1, hasAlpha: false },
		2: { channels: 3, hasAlpha: false },
		3: { channels: 3, hasAlpha: false },
		4: { channels: 2, hasAlpha: true },
		6: { channels: 4, hasAlpha: true },
	};
	const info = channelMap[colorType];
	if (info) return { mimeType: "image/png", width, height, ...info };
	return { mimeType: "image/png", width, height };
}

function parseJpeg(h: Uint8Array): ImageMetadata | null {
	if (!matchAt(h, 0, JPEG_MAGIC)) return null;
	if (h.length < 4) return { mimeType: "image/jpeg" };

	const v = new DataView(h.buffer, h.byteOffset, h.byteLength);
	let offset = 2;
	while (offset + 9 < h.length) {
		if (h[offset] !== 0xff) {
			offset += 1;
			continue;
		}

		let mo = offset + 1;
		while (mo < h.length && h[mo] === 0xff) mo++;
		if (mo >= h.length) break;

		const marker = h[mo];
		if (marker === undefined) break;
		const so = mo + 1;
		if (
			marker === 0xd8 ||
			marker === 0xd9 ||
			marker === 0x01 ||
			(marker >= 0xd0 && marker <= 0xd7)
		) {
			offset = so;
			continue;
		}
		if (so + 1 >= h.length) break;

		const segLen = v.getUint16(so, false);
		if (segLen < 2) break;

		const isSof =
			marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
		if (isSof) {
			if (so + 7 >= h.length) break;
			const height = v.getUint16(so + 3, false);
			const width = v.getUint16(so + 5, false);
			const channels = h[so + 7];
			return {
				mimeType: "image/jpeg",
				width,
				height,
				channels: Number.isFinite(channels) ? channels : undefined,
				hasAlpha: false,
			};
		}

		offset = so + segLen;
	}

	return { mimeType: "image/jpeg" };
}

function parseGif(h: Uint8Array): ImageMetadata | null {
	if (!matchAt(h, 0, GIF87A) && !matchAt(h, 0, GIF89A)) return null;
	if (h.length < 10) return { mimeType: "image/gif" };
	const v = new DataView(h.buffer, h.byteOffset, h.byteLength);
	return {
		mimeType: "image/gif",
		width: v.getUint16(6, true),
		height: v.getUint16(8, true),
		channels: 3,
	};
}

function parseWebp(h: Uint8Array): ImageMetadata | null {
	if (!matchAt(h, 0, RIFF_MAGIC) || !matchAt(h, 8, WEBP_MAGIC)) return null;
	if (h.length < 30) return { mimeType: "image/webp" };

	if (matchAt(h, 12, VP8X)) {
		const alphaFlag = h[20];
		const width0 = h[24];
		const width1 = h[25];
		const width2 = h[26];
		const height0 = h[27];
		const height1 = h[28];
		const height2 = h[29];
		if (
			alphaFlag === undefined ||
			width0 === undefined ||
			width1 === undefined ||
			width2 === undefined ||
			height0 === undefined ||
			height1 === undefined ||
			height2 === undefined
		) {
			return { mimeType: "image/webp" };
		}
		const hasAlpha = (alphaFlag & 0x10) !== 0;
		const width = (width0 | (width1 << 8) | (width2 << 16)) + 1;
		const height = (height0 | (height1 << 8) | (height2 << 16)) + 1;
		return { mimeType: "image/webp", width, height, channels: hasAlpha ? 4 : 3, hasAlpha };
	}

	const v = new DataView(h.buffer, h.byteOffset, h.byteLength);
	if (matchAt(h, 12, VP8L)) {
		if (h.length < 25) return { mimeType: "image/webp" };
		const bits = v.getUint32(21, true);
		const width = (bits & 0x3fff) + 1;
		const height = ((bits >> 14) & 0x3fff) + 1;
		const hasAlpha = ((bits >> 28) & 0x1) === 1;
		return { mimeType: "image/webp", width, height, channels: hasAlpha ? 4 : 3, hasAlpha };
	}

	if (matchAt(h, 12, VP8_)) {
		const width = v.getUint16(26, true) & 0x3fff;
		const height = v.getUint16(28, true) & 0x3fff;
		return { mimeType: "image/webp", width, height, channels: 3, hasAlpha: false };
	}

	return { mimeType: "image/webp" };
}

export function parseImageMetadata(header: Uint8Array): ImageMetadata | null {
	return parsePng(header) ?? parseJpeg(header) ?? parseGif(header) ?? parseWebp(header);
}

export function readImageMetadataSync(
	filePath: string,
	maxBytes = DEFAULT_HEADER_BYTES,
): ImageMetadata | null {
	return peekFileSync(filePath, maxBytes, parseImageMetadata);
}

export function readImageMetadata(
	filePath: string,
	maxBytes = DEFAULT_HEADER_BYTES,
): Promise<ImageMetadata | null> {
	return peekFile(filePath, maxBytes, parseImageMetadata);
}

// ---------------------------------------------------------------------------
// Archive / general MIME sniffing (Phase 8 — workflow uploads)
// ---------------------------------------------------------------------------

const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const GZIP_MAGIC = new Uint8Array([0x1f, 0x8b]);
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
const TAR_USTAR = new Uint8Array([0x75, 0x73, 0x74, 0x61, 0x72]); // "ustar" at offset 257

export type SniffedMimeType =
	| ImageMimeType
	| "application/zip"
	| "application/gzip"
	| "application/x-tar"
	| "application/pdf";

/**
 * Sniff MIME type from magic bytes. Covers common image types
 * (PNG, JPEG, GIF, WebP) and archive types (ZIP, GZIP, TAR, PDF).
 *
 * Returns the detected MIME type or null if unrecognised.
 * For image types this delegates to the existing image parsers;
 * for archives only the MIME string is returned (no dimensions).
 */
export function sniffMimeType(header: Uint8Array): SniffedMimeType | null {
	// Image types first (most common in workflow uploads)
	const img = parseImageMetadata(header);
	if (img) return img.mimeType;

	// ZIP (PK\x03\x04)
	if (matchAt(header, 0, ZIP_MAGIC)) return "application/zip";

	// GZIP (\x1f\x8b) — also covers .tar.gz
	if (matchAt(header, 0, GZIP_MAGIC)) return "application/gzip";

	// TAR — "ustar" signature at offset 257
	if (header.length >= 262 && matchAt(header, 257, TAR_USTAR)) return "application/x-tar";

	// PDF (%PDF)
	if (matchAt(header, 0, PDF_MAGIC)) return "application/pdf";

	return null;
}

export const SUPPORTED_UPLOAD_MIME_TYPES = new Set<string>([
	...SUPPORTED_IMAGE_MIME_TYPES,
	"application/zip",
	"application/gzip",
	"application/x-tar",
	"application/pdf",
	// Pass-through types: the accept list in DSL may allow any MIME,
	// but sniffing only covers the above. Unrecognised files pass
	// without a sniff mismatch check.
]);
