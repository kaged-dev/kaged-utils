import * as fs from "node:fs";

const POOLED_BUFFER_SIZE = 512;
const ASYNC_POOL_SIZE = 10;
const MAX_ASYNC_WAITERS = 4;
const INITIAL_SYNC_BUFFER_SIZE = 1024;
const EMPTY_BUFFER = new Uint8Array(0);

const asyncPool = Array.from({ length: ASYNC_POOL_SIZE }, () =>
	Buffer.allocUnsafe(POOLED_BUFFER_SIZE),
);
const availableIndexes = Array.from({ length: ASYNC_POOL_SIZE }, (_, i) => i);
const waiters: Array<(index: number) => void> = [];
let syncBuf = new Uint8Array(INITIAL_SYNC_BUFFER_SIZE);

function acquireIndex(): Promise<number> | number {
	const idx = availableIndexes.pop();
	if (idx !== undefined) return idx;
	if (waiters.length >= MAX_ASYNC_WAITERS) return -1;
	const { promise, resolve } = Promise.withResolvers<number>();
	waiters.push(resolve);
	return promise;
}

function releaseIndex(idx: number): void {
	if (idx < 0) return;
	const w = waiters.shift();
	if (w) {
		w(idx);
		return;
	}
	availableIndexes.push(idx);
}

async function withAsyncBuf<T>(maxBytes: number, op: (buf: Buffer) => Promise<T>): Promise<T> {
	if (maxBytes <= 0) return op(EMPTY_BUFFER as unknown as Buffer);
	if (maxBytes > POOLED_BUFFER_SIZE) return op(Buffer.allocUnsafe(maxBytes));

	const poolIdx = await acquireIndex();
	const pooledBuf = poolIdx >= 0 ? asyncPool[poolIdx] : undefined;
	const buf = pooledBuf ?? Buffer.allocUnsafe(maxBytes);
	try {
		return await op(buf.subarray(0, maxBytes));
	} finally {
		releaseIndex(poolIdx);
	}
}

function withSyncBuf<T>(maxBytes: number, op: (buf: Uint8Array) => T): T {
	if (maxBytes <= 0) return op(EMPTY_BUFFER);
	if (maxBytes > syncBuf.byteLength) {
		syncBuf = new Uint8Array(maxBytes + (maxBytes >> 1));
	}
	return op(syncBuf.subarray(0, maxBytes));
}

export function peekFileSync<T>(
	filePath: string,
	maxBytes: number,
	op: (header: Uint8Array) => T,
): T {
	if (maxBytes <= 0) return op(EMPTY_BUFFER);
	const fd = fs.openSync(filePath, "r");
	try {
		return withSyncBuf(maxBytes, (buf) => {
			const bytesRead = fs.readSync(fd, buf, 0, buf.byteLength, 0);
			return op(buf.subarray(0, bytesRead));
		});
	} finally {
		fs.closeSync(fd);
	}
}

export async function peekFile<T>(
	filePath: string,
	maxBytes: number,
	op: (header: Uint8Array) => T,
): Promise<T> {
	if (maxBytes <= 0) return op(EMPTY_BUFFER);
	const fh = await fs.promises.open(filePath, "r");
	try {
		return await withAsyncBuf(maxBytes, async (buf) => {
			const { bytesRead } = await fh.read(buf, 0, buf.byteLength, 0);
			return op(buf.subarray(0, bytesRead));
		});
	} finally {
		await fh.close();
	}
}
