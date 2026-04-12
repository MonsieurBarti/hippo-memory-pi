import type { HippoMemoryConfig } from "../config.js";
import { type InjectionResult, buildInjection } from "../context-injector.js";
import type { MemoryService } from "../memory-service.js";
import type { ContextOptions } from "../types.js";

export interface BeforeAgentStartEvent {
	prompt: string;
	systemPrompt: string;
}

export interface BeforeAgentStartDeps {
	service: MemoryService;
	config: HippoMemoryConfig;
	isToggledOff: () => boolean;
}

export type BeforeAgentStartHook = (
	event: BeforeAgentStartEvent,
	ctx: unknown,
) => Promise<InjectionResult | undefined>;

export function createBeforeAgentStartHook(deps: BeforeAgentStartDeps): BeforeAgentStartHook {
	return async function onBeforeAgentStart(event, _ctx) {
		if (!deps.config.autoInject) return undefined;
		if (deps.isToggledOff()) return undefined;

		// Build ContextOptions without introducing undefined into optional
		// fields (exactOptionalPropertyTypes forbids that).
		const opts: ContextOptions = {
			query: event.prompt,
			budget: deps.config.recallBudget,
			limit: deps.config.recallLimit,
			framing: deps.config.framing,
			scope: "both",
		};

		try {
			const ctxResult = await deps.service.context(opts);
			return buildInjection(ctxResult, event.prompt, event.systemPrompt);
		} catch {
			// Never block the agent turn on a memory failure.
			return undefined;
		}
	};
}
