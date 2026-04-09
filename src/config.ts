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
	try {
		const raw = readFileSync(join(cwd, "hippo-memory.config.json"), "utf8");
		return JSON.parse(raw) as Partial<HippoMemoryConfig>;
	} catch {
		return {};
	}
}

function applyEnvBool(target: HippoMemoryConfig, key: string, envName: string): void {
	const val = process.env[envName];
	if (val === undefined) return;
	if (val === "true" || val === "1") {
		(target as unknown as Record<string, unknown>)[key] = true;
	} else if (val === "false" || val === "0") {
		(target as unknown as Record<string, unknown>)[key] = false;
	}
}

function applyEnvInt(target: HippoMemoryConfig, key: string, envName: string): void {
	const val = process.env[envName];
	if (val === undefined) return;
	const n = Number.parseInt(val, 10);
	if (!Number.isNaN(n) && n >= 0) {
		(target as unknown as Record<string, unknown>)[key] = n;
	}
}

function applyEnvEnum<K extends keyof HippoMemoryConfig>(
	target: HippoMemoryConfig,
	key: K,
	envName: string,
	allowed: ReadonlyArray<HippoMemoryConfig[K]>,
): void {
	const val = process.env[envName];
	if (val === undefined) return;
	if (allowed.includes(val as HippoMemoryConfig[K])) {
		(target as unknown as Record<string, unknown>)[key] = val;
	}
}

function applyEnvString(
	target: HippoMemoryConfig,
	key: "projectRoot" | "globalRoot",
	envName: string,
): void {
	const val = process.env[envName];
	if (val !== undefined && val.length > 0) {
		(target as unknown as Record<string, unknown>)[key] = val;
	}
}
