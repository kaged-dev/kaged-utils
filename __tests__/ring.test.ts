import { describe, expect, test } from "bun:test";
import { RingBuffer } from "../src/ring.ts";

describe("RingBuffer", () => {
	test("starts empty", () => {
		const buf = new RingBuffer<number>(3);
		expect(buf.length).toBe(0);
		expect(buf.isEmpty).toBe(true);
		expect(buf.isFull).toBe(false);
		expect(buf.capacity).toBe(3);
	});

	test("push and length", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		expect(buf.length).toBe(2);
		expect(buf.isEmpty).toBe(false);
	});

	test("push returns undefined when not full", () => {
		const buf = new RingBuffer<number>(3);
		expect(buf.push(1)).toBeUndefined();
		expect(buf.push(2)).toBeUndefined();
		expect(buf.push(3)).toBeUndefined();
	});

	test("push returns overwritten item when full", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		expect(buf.isFull).toBe(true);
		expect(buf.push(4)).toBe(1);
		expect(buf.push(5)).toBe(2);
		expect(buf.toArray()).toEqual([3, 4, 5]);
	});

	test("shift removes oldest", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		expect(buf.shift()).toBe(1);
		expect(buf.shift()).toBe(2);
		expect(buf.length).toBe(1);
	});

	test("shift returns undefined when empty", () => {
		const buf = new RingBuffer<number>(3);
		expect(buf.shift()).toBeUndefined();
	});

	test("pop removes newest", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		expect(buf.pop()).toBe(3);
		expect(buf.pop()).toBe(2);
		expect(buf.length).toBe(1);
	});

	test("pop returns undefined when empty", () => {
		const buf = new RingBuffer<number>(3);
		expect(buf.pop()).toBeUndefined();
	});

	test("unshift adds to front", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(2);
		buf.push(3);
		buf.unshift(1);
		expect(buf.toArray()).toEqual([1, 2, 3]);
	});

	test("unshift overwrites newest when full", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		expect(buf.unshift(0)).toBe(3);
		expect(buf.toArray()).toEqual([0, 1, 2]);
	});

	test("at with positive index", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(10);
		buf.push(20);
		buf.push(30);
		expect(buf.at(0)).toBe(10);
		expect(buf.at(1)).toBe(20);
		expect(buf.at(2)).toBe(30);
	});

	test("at with negative index", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(10);
		buf.push(20);
		buf.push(30);
		expect(buf.at(-1)).toBe(30);
		expect(buf.at(-2)).toBe(20);
		expect(buf.at(-3)).toBe(10);
	});

	test("at returns undefined for out-of-bounds", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		expect(buf.at(1)).toBeUndefined();
		expect(buf.at(-2)).toBeUndefined();
	});

	test("peek and peekBack", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		expect(buf.peek()).toBe(1);
		expect(buf.peekBack()).toBe(3);
	});

	test("clear resets buffer", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		buf.clear();
		expect(buf.length).toBe(0);
		expect(buf.isEmpty).toBe(true);
		expect(buf.toArray()).toEqual([]);
	});

	test("iterator yields in FIFO order", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		expect([...buf]).toEqual([1, 2, 3]);
	});

	test("iterator after wraparound", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		buf.push(4);
		buf.push(5);
		expect([...buf]).toEqual([3, 4, 5]);
	});

	test("toArray after wraparound", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		buf.shift();
		buf.push(4);
		expect(buf.toArray()).toEqual([2, 3, 4]);
	});

	test("mixed push/shift operations", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.shift();
		buf.push(3);
		buf.push(4);
		expect(buf.toArray()).toEqual([2, 3, 4]);
		expect(buf.length).toBe(3);
	});

	test("works with string type", () => {
		const buf = new RingBuffer<string>(2);
		buf.push("a");
		buf.push("b");
		buf.push("c");
		expect(buf.toArray()).toEqual(["b", "c"]);
	});
});
