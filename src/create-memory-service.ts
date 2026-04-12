import { loadConfig } from "./config";
import { HippoMemoryService } from "./hippo-memory-service";
import { resolveRoots } from "./paths";

/**
 * `globalThis` slot where `hippoMemoryExtension` publishes its initialized
 * singleton. External callers (sibling PI extensions) should NOT read this
 * directly — use `createMemoryService()` instead, which guards for type,
 * readiness, and shutdown-safety. Exported only for tests and diagnostics.
 */
export const REGISTRY_KEY = Symbol.for("@the-forge-flow/hippo-memory-pi/service");

export interface CreateMemoryServiceOptions {
	cwd?: string;
}

export interface MemoryServiceHandle {
	/** The live service. Use freely — it's already initialized. */
	service: HippoMemoryService;
	/**
	 * Release the handle. Safe to call exactly once.
	 * - When `shared` is `false`, this calls `service.shutdown()`.
	 * - When `shared` is `true`, this is a no-op — the PI extension owns the
	 *   lifecycle and will shut the service down on `session_shutdown`.
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
		return {
			service: existing,
			release: async () => {},
			shared: true,
		};
	}

	const cwd = opts.cwd ?? process.cwd();
	const baseConfig = loadConfig({ cwd });
	const { projectRoot, globalRoot } = resolveRoots({ cwd, config: baseConfig });
	const config = { ...baseConfig, projectRoot, globalRoot };
	const service = new HippoMemoryService(config);
	await service.init(cwd);

	return {
		service,
		release: () => service.shutdown(),
		shared: false,
	};
}
