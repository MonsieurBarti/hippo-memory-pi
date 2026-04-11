import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import hippoMemoryExtension, { type PiExtensionApi } from "../../src/index";

interface RegisteredTool {
	name: string;
	label: string;
	description: string;
	promptSnippet: string;
	promptGuidelines: string[];
	parameters: unknown;
	execute(toolCallId: string, input: unknown): Promise<unknown>;
}

interface RegisteredCommand {
	name: string;
	description?: string;
	handler(args: string, ctx: unknown): Promise<void>;
}

interface CapturedHandler {
	event: string;
	handler: (event: unknown, ctx: unknown) => unknown | Promise<unknown>;
}

function createCapturingPiApi(cwd: string): {
	api: PiExtensionApi;
	tools: RegisteredTool[];
	commands: RegisteredCommand[];
	handlers: CapturedHandler[];
} {
	const tools: RegisteredTool[] = [];
	const commands: RegisteredCommand[] = [];
	const handlers: CapturedHandler[] = [];
	const api: PiExtensionApi = {
		cwd,
		exec: vi.fn().mockResolvedValue({ stdout: "", code: 0 }),
		on(event, handler) {
			handlers.push({ event, handler });
		},
		registerTool(tool) {
			tools.push({
				name: tool.name,
				label: tool.label,
				description: tool.description,
				promptSnippet: tool.promptSnippet,
				promptGuidelines: tool.promptGuidelines,
				parameters: tool.parameters,
				execute: tool.execute,
			});
		},
		registerCommand(name, config) {
			const entry: RegisteredCommand = {
				name,
				handler: config.handler,
			};
			if (config.description !== undefined) {
				entry.description = config.description;
			}
			commands.push(entry);
		},
	};
	return { api, tools, commands, handlers };
}

describe("extension entry point", () => {
	let tmpCwd: string;

	beforeEach(() => {
		tmpCwd = mkdtempSync(join(tmpdir(), "hippo-entry-"));
	});

	afterEach(() => {
		rmSync(tmpCwd, { recursive: true, force: true });
	});

	test("default export is a function", () => {
		expect(typeof hippoMemoryExtension).toBe("function");
	});

	test("registers 17 tools, all tff-memory_ prefixed", () => {
		const { api, tools } = createCapturingPiApi(tmpCwd);
		hippoMemoryExtension(api);
		expect(tools).toHaveLength(17);
		for (const tool of tools) {
			expect(tool.name).toMatch(/^tff-memory_/);
		}
	});

	test("registers 6 commands with expected names", () => {
		const { api, commands } = createCapturingPiApi(tmpCwd);
		hippoMemoryExtension(api);
		expect(commands).toHaveLength(6);
		const names = commands.map((c) => c.name).sort();
		expect(names).toEqual([
			"memory-conflicts",
			"memory-inspect",
			"memory-recall",
			"memory-sleep",
			"memory-status",
			"toggle-hippo-memory",
		]);
	});

	test("subscribes to the 6 lifecycle events (5 core + resources_discover)", () => {
		const { api, handlers } = createCapturingPiApi(tmpCwd);
		hippoMemoryExtension(api);
		const events = handlers.map((h) => h.event).sort();
		expect(events).toEqual([
			"agent_end",
			"before_agent_start",
			"resources_discover",
			"session_shutdown",
			"session_start",
			"tool_result",
		]);
	});

	test("wrapTool returns a validation-failed tool result on bad input", async () => {
		const { api, tools } = createCapturingPiApi(tmpCwd);
		hippoMemoryExtension(api);
		// Pick any tool — remember is fine. Call it with totally wrong input.
		const remember = tools.find((t) => t.name === "tff-memory_remember");
		expect(remember).toBeDefined();
		const result = await remember?.execute("test-call", { notARealField: 42 });
		// Without `content` string, validation should fail and the wrapper
		// returns a validation-failed envelope rather than throwing.
		expect(result).toMatchObject({
			content: expect.arrayContaining([
				expect.objectContaining({
					type: "text",
					text: expect.stringContaining("Invalid input"),
				}),
			]),
		});
	});

	test("wrapCommand adapts PI context to CommandContext and forwards notify", async () => {
		const { api, commands } = createCapturingPiApi(tmpCwd);
		hippoMemoryExtension(api);
		const toggle = commands.find((c) => c.name === "toggle-hippo-memory");
		expect(toggle).toBeDefined();

		const notifyMock = vi.fn();
		await toggle?.handler("", { cwd: tmpCwd, ui: { notify: notifyMock } });
		expect(notifyMock).toHaveBeenCalled();
	});

	test("wrapCommand handles missing pi ctx.ui and ctx.ui.notify gracefully", async () => {
		const { api, commands } = createCapturingPiApi(tmpCwd);
		hippoMemoryExtension(api);
		const toggle = commands.find((c) => c.name === "toggle-hippo-memory");
		expect(toggle).toBeDefined();
		// No ui field at all — should not throw.
		await expect(toggle?.handler("", { cwd: tmpCwd })).resolves.toBeUndefined();
	});
});
