/**
 * Error thrown when an operation is aborted via AbortSignal.
 */
export class AbortError extends Error {
	constructor(signal: AbortSignal) {
		const message = signal.reason instanceof Error ? signal.reason.message : "Cancelled";
		super(`Aborted: ${message}`, { cause: signal.reason });
		this.name = "AbortError";
	}
}

/**
 * Creates an abortable stream from a given stream and signal.
 * When the signal fires, the stream is cancelled.
 */
export function createAbortableStream<T>(
	stream: ReadableStream<T>,
	signal?: AbortSignal,
): ReadableStream<T> {
	if (!signal) return stream;
	return stream.pipeThrough(new TransformStream<T, T>(), { signal });
}

/**
 * Runs a promise-returning function. If the given AbortSignal is aborted
 * before or during execution, the promise is rejected with AbortError.
 */
export function untilAborted<T>(
	signal: AbortSignal | undefined | null,
	pr: Promise<T> | (() => Promise<T>),
): Promise<T> {
	if (!signal) return typeof pr === "function" ? pr() : pr;
	if (signal.aborted) return Promise.reject(new AbortError(signal));

	const { promise, resolve, reject } = Promise.withResolvers<T>();
	const onAbort = () => reject(new AbortError(signal));
	signal.addEventListener("abort", onAbort, { once: true });

	void (async () => {
		try {
			resolve(await (typeof pr === "function" ? pr() : pr));
		} catch (err) {
			reject(err);
		} finally {
			signal.removeEventListener("abort", onAbort);
		}
	})();

	return promise;
}

/**
 * Memoize a zero-argument function: calls it once, caches the result.
 */
export function once<T>(fn: () => T): () => T {
	let store: { value: T } | undefined;
	return () => {
		if (store) return store.value;
		const value = fn();
		store = { value };
		return value;
	};
}
