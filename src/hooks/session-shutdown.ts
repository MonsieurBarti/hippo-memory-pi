import type { HippoMemoryConfig } from "../config";
import type { MemoryService } from "../memory-service";
import type { NotifyFn } from "./session-start";

export interface SessionShutdownDeps {
	service: MemoryService;
	config: HippoMemoryConfig;
	notify: NotifyFn;
}

export type SessionShutdownHook = (event: unknown, ctx: unknown) => Promise<void>;

export function createSessionShutdownHook(deps: SessionShutdownDeps): SessionShutdownHook {
	return async function onSessionShutdown(_event, _ctx) {
		try {
			if (deps.config.autoSleep) {
				try {
					const status = await deps.service.status();
					if (status.newSinceLastSleep >= deps.config.sleepThreshold) {
						const result = await deps.service.sleep();
						deps.notify(
							`💤 Sleep: ${result.decayed} decayed, ${result.merged} merged, ${result.conflicts} conflicts`,
							"info",
						);
					}
				} catch {
					// Sleep is best-effort; a consolidation failure must not
					// prevent working-memory flush or shutdown.
				}
			}
			// Working memory flush is best-effort; shutdown must not fail on it.
			await deps.service.wmFlush().catch(() => undefined);
		} finally {
			// Always release the service handles, even if sleep / wmFlush threw.
			await deps.service.shutdown().catch(() => undefined);
		}
	};
}
