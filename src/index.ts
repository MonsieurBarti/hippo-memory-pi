import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TObject } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import type { CommandContext, CommandDefinition } from "./commands";
import { createAllCommands, createToggleStore } from "./commands";
import { loadConfig } from "./config";
import { ErrorCapture, type ToolResultLike } from "./error-capture";
import { HippoMemoryService } from "./hippo-memory-service";
import { type AgentEndEvent, createAgentEndHook } from "./hooks/agent-end";
import { type BeforeAgentStartEvent, createBeforeAgentStartHook } from "./hooks/before-agent-start";
import { createSessionShutdownHook } from "./hooks/session-shutdown";
import {
	type NotifyFn,
	type NotifyLevel,
	type SessionStartContext,
	type SessionStartEvent,
	createSessionStartHook,
} from "./hooks/session-start";
import { createToolResultHook } from "./hooks/tool-result";
import { resolveRoots } from "./paths";
import { createSessionState } from "./session-state";
import { SuccessDetector } from "./success-detector";
import type { ToolDefinition } from "./tools";
import { createAllTools } from "./tools";
import { checkForUpdates } from "./update-check.js";

// ---------------------------------------------------------------------------
// Structural PI API — minimal subset of what @mariozechner/pi-coding-agent
// exposes at runtime. We deliberately avoid importing the real type so this
// package can be imported and unit-tested without the peer dep installed.
// ---------------------------------------------------------------------------

type PiEventHandler = (event: unknown, ctx: unknown) => unknown | Promise<unknown>;

interface PiToolExecuteResult {
	content: Array<{ type: "text"; text: string }>;
	details: unknown;
}

interface PiRegisteredTool {
	name: string;
	label: string;
	description: string;
	promptSnippet: string;
	promptGuidelines: string[];
	parameters: unknown;
	execute(toolCallId: string, input: unknown): Promise<PiToolExecuteResult>;
}

interface PiRegisteredCommand {
	description?: string;
	handler(args: string, ctx: PiCommandContext): Promise<void>;
}

interface PiCommandContext {
	ui?: {
		notify?: (message: string, level?: string) => void;
	};
	cwd?: string;
}

export interface PiExtensionApi {
	on(event: string, handler: PiEventHandler): void;
	registerTool(tool: PiRegisteredTool): void;
	registerCommand(name: string, config: PiRegisteredCommand): void;
	cwd?: string;
	exec: (
		cmd: string,
		args: string[],
		opts?: { timeout?: number },
	) => Promise<{ stdout: string; code: number }>;
}

// ---------------------------------------------------------------------------
// Boundary adapters: bridge Wave 4/6 definitions to PI's structural shape
// without casts. `wrapTool` uses TypeBox's runtime Value.Check to narrow the
// unknown input to Static<S> before delegating to the typed execute().
// ---------------------------------------------------------------------------

function wrapTool<S extends TObject>(def: ToolDefinition<S>): PiRegisteredTool {
	const guidelines = [...def.promptGuidelines];
	if (def.readOnly) {
		guidelines.push(
			"This tool is read-only (no side effects). Safe to call in parallel with other read-only tools.",
		);
	}
	return {
		name: def.name,
		label: def.label,
		description: def.description,
		promptSnippet: def.promptSnippet,
		promptGuidelines: guidelines,
		parameters: def.parameters,
		async execute(toolCallId, input) {
			if (!Value.Check(def.parameters, input)) {
				return {
					content: [
						{
							type: "text",
							text: `Invalid input for ${def.name}`,
						},
					],
					details: { error: "validation-failed" },
				};
			}
			const result = await def.execute(toolCallId, input);
			return {
				content: result.content,
				details: result.details,
			};
		},
	};
}

function wrapCommand(def: CommandDefinition): PiRegisteredCommand {
	return {
		description: def.description,
		async handler(args, piCtx) {
			const ctx: CommandContext = {
				cwd: piCtx.cwd ?? process.cwd(),
				ui: {
					notify: (message, level = "info") => {
						piCtx.ui?.notify?.(message, level);
					},
				},
			};
			await def.handler(args, ctx);
		},
	};
}

// ---------------------------------------------------------------------------
// Default export — called by PI with its ExtensionAPI instance at startup.
// Wires configuration, service, helpers, hooks, tools, commands.
// ---------------------------------------------------------------------------

