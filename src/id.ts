const HEX4 = Array.from({ length: 65536 }, (_, i) => i.toString(16).padStart(4, "0"));

function randu32() {
	const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
	return value;
}

const EPOCH = 1420070400000;
const MAX_SEQ = 0x3fffff;

type Snowflake = string & { readonly __brand: unique symbol };

function formatParts(dt: number, seq: number): Snowflake {
	const dtLo = dt % 1024;
	const hi = (dt - dtLo) / 1024;
	const lo = ((dtLo << 22) | seq) >>> 0;
	const hi1 = (hi >>> 16) & 0xffff;
	const hi2 = hi & 0xffff;
	const lo1 = (lo >>> 16) & 0xffff;
	const lo2 = lo & 0xffff;
	return `${HEX4[hi1]}${HEX4[hi2]}${HEX4[lo1]}${HEX4[lo2]}` as Snowflake;
}

const PATTERN = /^[0-9a-f]{16}$/;

class SnowflakeSource {
	#seq: number;

	constructor(sequence: number = randu32() & MAX_SEQ) {
		this.#seq = sequence & MAX_SEQ;
	}

	get sequence() {
		return this.#seq & MAX_SEQ;
	}

	generate(timestamp: number = Date.now()): Snowflake {
		const seq = (this.#seq + 1) & MAX_SEQ;
		const dt = timestamp - EPOCH;
		this.#seq = seq;
		return formatParts(dt, seq);
	}
}

const defaultSource = new SnowflakeSource();

export function snowflake(timestamp = Date.now()): string {
	return defaultSource.generate(timestamp);
}

export function isValidSnowflake(value: string): boolean {
	return value.length === 16 && PATTERN.test(value);
}

export function snowflakeLowerBound(time: Date | number): string {
	const ms = time instanceof Date ? time.getTime() : time;
	return formatParts(ms - EPOCH, 0);
}

export function snowflakeUpperBound(time: Date | number): string {
	const ms = time instanceof Date ? time.getTime() : time;
	return formatParts(ms - EPOCH, MAX_SEQ);
}

function toBigInt(value: string): bigint {
	const hi = Number.parseInt(value.substring(0, 8), 16);
	const lo = Number.parseInt(value.substring(8, 16), 16);
	return (BigInt(hi) << 32n) | BigInt(lo);
}

export function snowflakeTimestamp(value: string): number {
	const n = toBigInt(value) >> 22n;
	return Number(n + BigInt(EPOCH));
}

export function snowflakeDate(value: string): Date {
	return new Date(snowflakeTimestamp(value));
}

export { type Snowflake, SnowflakeSource };
