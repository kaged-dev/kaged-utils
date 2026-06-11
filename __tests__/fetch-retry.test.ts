import { describe, expect, test } from "bun:test";
import {
	extractHttpStatusFromError,
	extractRetryHint,
	fetchWithRetry,
	isRetryableError,
	isRetryableStatus,
	isUnexpectedSocketCloseMessage,
} from "../src/fetch-retry.ts";

describe("extractRetryHint", () => {
	test("returns undefined for null/undefined source", () => {
		expect(extractRetryHint(null)).toBeUndefined();
		expect(extractRetryHint(undefined)).toBeUndefined();
	});

	test("extracts from Retry-After header (numeric seconds)", () => {
		const headers = new Headers({ "retry-after": "5" });
		expect(extractRetryHint(headers)).toBe(5000);
	});

	test("extracts from Retry-After header (zero)", () => {
		const headers = new Headers({ "retry-after": "0" });
		expect(extractRetryHint(headers)).toBe(0);
	});

	test("extracts from x-ratelimit-reset-after header", () => {
		const headers = new Headers({ "x-ratelimit-reset-after": "3.5" });
		expect(extractRetryHint(headers)).toBe(3500);
	});

	test("extracts from quota reset body pattern", () => {
		expect(extractRetryHint(null, "Your quota will reset after 1h2m3s")).toBe(3723000);
		expect(extractRetryHint(null, "reset after 10m15s")).toBe(615000);
		expect(extractRetryHint(null, "reset after 39s")).toBe(39000);
	});

	test("extracts from 'Please retry in' body pattern", () => {
		expect(extractRetryHint(null, "Please retry in 250ms")).toBe(250);
		expect(extractRetryHint(null, "Please retry in 12s")).toBe(12000);
	});

	test("extracts from retryDelay JSON field", () => {
		expect(extractRetryHint(null, '"retryDelay": "34.07s"')).toBe(34070);
		expect(extractRetryHint(null, '"retryDelay": "500ms"')).toBe(500);
	});

	test("extracts from 'try again in' body pattern", () => {
		expect(extractRetryHint(null, "try again in 250ms")).toBe(250);
		expect(extractRetryHint(null, "try again in 12s")).toBe(12000);
		expect(extractRetryHint(null, "try again in 12sec")).toBe(12000);
	});

	test("returns undefined when no signal found", () => {
		expect(extractRetryHint(null, "no retry info here")).toBeUndefined();
		expect(extractRetryHint(new Headers(), "nothing")).toBeUndefined();
	});

	test("headers take priority over body", () => {
		const headers = new Headers({ "retry-after": "2" });
		const result = extractRetryHint(headers, "Please retry in 500ms");
		expect(result).toBe(2000);
	});
});

describe("isRetryableStatus", () => {
	test("retryable statuses", () => {
		expect(isRetryableStatus(408)).toBe(true);
		expect(isRetryableStatus(429)).toBe(true);
		expect(isRetryableStatus(500)).toBe(true);
		expect(isRetryableStatus(502)).toBe(true);
		expect(isRetryableStatus(503)).toBe(true);
	});

	test("non-retryable statuses", () => {
		expect(isRetryableStatus(200)).toBe(false);
		expect(isRetryableStatus(400)).toBe(false);
		expect(isRetryableStatus(401)).toBe(false);
		expect(isRetryableStatus(403)).toBe(false);
		expect(isRetryableStatus(404)).toBe(false);
	});
});

describe("extractHttpStatusFromError", () => {
	test("extracts from status field", () => {
		expect(extractHttpStatusFromError({ status: 429 })).toBe(429);
	});

	test("extracts from statusCode field", () => {
		expect(extractHttpStatusFromError({ statusCode: 503 })).toBe(503);
	});

	test("extracts from response.status", () => {
		expect(extractHttpStatusFromError({ response: { status: 500 } })).toBe(500);
	});

	test("extracts from string status", () => {
		expect(extractHttpStatusFromError({ status: "429" })).toBe(429);
	});

	test("extracts from error message", () => {
		expect(extractHttpStatusFromError({ message: "error: 429" })).toBe(429);
		expect(extractHttpStatusFromError({ message: "HTTP 503" })).toBe(503);
		expect(extractHttpStatusFromError({ message: "error (401)" })).toBe(401);
	});

	test("follows cause chain", () => {
		const err = { message: "wrapper", cause: { status: 429 } };
		expect(extractHttpStatusFromError(err)).toBe(429);
	});

	test("returns undefined for non-objects", () => {
		expect(extractHttpStatusFromError(null)).toBeUndefined();
		expect(extractHttpStatusFromError("string")).toBeUndefined();
		expect(extractHttpStatusFromError(42)).toBeUndefined();
	});

	test("limits cause depth to 2", () => {
		const deep = { cause: { cause: { cause: { status: 500 } } } };
		expect(extractHttpStatusFromError(deep)).toBeUndefined();
	});
});