export default function hippoMemoryExtension(pi: PiExtensionApi): void {
	// 1. Resolve configuration + paths eagerly. This runs once per extension
	//    instance. The actual SQLite stores are opened lazily by the service
	//    inside the session_start hook.
	const cwd = pi.cwd ?? process.cwd();
	const baseConfig = loadConfig({ cwd });
	const { projectRoot, globalRoot } = resolveRoots({ cwd, config: baseConfig });
	const config = { ...baseConfig, projectRoot, globalRoot };

	// 2. Instantiate the singleton collaborators. These outlive individual
	//    events; they're owned by this extension instance.
	const service = new HippoMemoryService(config);
	const errorCapture = new ErrorCapture({ debounceMs: 60_000 });
	const successDetector = new SuccessDetector();
	const sessionState = createSessionState({ ringSize: 10 });
	const toggleStore = createToggleStore();

	// 3. A stderr-backed notify function. PI supplies a richer ctx.ui.notify
	//    on real events, but the hooks accept a shared NotifyFn at construction
	//    time. For v1 we log to stderr; a future wave can route this through
	//    the first non-null ctx.ui.notify if richer presentation is needed.
	const notify: NotifyFn = (message: string, level: NotifyLevel = "info") => {
		process.stderr.write(`[hippo-memory-pi] ${level}: ${message}\n`);
	};

	// 4. Register all tools + commands.
	for (const def of createAllTools(service)) {
		pi.registerTool(wrapTool(def));
	}
	for (const def of createAllCommands({ service, toggleStore })) {
		pi.registerCommand(def.name, wrapCommand(def));
	}

	// 4b. Tell PI where our skill lives so it's discovered even when loaded
	//     via `pi -e ./src/index.ts` (which skips package.json's pi.skills).
	//     The path resolves relative to this source file's location — works
	//     whether running from src/ (jiti) or dist/ (compiled).
	const extensionDir = dirname(fileURLToPath(import.meta.url));
	const skillsDir = join(extensionDir, "skills");
	pi.on("resources_discover", (_event, _ctx) => {
		return { skills: [skillsDir] };
	});

	// 5. Build hook handlers.
	const sessionStart = createSessionStartHook({ service, config, notify });
	const sessionShutdown = createSessionShutdownHook({ service, config, notify });
	const beforeAgentStart = createBeforeAgentStartHook({
		service,
		config,
		isToggledOff: toggleStore.isToggledOff,
	});
	const toolResult = createToolResultHook({ service, config, errorCapture });
	const agentEnd = createAgentEndHook({
		service,
		config,
		successDetector,
		getAnchorIds: sessionState.getAnchorIds,
		getRecentToolResults: sessionState.getRecentToolResults,
	});

	// 6. Narrow PI's `unknown` event payloads to the hook-specific event types
	//    via small type guards. PI's real runtime shapes are supersets of what
	//    we need; the guards check only the fields we read.
	function isSessionStartEvent(value: unknown): value is SessionStartEvent {
		if (value === null || typeof value !== "object") return false;
		const reason = (value as { reason?: unknown }).reason;
		return (
			reason === "startup" ||
			reason === "new" ||
			reason === "resume" ||
			reason === "fork" ||
			reason === "reload"
		);
	}

	function isSessionStartCtx(value: unknown): value is SessionStartContext {
		if (value === null || typeof value !== "object") return false;
		return typeof (value as { cwd?: unknown }).cwd === "string";
	}

	function isBeforeAgentStartEvent(value: unknown): value is BeforeAgentStartEvent {
		if (value === null || typeof value !== "object") return false;
		const prompt = (value as { prompt?: unknown }).prompt;
		const systemPrompt = (value as { systemPrompt?: unknown }).systemPrompt;
		return typeof prompt === "string" && typeof systemPrompt === "string";
	}

	function isAgentEndEvent(value: unknown): value is AgentEndEvent {
		if (value === null || typeof value !== "object") return false;
		return typeof (value as { stopReason?: unknown }).stopReason === "string";
	}

	function isToolResultLike(value: unknown): value is ToolResultLike {
		if (value === null || typeof value !== "object") return false;
		return typeof (value as { toolName?: unknown }).toolName === "string";
	}

	// 7. Subscribe. Each handler narrows the payload; anything that doesn't
	//    match is silently skipped to keep PI's event loop happy.
	pi.on("session_start", async (event, ctx) => {
		if (!isSessionStartEvent(event)) return;
		if (!isSessionStartCtx(ctx)) return;
		await sessionStart(event, ctx);

		// Check for extension updates
		const updateInfo = await checkForUpdates(pi);
		if (updateInfo?.updateAvailable) {
			notify(
				`📦 Update available: ${updateInfo.latestVersion} (you have ${updateInfo.currentVersion}). Run: pi install npm:@the-forge-flow/hippo-memory-pi`,
				"info",
			);
		}
	});

	pi.on("session_shutdown", async (event, ctx) => {
		await sessionShutdown(event, ctx);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (!isBeforeAgentStartEvent(event)) return undefined;
		const result = await beforeAgentStart(event, ctx);
		if (result) {
			sessionState.setAnchorIds(result.message.details.memoryIds);
		}
		return result;
	});

	pi.on("tool_result", async (event, ctx) => {
		if (!isToolResultLike(event)) return;
		sessionState.recordToolResult({ isError: event.isError === true });
		await toolResult(event, ctx);
	});

	pi.on("agent_end", async (event, ctx) => {
		if (!isAgentEndEvent(event)) return;
		await agentEnd(event, ctx);
		sessionState.clearAnchorIds();
	});
}
