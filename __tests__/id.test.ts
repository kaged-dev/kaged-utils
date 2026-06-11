import { describe, expect, test } from "bun:test";
import {
	isValidSnowflake,
	SnowflakeSource,
	snowflake,
	snowflakeDate,
	snowflakeLowerBound,
	snowflakeTimestamp,
	snowflakeUpperBound,
} from "../src/id.ts";

describe("snowflake", () => {
	test("returns a 16-char hex string", () => {
		const id = snowflake();
		expect(id).toHaveLength(16);
		expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
	});

	test("generates unique ids", () => {
		const ids = new Set(Array.from({ length: 1000 }, () => snowflake()));
		expect(ids.size).toBe(1000);
	});

	test("accepts custom timestamp", () => {
		const ts = Date.now();
		const id = snowflake(ts);
		expect(id).toHaveLength(16);
	});
});

describe("isValidSnowflake", () => {
	test("valid snowflakes", () => {
		expect(isValidSnowflake(snowflake())).toBe(true);
		expect(isValidSnowflake("0000000000000000")).toBe(true);
		expect(isValidSnowflake("ffffffffffffffff")).toBe(true);
	});

	test("invalid snowflakes", () => {
		expect(isValidSnowflake("")).toBe(false);
		expect(isValidSnowflake("too-short")).toBe(false);
		expect(isValidSnowflake("000000000000000g")).toBe(false);
		expect(isValidSnowflake("00000000000000000")).toBe(false);
	});
});

describe("snowflakeLowerBound / snowflakeUpperBound", () => {
	test("lower bound has zero sequence", () => {
		const ts = Date.now();
		const lower = snowflakeLowerBound(ts);
		expect(isValidSnowflake(lower)).toBe(true);
	});

	test("upper bound has max sequence", () => {
		const ts = Date.now();
		const upper = snowflakeUpperBound(ts);
		expect(isValidSnowflake(upper)).toBe(true);
	});

	test("lower < upper for same timestamp", () => {
		const ts = Date.now();
		const lower = snowflakeLowerBound(ts);
		const upper = snowflakeUpperBound(ts);
		expect(lower < upper).toBe(true);
	});

	test("accepts Date objects", () => {
		const date = new Date();
		expect(isValidSnowflake(snowflakeLowerBound(date))).toBe(true);
		expect(isValidSnowflake(snowflakeUpperBound(date))).toBe(true);
	});
});

describe("snowflakeTimestamp / snowflakeDate", () => {
	test("round-trips through generate", () => {
		const now = Date.now();
		const id = snowflake(now);
		const extracted = snowflakeTimestamp(id);
		expect(Math.abs(extracted - now)).toBeLessThan(2);
	});

	test("snowflakeDate returns a Date", () => {
		const id = snowflake();
		const date = snowflakeDate(id);
		expect(date).toBeInstanceOf(Date);
		expect(date.getFullYear()).toBeGreaterThanOrEqual(2020);
	});
});

describe("SnowflakeSource", () => {
	test("custom initial sequence", () => {
		const source = new SnowflakeSource(0);
		expect(source.sequence).toBe(0);
		const id = source.generate();
		expect(isValidSnowflake(id)).toBe(true);
		expect(source.sequence).toBe(1);
	});

	test("sequence wraps at MAX_SEQ", () => {
		const source = new SnowflakeSource(0x3fffff);
		expect(source.sequence).toBe(0x3fffff);
		source.generate();
		expect(source.sequence).toBe(0);
	});

	test("independent sources produce different ids", () => {
		const a = new SnowflakeSource(0);
		const b = new SnowflakeSource(100);
		const ts = Date.now();
		expect(a.generate(ts)).not.toBe(b.generate(ts));
	});
});
