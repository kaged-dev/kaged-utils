/**
 * Structured rotating file logger for kaged.
 *
 * No external dependencies — uses Bun.write + Bun.file for I/O.
 * JSON-structured, one line per entry, daily rotation with configurable
 * max file count.
 *
 * Default: writes to `~/.local/share/kaged/logs/kaged.YYYY-MM-DD.log`.
 * Override via `configure()`.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

interface LoggerConfig {
	/** Directory for log files. */
	dir: string;
	/** Minimum level to write. Default: "debug". */
	level: LogLevel;
	/** Maximum number of daily log files to keep. Default: 7. */
	maxFiles: number;
	/** Also write to stderr. Default: false. */
	console: boolean;
}

function defaultLogDir(): string {
	const platform = process.platform;
	const home = os.homedir();
	if (platform === "darwin") {
		return path.join(home, "Library", "Logs", "kaged");
	}
	// Linux/other: XDG_STATE_HOME or ~/.local/state/kaged/logs
	const xdgState = process.env.XDG_STATE_HOME;
	if (xdgState) {
		return path.join(xdgState, "kaged", "logs");
	}
	return path.join(home, ".local", "state", "kaged", "logs");
}

const config: LoggerConfig = {
	dir: defaultLogDir(),
	level: "debug",
	maxFiles: 7,
	console: false,
};

let currentDate = "";
let currentFd: number | null = null;

function ensureDir(dir: string): void {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function dateStr(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

function logFileName(date: string): string {
	return path.join(config.dir, `kaged.${date}.log`);
}

function getFd(): number {
	const today = dateStr();
	if (currentFd !== null && currentDate === today) {
		return currentFd;
	}
	// Close previous day's fd
	if (currentFd !== null) {
		try {
			fs.closeSync(currentFd);
		} catch {}
	}
	ensureDir(config.dir);
	currentDate = today;
	currentFd = fs.openSync(
		logFileName(today),
		fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT,
		0o644,
	);

	// Fire-and-forget cleanup of old files
	pruneOldFiles();

	return currentFd;
}

function pruneOldFiles(): void {
	try {
		const files = fs
			.readdirSync(config.dir)
			.filter((f) => f.startsWith("kaged.") && f.endsWith(".log"))
			.sort()
			.reverse();
		for (const file of files.slice(config.maxFiles)) {
			try {
				fs.unlinkSync(path.join(config.dir, file));
			} catch {}
		}
	} catch {}
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
	if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[config.level]) return;

	const entry: Record<string, unknown> = {
		timestamp: new Date().toISOString(),
		level,
		pid: process.pid,
		message,
	};
	if (context) {
		for (const [key, value] of Object.entries(context)) {
			if (key !== "level" && key !== "timestamp" && key !== "message") {
				entry[key] = value;
			}
		}
	}

	const line = `${JSON.stringify(entry)}\n`;

	try {
		const fd = getFd();
		fs.writeSync(fd, line);
	} catch {
		// Logging failures should never crash the app
	}

	if (config.console) {
		try {
			process.stderr.write(line);
		} catch {}
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reconfigure the logger. Takes effect immediately.
 */
export function configure(opts: Partial<LoggerConfig>): void {
	if (opts.dir !== undefined) config.dir = opts.dir;
	if (opts.level !== undefined) config.level = opts.level;
	if (opts.maxFiles !== undefined) config.maxFiles = opts.maxFiles;
	if (opts.console !== undefined) config.console = opts.console;
	// Force fd refresh on next write
	if (currentFd !== null) {
		try {
			fs.closeSync(currentFd);
		} catch {}
		currentFd = null;
	}
}

export function debug(message: string, context?: Record<string, unknown>): void {
	write("debug", message, context);
}

export function info(message: string, context?: Record<string, unknown>): void {
	write("info", message, context);
}

export function warn(message: string, context?: Record<string, unknown>): void {
	write("warn", message, context);
}

export function error(message: string, context?: Record<string, unknown>): void {
	write("error", message, context);
}

/**
 * Get the path to today's log file (useful for diagnostics).
 */
export function getLogPath(date = new Date()): string {
	return logFileName(dateStr(date));
}

/**
 * Get the configured log directory.
 */
export function getLogDir(): string {
	return config.dir;
}
