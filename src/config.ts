import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface HippoMemoryConfig {
	autoInject: boolean;
	autoCapture: boolean;
	autoOutcome: boolean;
	autoSleep: boolean;
	autoLearnGit: boolean;
	autoShare: boolean;
	recallBudget: number;
	recallLimit: number;
	sleepThreshold: number;
	searchMode: "bm25" | "hybrid";
	framing: "observe" | "suggest" | "assert";
	projectRoot?: string;
	globalRoot?: string;
}

export const DEFAULT_CONFIG: HippoMemoryConfig = {
	autoInject: true,
	autoCapture: true,
	autoOutcome: true,
	autoSleep: true,
	autoLearnGit: true,
	autoShare: true,
	recallBudget: 1500,
	recallLimit: 5,
	sleepThreshold: 5,
	searchMode: "hybrid",
	framing: "observe",
};

// Precise key unions for the env helpers — each helper only mutates fields of
// the correct runtime type, so no casts are needed when assigning.
type BoolKey = {
	[K in keyof HippoMemoryConfig]-?: HippoMemoryConfig[K] extends boolean ? K : never;
}[keyof HippoMemoryConfig];

type IntKey = {
	[K in keyof HippoMemoryConfig]-?: HippoMemoryConfig[K] extends number ? K : never;
}[keyof HippoMemoryConfig];

// Optional-string fields. Enumerated explicitly because mapped-type filtering
// for `string | undefined` distributes unpredictably under exactOptionalPropertyTypes.
type StringKey = "projectRoot" | "globalRoot";

interface LoadConfigOptions {
	cwd: string;
}

export function loadConfig({ cwd }: LoadConfigOptions): HippoMemoryConfig {
	const fromFile = readConfigFile(cwd);
	const merged: HippoMemoryConfig = { ...DEFAULT_CONFIG, ...fromFile };

	applyEnvBool(merged, "autoInject", "HIPPO_MEMORY_AUTO_INJECT");
	applyEnvBool(merged, "autoCapture", "HIPPO_MEMORY_AUTO_CAPTURE");
	applyEnvBool(merged, "autoOutcome", "HIPPO_MEMORY_AUTO_OUTCOME");
	applyEnvBool(merged, "autoSleep", "HIPPO_MEMORY_AUTO_SLEEP");
	applyEnvBool(merged, "autoLearnGit", "HIPPO_MEMORY_AUTO_LEARN_GIT");
	applyEnvBool(merged, "autoShare", "HIPPO_MEMORY_AUTO_SHARE");
	applyEnvInt(merged, "recallBudget", "HIPPO_MEMORY_RECALL_BUDGET");
	applyEnvInt(merged, "recallLimit", "HIPPO_MEMORY_RECALL_LIMIT");
	applyEnvInt(merged, "sleepThreshold", "HIPPO_MEMORY_SLEEP_THRESHOLD");
	applyEnvEnum(merged, "searchMode", "HIPPO_MEMORY_SEARCH_MODE", ["bm25", "hybrid"]);
	applyEnvEnum(merged, "framing", "HIPPO_MEMORY_FRAMING", ["observe", "suggest", "assert"]);
	applyEnvString(merged, "projectRoot", "HIPPO_PROJECT_ROOT");
	applyEnvString(merged, "globalRoot", "HIPPO_GLOBAL_ROOT");

	return merged;
}

function readConfigFile(cwd: string): Partial<HippoMemoryConfig> {
	let raw: string;
	try {
		raw = readFileSync(join(cwd, "hippo-memory.config.json"), "utf8");
	} catch {
		return {};
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		process.stderr.write(
			`[hippo-memory-pi] warning: hippo-memory.config.json is not valid JSON: ${
				err instanceof Error ? err.message : String(err)
			}\n`,
		);
		return {};
	}
	return sanitizeConfigFile(parsed);
}

// Strip fields whose runtime types don't match the declared HippoMemoryConfig
// shape. A malformed config file should never poison later code that reads
// typed fields (e.g., arithmetic on recallBudget). `value` comes from
// JSON.parse (typed unknown), so we narrow with typeof guards.
function sanitizeConfigFile(value: unknown): Partial<HippoMemoryConfig> {
	if (value === null || typeof value !== "object") return {};
	// Narrowing JSON.parse output to a keyed access shape is unavoidable;
	// every field is then checked with a typeof guard before assignment.
	const input: { readonly [k: string]: unknown } = value as { readonly [k: string]: unknown };
	const out: Partial<HippoMemoryConfig> = {};

	const boolKeys: readonly BoolKey[] = [
		"autoInject",
		"autoCapture",
		"autoOutcome",
		"autoSleep",
		"autoLearnGit",
		"autoShare",
	];
	for (const k of boolKeys) {
		const v = input[k];
		if (typeof v === "boolean") out[k] = v;
	}

	const intKeys: readonly IntKey[] = ["recallBudget", "recallLimit", "sleepThreshold"];
	for (const k of intKeys) {
		const v = input[k];
		if (typeof v === "number" && Number.isInteger(v) && v >= 0) out[k] = v;
	}

	const searchMode = input.searchMode;
	if (searchMode === "bm25" || searchMode === "hybrid") out.searchMode = searchMode;

	const framing = input.framing;
	if (framing === "observe" || framing === "suggest" || framing === "assert") {
		out.framing = framing;
	}

	const projectRoot = input.projectRoot;
	if (typeof projectRoot === "string" && projectRoot.length > 0) {
		out.projectRoot = projectRoot;
	}
	const globalRoot = input.globalRoot;
	if (typeof globalRoot === "string" && globalRoot.length > 0) {
		out.globalRoot = globalRoot;
	}

	return out;
}

const TRUTHY_BOOL_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSY_BOOL_VALUES = new Set(["false", "0", "no", "off"]);

function applyEnvBool(target: HippoMemoryConfig, key: BoolKey, envName: string): void {
	const val = process.env[envName];
	if (val === undefined) return;
	const normalized = val.toLowerCase().trim();
	if (TRUTHY_BOOL_VALUES.has(normalized)) {
		target[key] = true;
	} else if (FALSY_BOOL_VALUES.has(normalized)) {
		target[key] = false;
	}
}

function applyEnvInt(target: HippoMemoryConfig, key: IntKey, envName: string): void {
	const val = process.env[envName];
	if (val === undefined) return;
	// Only accept strict non-negative integer strings. Rejects "1.5", "1000abc",
	// "", " ", and leading/trailing whitespace.
	if (!/^\d+$/.test(val)) return;
	const n = Number(val);
	if (Number.isInteger(n) && n >= 0) {
		target[key] = n;
	}
}

function applyEnvEnum<K extends "searchMode" | "framing">(
	target: HippoMemoryConfig,
	key: K,
	envName: string,
	allowed: readonly HippoMemoryConfig[K][],
): void {
	const val = process.env[envName];
	if (val === undefined) return;
	// `allowed` is the complete set of valid literal values; find narrows val
	// from `string` to the literal union without any cast.
	const match = allowed.find((v) => v === val);
	if (match !== undefined) {
		target[key] = match;
	}
}

function applyEnvString(target: HippoMemoryConfig, key: StringKey, envName: string): void {
	const val = process.env[envName];
	if (val !== undefined && val.length > 0) {
		target[key] = val;
	}
}
