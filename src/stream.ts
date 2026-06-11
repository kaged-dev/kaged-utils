/**
 * Stream utilities for line reading, SSE parsing, and JSONL parsing.
 *
 * Uses Bun-native JSONL parsing where available, with manual fallback.
 */
import { createAbortableStream } from "./abortable.ts";

const LF = 0x0a;

// ---------------------------------------------------------------------------
// ConcatSink — zero-copy line splitter / JSONL accumulator
// ---------------------------------------------------------------------------

class ConcatSink {
	#space?: Buffer;
	#length = 0;

	#ensureCapacity(size: number): Buffer {
		const space = this.#space;
		if (space && space.length >= size) return space;
		const nextSize = space ? Math.max(size, space.length * 2) : size;
		const next = Buffer.allocUnsafe(nextSize);
		if (space && this.#length > 0) {
			space.copy(next, 0, 0, this.#length);
		}
		this.#space = next;
		return next;
	}

	append(chunk: Uint8Array) {
		const n = chunk.length;
		if (!n) return;
		const offset = this.#length;
		const space = this.#ensureCapacity(offset + n);
		space.set(chunk, offset);
		this.#length += n;
	}

	reset(chunk: Uint8Array) {
		const n = chunk.length;
		if (!n) {
			this.#length = 0;
			return;
		}
		const space = this.#ensureCapacity(n);
		space.set(chunk, 0);
		this.#length = n;
	}

	get isEmpty(): boolean {
		return this.#length === 0;
	}

