import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type CacheKey = string | bigint | number;

const XCODE_BINS = new Set([
	"clang",
	"clang++",
	"gcc",
	"g++",
	"cc",
	"c++",
	"cpp",
	"c89",
	"c99",
	"swift",
	"swiftc",
	"swift-frontend",
	"clangd",
	"sourcekit-lsp",
	"ld",
	"ld-classic",
	"ar",
	"ranlib",
	"libtool",
	"as",
	"lipo",
	"install_name_tool",
	"codesign_allocate",
	"make",
	"gnumake",
	"m4",
	"flex",
	"bison",
	"yacc",
	"lex",
	"git",
	"git-receive-pack",
	"git-upload-pack",
	"git-upload-archive",
	"git-shell",
	"scalar",
	"lldb",
	"lldb-dap",
	"nm",
	"otool",
	"objdump",
	"strings",
	"strip",
	"size",
	"dsymutil",
	"dwarfdump",
	"vtool",
	"clang-format",
	"swift-format",
]);

const XCODE_BIN_PREFIXES = ["python", "pip", "pydoc", "2to3"];

function isXcodeBin(command: string): boolean {
	if (XCODE_BINS.has(command)) return true;
	for (const prefix of XCODE_BIN_PREFIXES) {
		if (command.startsWith(prefix)) return true;
	}
	return false;
}

function getDeveloperDir(): string | null {
	const envDir = process.env.DEVELOPER_DIR;
	if (envDir && fs.existsSync(envDir)) return envDir;

	try {
		return fs.readlinkSync("/var/db/xcode_select_link");
	} catch {}

	for (const candidate of [
		"/Applications/Xcode.app/Contents/Developer",
		"/Library/Developer/CommandLineTools",
	]) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

let macosTools: Map<string, string> | undefined;
function getMacosToolPaths(): Map<string, string> {
	if (macosTools) return macosTools;

	const dirs = ["/Library/Developer/CommandLineTools/usr/bin"];
	const devDir = getDeveloperDir();
	if (devDir) {
		dirs.push(
			path.join(devDir, "usr/bin"),
			path.join(devDir, "Toolchains/XcodeDefault.xctoolchain/usr/bin"),
		);
	}

	macosTools = new Map<string, string>();
	for (const dir of [...new Set(dirs)]) {
		try {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				if ((entry.isFile() || entry.isSymbolicLink()) && !macosTools.has(entry.name)) {
					macosTools.set(entry.name, path.join(dir, entry.name));
				}
			}
		} catch {}
	}
	return macosTools;
}

const toolCache = new Map<CacheKey, string | null>();

export enum WhichCachePolicy {
	Cached = 0,
	Bypass = 1,
	Fresh = 2,
	ReadOnly = 3,
}

export interface WhichOptions {
	PATH?: string;
	cwd?: string;
	cache?: WhichCachePolicy;
}

function darwinWhich(command: string, opts?: { PATH?: string; cwd?: string }): string | null {
	const result = Bun.which(command, opts);
	if (result) return result;
	if (isXcodeBin(command)) return getMacosToolPaths().get(command) ?? null;
	return null;
}

const whichFresh = os.platform() === "darwin" ? darwinWhich : Bun.which;

function cacheKey(command: string, opts?: { PATH?: string; cwd?: string }): CacheKey {
	if (!opts?.cwd && !opts?.PATH) return command;
	let h = Bun.hash(command);
	if (opts.cwd) h = Bun.hash(opts.cwd, h);
	if (opts.PATH) h = Bun.hash(opts.PATH, h);
	return h;
}

export function $which(command: string, options?: WhichOptions): string | null {
	const policy = options?.cache ?? WhichCachePolicy.Cached;
	let key: CacheKey | undefined;

	if (policy !== WhichCachePolicy.Bypass) {
		key = cacheKey(command, options);
		if (policy !== WhichCachePolicy.Fresh) {
			const cached = toolCache.get(key);
			if (cached !== undefined) return cached;
		}
	}

	const result = whichFresh(command, options);
	if (key != null && policy !== WhichCachePolicy.ReadOnly) {
		toolCache.set(key, result);
	}
	return result;
}