describe("isRetryableError", () => {
	test("AbortError is retryable", () => {
		expect(isRetryableError({ name: "AbortError", message: "" })).toBe(true);
	});

	test("timeout messages are retryable", () => {
		expect(isRetryableError({ message: "Request timed out" })).toBe(true);
		expect(isRetryableError({ message: "operation aborted" })).toBe(true);
	});

	test("retryable HTTP statuses", () => {
		expect(isRetryableError({ status: 429, message: "" })).toBe(true);
		expect(isRetryableError({ status: 503, message: "" })).toBe(true);
	});

	test("4xx (non-408/429) is not retryable", () => {
		expect(isRetryableError({ status: 400, message: "" })).toBe(false);
		expect(isRetryableError({ status: 401, message: "" })).toBe(false);
		expect(isRetryableError({ status: 404, message: "" })).toBe(false);
	});

	test("validation messages are not retryable", () => {
		expect(isRetryableError({ message: "invalid request body" })).toBe(false);
		expect(isRetryableError({ message: "bad request" })).toBe(false);
	});

	test("transient messages are retryable", () => {
		expect(isRetryableError({ message: "service unavailable" })).toBe(true);
		expect(isRetryableError({ message: "rate limit exceeded" })).toBe(true);
		expect(isRetryableError({ message: "overloaded" })).toBe(true);
		expect(isRetryableError({ message: "fetch failed" })).toBe(true);
	});
});

describe("isUnexpectedSocketCloseMessage", () => {
	test("matches socket close messages", () => {
		expect(isUnexpectedSocketCloseMessage("the socket connection was closed unexpectedly")).toBe(
			true,
		);
		expect(isUnexpectedSocketCloseMessage("socket connection closed unexpectedly")).toBe(true);
	});

	test("rejects non-matching messages", () => {
		expect(isUnexpectedSocketCloseMessage("connection refused")).toBe(false);
	});
});

describe("fetchWithRetry", () => {
	test("returns response on success", async () => {
		const mockFetch = async () => new Response("ok", { status: 200 });
		const response = await fetchWithRetry("http://test", { fetch: mockFetch });
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
	});

	test("retries on retryable status", async () => {
		let attempts = 0;
		const mockFetch = async () => {
			attempts++;
			if (attempts < 3) return new Response("busy", { status: 429 });
			return new Response("ok", { status: 200 });
		};
		const response = await fetchWithRetry("http://test", {
			fetch: mockFetch,
			defaultDelayMs: 1,
		});
		expect(response.status).toBe(200);
		expect(attempts).toBe(3);
	});

	test("returns last response after maxAttempts", async () => {
		const mockFetch = async () => new Response("busy", { status: 429 });
		const response = await fetchWithRetry("http://test", {
			fetch: mockFetch,
			maxAttempts: 2,
			defaultDelayMs: 1,
		});
		expect(response.status).toBe(429);
	});

	test("throws on network error after maxAttempts", async () => {
		const mockFetch = async () => {
			throw new Error("fetch failed");
		};
		await expect(
			fetchWithRetry("http://test", {
				fetch: mockFetch,
				maxAttempts: 2,
				defaultDelayMs: 1,
			}),
		).rejects.toThrow("fetch failed");
	});

	test("throws immediately on abort", async () => {
		const ac = new AbortController();
		ac.abort();
		await expect(fetchWithRetry("http://test", { signal: ac.signal })).rejects.toThrow(
			"Request was aborted",
		);
	});

	test("supports URL function", async () => {
		const urls: string[] = [];
		const mockFetch = async (input: string | URL | Request) => {
			urls.push(String(input));
			if (urls.length < 2) return new Response("retry", { status: 500 });
			return new Response("ok", { status: 200 });
		};
		await fetchWithRetry((attempt) => `http://test/${attempt}`, {
			fetch: mockFetch,
			defaultDelayMs: 1,
		});
		expect(urls).toEqual(["http://test/0", "http://test/1"]);
	});

	test("supports prepareInit for header refresh", async () => {
		let capturedHeaders: Headers | undefined;
		const mockFetch = async (_: string | URL | Request, init?: RequestInit) => {
			capturedHeaders = new Headers(init?.headers ?? undefined);
			return new Response("ok", { status: 200 });
		};
		await fetchWithRetry("http://test", {
			fetch: mockFetch,
			headers: { "x-base": "1" },
			prepareInit: () => ({ headers: { "x-token": "fresh" } }),
		});
		expect(capturedHeaders?.get("x-base")).toBe("1");
		expect(capturedHeaders?.get("x-token")).toBe("fresh");
	});

	test("supports array defaultDelayMs", async () => {
		let attempts = 0;
		const mockFetch = async () => {
			attempts++;
			if (attempts < 3) return new Response("retry", { status: 500 });
			return new Response("ok", { status: 200 });
		};
		await fetchWithRetry("http://test", {
			fetch: mockFetch,
			defaultDelayMs: [1, 1, 1],
		});
		expect(attempts).toBe(3);
	});

	test("returns early when server hint exceeds maxDelayMs", async () => {
		let attempts = 0;
		const mockFetch = async () => {
			attempts++;
			return new Response("busy", {
				status: 429,
				headers: { "retry-after": "120" },
			});
		};
		const response = await fetchWithRetry("http://test", {
			fetch: mockFetch,
			maxDelayMs: 1000,
			defaultDelayMs: 1,
		});
		expect(attempts).toBe(1);
		expect(response.status).toBe(429);
	});
});