	flush(): Uint8Array | undefined {
		if (!this.#length || !this.#space) return undefined;
		return new Uint8Array(this.#space.subarray(0, this.#length));
	}

	clear() {
		this.#length = 0;
	}

	*appendAndFlushLines(chunk: Uint8Array) {
		let pos = 0;
		while (pos < chunk.length) {
			const nl = chunk.indexOf(LF, pos);
			if (nl === -1) {
				this.append(chunk.subarray(pos));
				return;
			}
			const suffix = chunk.subarray(pos, nl);
			pos = nl + 1;
			if (this.isEmpty) {
				yield suffix;
			} else {
				this.append(suffix);
				const payload = this.flush();
				if (payload) {
					yield payload;
					this.clear();
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// readLines — async generator yielding raw Uint8Array lines
// ---------------------------------------------------------------------------

/**
 * Yield raw byte lines from a ReadableStream, splitting on LF.
 * Trailing data without a final newline is yielded as a last line.
 */
export async function* readLines(
	stream: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
): AsyncGenerator<Uint8Array> {
	const buffer = new ConcatSink();
	const source = createAbortableStream(stream, signal);
	try {
		for await (const chunk of source) {
			for (const line of buffer.appendAndFlushLines(chunk)) {
				yield line;
			}
		}
		if (!buffer.isEmpty) {
			const tail = buffer.flush();
			if (tail) {
				buffer.clear();
				yield tail;
			}
		}
	} catch (err) {
		if (signal?.aborted) return;
		throw err;
	}
}

// ---------------------------------------------------------------------------
// readTextLines — async generator yielding decoded string lines
// ---------------------------------------------------------------------------

const LINE_DECODER = new TextDecoder("utf-8");

/**
 * Yield decoded text lines from a ReadableStream.
 */
export async function* readTextLines(
	stream: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
): AsyncGenerator<string> {
	for await (const line of readLines(stream, signal)) {
		yield LINE_DECODER.decode(line);
	}
}

// ---------------------------------------------------------------------------
// readJsonl — async generator yielding parsed JSONL values
// ---------------------------------------------------------------------------

/**
 * Yield parsed JSON values from a JSONL (newline-delimited JSON) stream.
 * Blank lines are skipped.
 */
export async function* readJsonl<T>(
	stream: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
): AsyncGenerator<T> {
	for await (const line of readTextLines(stream, signal)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		yield JSON.parse(trimmed) as T;
	}
}

/**
 * Parse a complete JSONL string, skipping malformed lines instead of throwing.
 */
export function parseJsonlLenient<T>(input: string): T[] {
	const result: T[] = [];
	for (const line of input.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			result.push(JSON.parse(trimmed) as T);
		} catch {
			// Skip malformed lines
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// SSE (Server-Sent Events)
// ---------------------------------------------------------------------------

/**
 * A single Server-Sent Event dispatched on a blank-line boundary.
 */
export interface ServerSentEvent {
	event: string | null;
	data: string;
	raw: string[];
}

export type SseEventObserver = (event: ServerSentEvent) => void;

interface SseEventState {
	event: string | null;
	data: string | null;
	raw: string[];
}

const SSE_LINE_DECODER = new TextDecoder("utf-8");

function decodeSseLineBytes(line: Uint8Array, end: number): string {
	return end === line.length
		? SSE_LINE_DECODER.decode(line)
		: SSE_LINE_DECODER.decode(line.subarray(0, end));
}

function flushSseEvent(state: SseEventState): ServerSentEvent | null {
	if (state.event === null && state.data === null) return null;
	const event: ServerSentEvent = {
		event: state.event,
		data: state.data ?? "",
		raw: state.raw,
	};
	state.event = null;
	state.data = null;
	state.raw = [];
	return event;
}

function pushSseLine(line: Uint8Array, state: SseEventState): ServerSentEvent | null {
	let end = line.length;
	if (end > 0 && line[end - 1] === 0x0d /* '\r' */) end--;
	if (end === 0) return flushSseEvent(state);

	// Comment line
	if (line[0] === 0x3a /* ':' */) {
		state.raw.push(decodeSseLineBytes(line, end));
		return null;
	}

	const text = decodeSseLineBytes(line, end);
	state.raw.push(text);

	const colon = text.indexOf(":");
	const fieldName = colon === -1 ? text : text.slice(0, colon);
	let value = colon === -1 ? "" : text.slice(colon + 1);
	if (value.charCodeAt(0) === 0x20 /* ' ' */) value = value.slice(1);

	if (fieldName === "event") {
		state.event = value;
	} else if (fieldName === "data") {
		if (state.data === null) {
			state.data = value;
		} else {
			state.data += "\n";
			state.data += value;
		}
	}
	return null;
}

/**
 * Stream raw Server-Sent Events from an HTTP response body.
 * Yields one ServerSentEvent per blank-line dispatch.
 */
export async function* readSseEvents(
	stream: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
): AsyncGenerator<ServerSentEvent> {
	const lineBuffer = new ConcatSink();
	const state: SseEventState = { event: null, data: null, raw: [] };
	const source = createAbortableStream(stream, signal);
	try {
		for await (const chunk of source) {
			for (const line of lineBuffer.appendAndFlushLines(chunk)) {
				const event = pushSseLine(line, state);
				if (event) yield event;
			}
		}
		if (!lineBuffer.isEmpty) {
			const tail = lineBuffer.flush();
			if (tail) {
				lineBuffer.clear();
				const event = pushSseLine(tail, state);
				if (event) yield event;
			}
		}
		const trailing = flushSseEvent(state);
		if (trailing) yield trailing;
	} catch (err) {
		if (signal?.aborted) return;
		throw err;
	}
}

/**
 * Stream parsed JSON objects from SSE `data:` lines.
 * Skips events with empty data, stops at the OpenAI-style `[DONE]` sentinel.
 */
export async function* readSseJson<T>(
	stream: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
	onEvent?: SseEventObserver,
): AsyncGenerator<T> {
	for await (const sse of readSseEvents(stream, signal)) {
		if (onEvent) {
			try {
				onEvent(sse);
			} catch {
				// Diagnostic observers must never perturb stream consumption.
			}
		}
		const data = sse.data;
		if (data === "" || data === "[DONE]") {
			if (data === "[DONE]") return;
			continue;
		}
		yield JSON.parse(data) as T;
	}
}
