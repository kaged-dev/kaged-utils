import { isMainThread } from "node:worker_threads";

export type CleanupReason =
	| "exit"
	| "sigint"
	| "sigterm"
	| "sighup"
	| "uncaught_exception"
	| "unhandled_rejection"
	| "manual";

type CleanupCallback = (reason: CleanupReason) => void | Promise<void>;

const callbackList: CleanupCallback[] = [];
let cleanupStage: "idle" | "running" | "complete" = "idle";

function formatFatalError(label: string, err: Error): string {
	const name = err.name || "Error";
	const message = err.message || "(no message)";
	const stack = err.stack || "";
	const stackLines = stack.split("\n").slice(1);
	const formattedStack = stackLines.length > 0 ? `\n${stackLines.join("\n")}` : "";
	return `\n[${label}] ${name}: ${message}${formattedStack}\n`;
}

function runCleanup(reason: CleanupReason): Promise<void> {
	switch (cleanupStage) {
		case "idle":
			cleanupStage = "running";
			break;
		case "running":
		case "complete":
			return Promise.resolve();
	}

	const promises = callbackList.toReversed().map((callback) => {
		return Promise.try(() => callback(reason));
	});

	return Promise.allSettled(promises).then((results) => {
		for (const result of results) {
			if (result.status === "rejected") {
				const err =
					result.reason instanceof Error ? result.reason : new Error(String(result.reason));
				process.stderr.write(`[postmortem] cleanup callback failed: ${err.message}\n`);
			}
		}
		cleanupStage = "complete";
	});
}

if (isMainThread) {
	process
		.on("SIGINT", async () => {
			await runCleanup("sigint");
			process.exit(130);
		})
		.on("SIGTERM", async () => {
			await runCleanup("sigterm");
			process.exit(143);
		})
		.on("SIGHUP", async () => {
			await runCleanup("sighup");
			process.exit(129);
		})
		.on("uncaughtException", async (err) => {
			process.stderr.write(formatFatalError("Uncaught Exception", err));
			await runCleanup("uncaught_exception");
			process.exit(1);
		})
		.on("unhandledRejection", async (reason) => {
			const err = reason instanceof Error ? reason : new Error(String(reason));
			process.stderr.write(formatFatalError("Unhandled Rejection", err));
			await runCleanup("unhandled_rejection");
			process.exit(1);
		})
		.on("exit", () => {
			void runCleanup("exit");
		});
} else {
	process.on("exit", () => {
		void runCleanup("exit");
	});
}

export function registerCleanup(_id: string, callback: CleanupCallback): () => void {
	let done = false;
	const exec: CleanupCallback = (reason) => {
		if (done) return;
		done = true;
		return callback(reason);
	};

	const cancel = () => {
		const index = callbackList.indexOf(exec);
		if (index >= 0) callbackList.splice(index, 1);
		done = true;
	};

	if (cleanupStage !== "idle") {
		try {
			callback("manual");
		} catch {}
		return () => {};
	}

	callbackList.push(exec);
	return cancel;
}

export function cleanup(): Promise<void> {
	return runCleanup("manual");
}

export async function quit(code: number = 0): Promise<void> {
	await runCleanup("manual");
	if (!isMainThread) return;
	if (process.stdout.writableLength > 0) {
		const { promise, resolve } = Promise.withResolvers<void>();
		process.stdout.once("drain", resolve);
		await Promise.race([promise, Bun.sleep(5000)]);
	}
	process.exit(code);
}
