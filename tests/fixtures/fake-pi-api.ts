import { vi } from "vitest";
import type { PiExtensionApi } from "../../src/index";

interface RegisteredTool {
	name: string;
	execute(toolCallId: string, input: unknown): Promise<unknown>;
}

interface RegisteredCommand {
	name: string;
	handler(args: string, ctx: unknown): Promise<void>;
}

type EventHandler = (event: unknown, ctx: unknown) => unknown | Promise<unknown>;

export interface FakePiApi {
	readonly api: PiExtensionApi;
	readonly tools: readonly RegisteredTool[];
	readonly commands: readonly RegisteredCommand[];
	readonly handlers: ReadonlyMap<string, EventHandler[]>;
	emit(event: string, payload: unknown, ctx?: unknown): Promise<unknown>;
	callTool(name: string, input: unknown): Promise<unknown>;
	callCommand(name: string, args: string, ctx?: unknown): Promise<void>;
}

export function createFakePiApi(cwd: string): FakePiApi {
	const tools: RegisteredTool[] = [];
	const commands: RegisteredCommand[] = [];
	const handlers = new Map<string, EventHandler[]>();

	const notifyFn = vi.fn();
	const defaultCtx = {
		cwd,
		ui: { notify: notifyFn },
	};

	const api: PiExtensionApi = {
		cwd,
		exec: vi.fn().mockResolvedValue({ stdout: "", code: 0 }),
		on(event: string, handler: EventHandler) {
			const list = handlers.get(event) ?? [];
			list.push(handler);
			handlers.set(event, list);
		},
		registerTool(tool) {
			tools.push({ name: tool.name, execute: tool.execute });
		},
		registerCommand(name, config) {
			commands.push({ name, handler: config.handler });
		},
	};

	return {
		api,
		tools,
		commands,
		handlers,
		async emit(event, payload, ctx = defaultCtx) {
			const list = handlers.get(event) ?? [];
			let lastResult: unknown;
			for (const handler of list) {
				lastResult = await handler(payload, ctx);
			}
			return lastResult;
		},
		async callTool(name, input) {
			const tool = tools.find((t) => t.name === name);
			if (!tool) throw new Error(`Tool not registered: ${name}`);
			return tool.execute("integration-test-call", input);
		},
		async callCommand(name, args, ctx = defaultCtx) {
			const cmd = commands.find((c) => c.name === name);
			if (!cmd) throw new Error(`Command not registered: ${name}`);
			await cmd.handler(args, ctx);
		},
	};
}
