import { loadConfig } from "./config.js";
import { HippoMemoryService } from "./hippo-memory-service.js";
import { resolveRoots } from "./paths.js";

/**
 * `globalThis` slot where `hippoMemoryExtension` publishes its initialized
 * singleton. External callers (sibling PI extensions) should NOT read this
 * directly — use `createMemoryService()` instead, which guards for type,
 * readiness, and shutdown-safety. Exported so the PI extension itself can
 * publish/clear the slot, and so tests can stub it.
 */
export const REGISTRY_KEY = Symbol.for("@the-forge-flow/hippo-memory-pi/service");

export interface CreateMemoryServiceOptions {
	cwd?: string;
}

export interface MemoryServiceHandle {
	/** The live service. Use freely — it's already initialized. */
	service: HippoMemoryService;
	/**
	 * Release the handle. Idempotent — calling more than once is a safe no-op.
	 * - When `shared` is `false`, the first call runs `service.shutdown()`.
	 * - When `shared` is `true`, this is always a no-op — the PI extension owns
	 *   the lifecycle and will shut the service down on `session_shutdown`.
	 */
	release: () => Promise<void>;
	/**
	 * `true` if this handle points at PI's singleton; `false` if the factory
	 * built a fresh instance (e.g. because PI hadn't published one yet, or
	 * because this process is running outside of PI entirely).
	 */
	shared: boolean;
}

/**
 * Create or obtain a ready `HippoMemoryService`. When `hippoMemoryExtension`
 * has already run `session_start` in this process, the factory returns that
 * same instance with `shared: true`. Otherwise it constructs a new instance
 * using `loadConfig` + `resolveRoots`, calls `init(cwd)`, and returns it with
 * `shared: false`.
 *
 * Errors from `init()` propagate — callers that want graceful degradation
 * should wrap this call in try/catch.
 *
 * Assumption: a single resolved version of `@the-forge-flow/hippo-memory-pi`
 * per process. Cross-version registry compatibility is not enforced.
 */
export async function createMemoryService(
	opts: CreateMemoryServiceOptions = {},
): Promise<MemoryServiceHandle> {
	const registry = globalThis as Record<symbol, unknown>;
	const existing = registry[REGISTRY_KEY];
	if (existing instanceof HippoMemoryService && existing.isReady()) {
		let released = false;
		return {
			service: existing,
			release: async () => {
				if (released) return;
				released = true;
			},
			shared: true,
		};
	}

	const cwd = opts.cwd ?? process.cwd();
	const baseConfig = loadConfig({ cwd });
	const { projectRoot, globalRoot } = resolveRoots({ cwd, config: baseConfig });
	const config = { ...baseConfig, projectRoot, globalRoot };
	const service = new HippoMemoryService(config);
	await service.init(cwd);

	let released = false;
	return {
		service,
		release: async () => {
			if (released) return;
			released = true;
			await service.shutdown();
		},
		shared: false,
	};
}
