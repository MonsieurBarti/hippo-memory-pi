/**
 * Hippo Memory PI Extension Template
 *
 * A starter kit for building PI coding agent extensions following
 * The Forge Flow conventions.
 */

import { StringEnum } from "@mariozechner/pi-ai";
import {
	type ExtensionAPI,
	type ExtensionContext,
	defineTool,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { ExtensionState } from "./types.js";

// Extension state (persisted in tool result details)
let state: ExtensionState = {
	initialized: false,
	config: {
		enabled: true,
	},
};

/**
 * Reconstruct state from session history
 */
function reconstructState(_sessionManager: ExtensionContext["sessionManager"]): void {
	// Reset to defaults
	state = {
		initialized: false,
		config: {
			enabled: true,
		},
	};

	// TODO: Reconstruct from tool result details if needed
	// for (const entry of sessionManager.getBranch()) {
	//   if (entry.type === "message" && entry.message.role === "toolResult") {
	//     if (entry.message.toolName === "hippo-memory-example") {
	//       state = entry.message.details ?? state;
	//     }
	//   }
	// }

	state.initialized = true;
}

/**
 * Hippo Memory PI Extension Entry Point
 */
export default function hippoMemoryExtension(pi: ExtensionAPI): void {
	// Session lifecycle: initialize on start
	pi.on("session_start", async (_event, ctx) => {
		reconstructState(ctx.sessionManager);
		if (ctx.hasUI) {
			ctx.ui.notify("Hippo Memory extension ready", "info");
		}
	});

	// Session lifecycle: cleanup on shutdown
	pi.on("session_shutdown", async () => {
		// Cleanup any resources here
	});

	// Register example tool
	pi.registerTool(
		defineTool({
			name: "hippo-memory-example",
			label: "Hippo Memory Example Tool",
			description:
				"Example tool for the Hippo Memory extension template. Demonstrates the standard pattern for Hippo Memory tools.",
			parameters: Type.Object({
				action: StringEnum(["list", "create", "delete"] as const, {
					description: "Action to perform",
				}),
				input: Type.Optional(
					Type.String({
						description: "Input value for the action",
					}),
				),
			}),
			async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
				// Check for cancellation
				if (signal?.aborted) {
					return {
						content: [{ type: "text", text: "Operation cancelled" }],
						details: { action: params.action, cancelled: true },
					};
				}

				// Handle actions
				switch (params.action) {
					case "list":
						return {
							content: [
								{
									type: "text",
									text: "Hippo Memory Example Tool - List action\n\nNo items to list yet.",
								},
							],
							details: { action: "list", items: [] },
						};

					case "create":
						if (!params.input) {
							return {
								content: [
									{
										type: "text",
										text: "Error: 'input' parameter required for 'create' action",
									},
								],
								details: { action: "create", error: "input required" },
								isError: true,
							};
						}
						return {
							content: [
								{
									type: "text",
									text: `Created: ${params.input}`,
								},
							],
							details: { action: "create", created: params.input },
						};

					case "delete":
						return {
							content: [
								{
									type: "text",
									text: "Delete action - not implemented in template",
								},
							],
							details: { action: "delete" },
						};

					default: {
						// TypeScript exhaustiveness check
						const _exhaustive: never = params.action;
						return {
							content: [
								{
									type: "text",
									text: `Unknown action: ${String(_exhaustive)}`,
								},
							],
							details: { action: "unknown" },
							isError: true,
						};
					}
				}
			},
		}),
	);

	// Register example command
	pi.registerCommand("hippo-memory-status", {
		description: "Show Hippo Memory extension status",
		handler: async (_args, ctx) => {
			const status = state.config.enabled ? "enabled" : "disabled";
			if (ctx.hasUI) {
				ctx.ui.notify(`Hippo Memory extension is ${status}`, "info");
			}
		},
	});

	// Register toggle command
	pi.registerCommand("hippo-memory-toggle", {
		description: "Toggle Hippo Memory extension on/off",
		handler: async (_args, ctx) => {
			state.config.enabled = !state.config.enabled;
			const status = state.config.enabled ? "enabled" : "disabled";
			if (ctx.hasUI) {
				ctx.ui.notify(`Hippo Memory extension ${status}`, "info");
			}
		},
	});
}
