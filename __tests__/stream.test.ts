import { describe, expect, test } from "bun:test";
import type { ServerSentEvent } from "../src/stream.ts";
import {
	parseJsonlLenient,
	readJsonl,
	readLines,
	readSseEvents,
	readSseJson,
	readTextLines,
} from "../src/stream.ts";

function toStream(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
	const items: T[] = [];
	for await (const item of gen) {
		items.push(item);
	}
	return items;
}

describe("readLines", () => {
	test("splits on newlines", async () => {
		const stream = toStream(["hello\nworld\n"]);
		const lines = await collect(readLines(stream));
		const decoder = new TextDecoder();
		expect(lines.map((l) => decoder.decode(l))).toEqual(["hello", "world"]);
	});

	test("handles chunks split mid-line", async () => {
		const stream = toStream(["hel", "lo\nwor", "ld\n"]);
		const lines = await collect(readLines(stream));
		const decoder = new TextDecoder();
		expect(lines.map((l) => decoder.decode(l))).toEqual(["hello", "world"]);
	});

	test("yields trailing data without final newline", async () => {
		const stream = toStream(["line1\nline2"]);
		const lines = await collect(readLines(stream));
		const decoder = new TextDecoder();
		expect(lines.map((l) => decoder.decode(l))).toEqual(["line1", "line2"]);
	});

	test("empty stream yields nothing", async () => {
		const stream = toStream([]);
		const lines = await collect(readLines(stream));
		expect(lines).toEqual([]);
	});
});

describe("readTextLines", () => {
	test("yields decoded strings", async () => {
		const stream = toStream(["foo\nbar\nbaz\n"]);
		const lines = await collect(readTextLines(stream));
		expect(lines).toEqual(["foo", "bar", "baz"]);
	});
});

describe("readJsonl", () => {
	test("parses JSONL lines", async () => {
		const stream = toStream(['{"a":1}\n{"b":2}\n']);
		const items = await collect(readJsonl<Record<string, number>>(stream));
		expect(items).toEqual([{ a: 1 }, { b: 2 }]);
	});

	test("skips blank lines", async () => {
		const stream = toStream(['{"a":1}\n\n{"b":2}\n']);
		const items = await collect(readJsonl<Record<string, number>>(stream));
		expect(items).toEqual([{ a: 1 }, { b: 2 }]);
	});
});

describe("parseJsonlLenient", () => {
	test("parses valid lines", () => {
		const result = parseJsonlLenient<{ x: number }>('{"x":1}\n{"x":2}');
		expect(result).toEqual([{ x: 1 }, { x: 2 }]);
	});

	test("skips malformed lines", () => {
		const result = parseJsonlLenient<{ x: number }>('{"x":1}\nnot json\n{"x":2}');
		expect(result).toEqual([{ x: 1 }, { x: 2 }]);
	});

	test("skips blank lines", () => {
		const result = parseJsonlLenient<number>("1\n\n2\n\n3");
		expect(result).toEqual([1, 2, 3]);
	});

	test("returns empty for empty input", () => {
		expect(parseJsonlLenient("")).toEqual([]);
		expect(parseJsonlLenient("\n\n")).toEqual([]);
	});
});

describe("readSseEvents", () => {
	test("parses basic SSE events", async () => {
		const stream = toStream(["data: hello\n\ndata: world\n\n"]);
		const events = await collect(readSseEvents(stream));
		expect(events).toHaveLength(2);
		expect(events[0]?.data).toBe("hello");
		expect(events[1]?.data).toBe("world");
	});

	test("parses named events", async () => {
		const stream = toStream(["event: msg\ndata: payload\n\n"]);
		const events = await collect(readSseEvents(stream));
		expect(events).toHaveLength(1);
		expect(events[0]?.event).toBe("msg");
		expect(events[0]?.data).toBe("payload");
	});

	test("concatenates multi-line data with newlines", async () => {
		const stream = toStream(["data: line1\ndata: line2\n\n"]);
		const events = await collect(readSseEvents(stream));
		expect(events).toHaveLength(1);
		expect(events[0]?.data).toBe("line1\nline2");
	});

	test("handles \\r\\n line endings", async () => {
		const stream = toStream(["data: hello\r\n\r\n"]);
		const events = await collect(readSseEvents(stream));
		expect(events).toHaveLength(1);
		expect(events[0]?.data).toBe("hello");
	});

	test("skips comment lines", async () => {
		const stream = toStream([": comment\ndata: payload\n\n"]);
		const events = await collect(readSseEvents(stream));
		expect(events).toHaveLength(1);
		expect(events[0]?.data).toBe("payload");
		expect(events[0]?.raw).toContain(": comment");
	});

	test("flushes trailing event without final blank line", async () => {
		const stream = toStream(["data: trailing"]);
		const events = await collect(readSseEvents(stream));
		expect(events).toHaveLength(1);
		expect(events[0]?.data).toBe("trailing");
	});
});

describe("readSseJson", () => {
	test("parses JSON from SSE data", async () => {
		const stream = toStream(['data: {"x":1}\n\ndata: {"x":2}\n\n']);
		const items = await collect(readSseJson<{ x: number }>(stream));
		expect(items).toEqual([{ x: 1 }, { x: 2 }]);
	});

	test("stops at [DONE] sentinel", async () => {
		const stream = toStream(['data: {"x":1}\n\ndata: [DONE]\n\ndata: {"x":2}\n\n']);
		const items = await collect(readSseJson<{ x: number }>(stream));
		expect(items).toEqual([{ x: 1 }]);
	});

	test("skips empty data events", async () => {
		const stream = toStream(['data: \n\ndata: {"x":1}\n\n']);
		const items = await collect(readSseJson<{ x: number }>(stream));
		expect(items).toEqual([{ x: 1 }]);
	});

	test("calls onEvent observer", async () => {
		const observed: ServerSentEvent[] = [];
		const stream = toStream(['data: {"x":1}\n\n']);
		await collect(readSseJson<{ x: number }>(stream, undefined, (e) => observed.push(e)));
		expect(observed).toHaveLength(1);
		expect(observed[0]?.data).toBe('{"x":1}');
	});

	test("observer errors do not break stream", async () => {
		const stream = toStream(['data: {"x":1}\n\ndata: {"x":2}\n\n']);
		const items = await collect(
			readSseJson<{ x: number }>(stream, undefined, () => {
				throw new Error("observer boom");
			}),
		);
		expect(items).toEqual([{ x: 1 }, { x: 2 }]);
	});
});
